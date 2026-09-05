import { JSX, MouseEvent, useEffect, useRef, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

import { AnalysisRecord } from '../analysisHistory/analysisHistory';
import { isErrorResponse, isPanelNotification } from '../shared/messages';
import { clearApiKeysAndHistory } from '../utils/storage';
import useAnalysisSession from './analysisSession/useAnalysisSession';
import sendMessageToBackground from './chromeBackgroundTransport';
import AnalyzeView from './components/AnalyzeView';
import { Header, SidePanelTab } from './components/Header';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import useHistory from './hooks/useHistory';
import useSettings from './hooks/useSettings';

export default function SidePanelApp(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SidePanelTab>('analyze');
  const [isPinnedGlobal, setIsPinnedGlobal] = useState<boolean>(false);
  const panelContextRef = useRef<{ tabId: number; windowId: number } | null>(
    null
  );

  // Ustawienia (theme, api keys)
  const settingsHook = useSettings();

  // Historia (historia zapisanych wpisów)
  const historyHook = useHistory();

  // Sesja analizy (Film, transkrypcja, podsumowanie, rozmowa, błędy i rewizje operacji)
  const analysisSession = useAnalysisSession({
    onHistoryUpdated: historyHook.loadHistory,
    onRequireSettings: (msg) => {
      setActiveTab('settings');
      analysisSession.setErrorMessage(msg);
    },
  });

  const { loadActiveVideo } = analysisSession;

  // Inicjalizacja side panelu, nasłuchiwanie i sprawdzanie przypięcia
  useEffect(() => {
    const initPanel = async () => {
      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (currentTab?.id) {
        panelContextRef.current = {
          tabId: currentTab.id,
          windowId: currentTab.windowId,
        };
        const response = await sendMessageToBackground({
          type: 'PANEL_INIT',
          tabId: currentTab.id,
        });
        if (response && typeof response.isPinnedGlobal === 'boolean') {
          setIsPinnedGlobal(response.isPinnedGlobal);
        }
      }

      await loadActiveVideo();
    };
    initPanel();
  }, [loadActiveVideo]);

  // Nasłuch na aktualizacje w locie - jak zmienił się URL YouTube
  useEffect(() => {
    const handleRuntimeMessage = (message: unknown): false => {
      if (
        isPanelNotification(message) &&
        message.type === 'YOUTUBE_URL_UPDATED'
      ) {
        loadActiveVideo();
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [loadActiveVideo]);

  const handlePinGlobal = () => {
    const panelContext = panelContextRef.current;
    if (!panelContext) return;

    sendMessageToBackground({ type: 'PIN_GLOBAL', ...panelContext })
      .then((response) => {
        if (!isErrorResponse(response)) {
          setIsPinnedGlobal(true);
        }
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Failed to pin the side panel:', error);
      });
  };

  const handleResumeSession = (item: AnalysisRecord) => {
    analysisSession.handleResumeSession(item);
    setActiveTab('analyze');
  };

  const handleDeleteHistory = async (e: MouseEvent, videoId: string) => {
    const deleted = await historyHook.handleDeleteHistory(e, videoId);
    if (deleted) {
      analysisSession.handleDeleteHistoryCleanup(videoId);
    }
  };

  const handleClearApiKeysAndHistory = async () => {
    if (
      // eslint-disable-next-line no-alert -- intentional user confirmation
      window.confirm(
        'Czy na pewno chcesz usunąć wszystkie klucze API oraz całą historię? Tej operacji nie można cofnąć.'
      )
    ) {
      await clearApiKeysAndHistory();
      settingsHook.clearApiKeyState();
      await historyHook.loadHistory();
      analysisSession.handleClearSession();
    }
  };

  return (
    <div id='my-ext' data-theme={settingsHook.theme}>
      <div className='bg-base-100 relative flex h-dvh w-full flex-col overflow-hidden font-sans'>
        <Header
          activeTab={activeTab}
          theme={settingsHook.theme}
          isPinned={isPinnedGlobal}
          onSelectTab={setActiveTab}
          onPin={handlePinGlobal}
          onToggleTheme={settingsHook.toggleTheme}
        />

        <main className='bg-base-100/95 flex min-h-0 flex-1 flex-col overflow-hidden p-3.5'>
          {analysisSession.errorMessage && (
            <div className='border-warning/30 bg-warning/15 text-base-content mb-3 flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-md'>
              <WarningCircle
                weight='fill'
                className='text-warning mt-0.5 h-5 w-5 shrink-0'
              />
              <span className='font-medium leading-relaxed'>
                {analysisSession.errorMessage}
              </span>
            </div>
          )}

          {activeTab === 'analyze' && (
            <AnalyzeView
              hasAnyKey={settingsHook.hasAnyKey}
              isSearchingVideo={analysisSession.isSearchingVideo}
              currentVideo={analysisSession.currentVideo}
              isLoading={analysisSession.isLoading}
              loadingMessage={analysisSession.loadingMessage}
              summary={analysisSession.summary}
              chatMessages={analysisSession.chatMessages}
              isSendingChat={analysisSession.isSendingChat}
              chatInput={analysisSession.chatInput}
              settings={settingsHook.settings}
              chatListRef={analysisSession.chatListRef}
              onLoadActiveVideo={analysisSession.loadActiveVideo}
              onClearChat={analysisSession.handleClearChat}
              onSendChatMessage={(e) =>
                analysisSession.handleSendChatMessage(
                  e,
                  settingsHook.settings,
                  settingsHook.apiKeys
                )
              }
              onChatInputChange={analysisSession.setChatInput}
              onSummarizeVideo={() =>
                analysisSession.handleSummarizeVideo(
                  settingsHook.settings,
                  settingsHook.apiKeys
                )
              }
              onSetActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              historyList={historyHook.historyList}
              onResumeSession={handleResumeSession}
              onDeleteHistory={handleDeleteHistory}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              selectedProvider={settingsHook.selectedProvider}
              apiKeys={settingsHook.apiKeys}
              apiKeyInput={settingsHook.apiKeyInput}
              showKey={settingsHook.showKey}
              isCheckingKey={settingsHook.isCheckingKey}
              keyValidationMsg={settingsHook.keyValidationMsg}
              settings={settingsHook.settings}
              hasAnyKey={settingsHook.hasAnyKey}
              historyListLength={historyHook.historyList.length}
              onSelectProvider={settingsHook.handleSelectProvider}
              onApiKeyInputChange={settingsHook.setApiKeyInput}
              onToggleShowKey={settingsHook.handleToggleShowKey}
              onSaveApiKey={settingsHook.handleSaveApiKey}
              onDeleteApiKey={settingsHook.handleDeleteApiKey}
              onModelChange={settingsHook.handleModelChange}
              onLanguageChange={settingsHook.handleLanguageChange}
              onClearHistory={historyHook.handleClearHistory}
              onClearApiKeysAndHistory={handleClearApiKeysAndHistory}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export { SidePanelApp as PopupContainer };
