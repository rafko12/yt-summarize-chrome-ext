import {
  JSX,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { WarningCircle } from '@phosphor-icons/react';

import {
  isBackgroundMessage,
  isErrorResponse,
  sendMessageToBackground,
} from '../shared/messages';
import { clearApiKeysAndHistory, HistoryItem } from '../utils/storage';
import AnalyzeView from './components/AnalyzeView';
import { Header, PopupTab } from './components/Header';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import useChat from './hooks/useChat';
import useHistory from './hooks/useHistory';
import useSettings from './hooks/useSettings';
import useVideoSession from './hooks/useVideoSession';

export default function PopupContainer(): JSX.Element {
  const [activeTab, setActiveTab] = useState<PopupTab>('analyze');
  const [isPinnedGlobal, setIsPinnedGlobal] = useState<boolean>(false);
  const panelContextRef = useRef<{ tabId: number; windowId: number } | null>(
    null
  );
  const resetAnalysisRef = useRef<() => void>(() => undefined);

  // Ustawienia (theme, api keys)
  const settingsHook = useSettings();

  // Historia (historia zapisanych wpisów)
  const historyHook = useHistory();

  // Aktywne wideo (zmiana tabu, nowe id, transkrypcje, ładowanie z content script)
  const handleVideoChanged = useCallback(() => resetAnalysisRef.current(), []);
  const videoHook = useVideoSession({ onVideoChanged: handleVideoChanged });

  // Czat i generowanie podsumowania
  const chatHook = useChat({
    settings: settingsHook.settings,
    apiKeys: settingsHook.apiKeys,
    currentVideo: videoHook.currentVideo,
    transcript: videoHook.transcript,
    ensureVideoAndTranscript: videoHook.ensureVideoAndTranscript,
    onHistoryUpdated: historyHook.loadHistory,
    onRequireSettings: (msg) => {
      setActiveTab('settings');
      chatHook.setErrorMessage(msg);
    },
  });
  const { resetAnalysisState, setChatMessages, setSummary } = chatHook;
  const { loadActiveVideo } = videoHook;
  resetAnalysisRef.current = chatHook.resetAnalysisState;

  const loadAndRestoreSession = useCallback(async () => {
    const sessionToRestore = await loadActiveVideo();
    if (!sessionToRestore) return;

    resetAnalysisState();
    setSummary(sessionToRestore.summary);
    setChatMessages(sessionToRestore.chat || []);
  }, [loadActiveVideo, resetAnalysisState, setChatMessages, setSummary]);

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
        if (!isErrorResponse(response) && 'isPinnedGlobal' in response) {
          setIsPinnedGlobal(response.isPinnedGlobal);
        }
      }

      await loadAndRestoreSession();
    };
    initPanel();
  }, [loadAndRestoreSession]);

  // Update background url change handler in PopupContainer to trigger logic across hooks
  useEffect(() => {
    const handleRuntimeMessage = (message: unknown) => {
      // Nasłuch na aktualizacje w locie - jak zmienił się URL YouTube
      if (
        isBackgroundMessage(message) &&
        message.type === 'YOUTUBE_URL_UPDATED'
      ) {
        loadAndRestoreSession();
      }
    };
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [loadAndRestoreSession]);

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

  const handleResumeSession = (item: HistoryItem) => {
    chatHook.resetAnalysisState();
    videoHook.setCurrentVideo({
      videoId: item.videoId,
      title: item.title,
      author: item.author,
      thumbnailUrl: item.thumbnailUrl,
    });
    videoHook.setTranscript(item.transcript);
    chatHook.setSummary(item.summary);
    chatHook.setChatMessages(item.chat || []);
    setActiveTab('analyze');
  };

  const handleDeleteHistory = async (e: MouseEvent, videoId: string) => {
    const deleted = await historyHook.handleDeleteHistory(e, videoId);
    if (deleted && videoHook.currentVideo?.videoId === videoId) {
      chatHook.resetAnalysisState();
      videoHook.setTranscript(null);
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
      chatHook.resetAnalysisState();
      videoHook.setTranscript(null);
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
          {chatHook.errorMessage && (
            <div className='border-warning/30 bg-warning/15 text-base-content mb-3 flex items-start gap-2.5 rounded-xl border p-3 text-xs shadow-md'>
              <WarningCircle
                weight='fill'
                className='text-warning mt-0.5 h-5 w-5 shrink-0'
              />
              <span className='font-medium leading-relaxed'>
                {chatHook.errorMessage}
              </span>
            </div>
          )}

          {activeTab === 'analyze' && (
            <AnalyzeView
              hasAnyKey={settingsHook.hasAnyKey}
              isSearchingVideo={videoHook.isSearchingVideo}
              currentVideo={videoHook.currentVideo}
              isLoading={chatHook.isLoading}
              loadingMessage={chatHook.loadingMessage}
              summary={chatHook.summary}
              chatMessages={chatHook.chatMessages}
              isSendingChat={chatHook.isSendingChat}
              chatInput={chatHook.chatInput}
              settings={settingsHook.settings}
              chatListRef={chatHook.chatListRef}
              onLoadActiveVideo={loadAndRestoreSession}
              onClearChat={chatHook.handleClearChat}
              onSendChatMessage={chatHook.handleSendChatMessage}
              onChatInputChange={chatHook.setChatInput}
              onSummarizeVideo={chatHook.handleSummarizeVideo}
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
