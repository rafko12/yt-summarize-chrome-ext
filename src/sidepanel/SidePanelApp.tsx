import { JSX, useEffect, useRef, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';

import { AnalysisRecord } from '../domain/analysis';
import { isErrorResponse } from '../messaging';
import { AnalyzeView, useAnalysisSession } from './analysis';
import { SidePanelDependencies } from './dependencies';
import { HistoryView, useAnalysisHistory } from './history';
import { SidePanelContext } from './runtime';
import { clearUserData, SettingsView, useSettings } from './settings';
import { Header, SidePanelTab, useDocumentTheme } from './shell';

export interface SidePanelAppProps {
  dependencies: SidePanelDependencies;
}

export default function SidePanelApp({
  dependencies,
}: SidePanelAppProps): JSX.Element {
  const { settings, history, youtube, aiClient, runtime } = dependencies;
  const [activeTab, setActiveTab] = useState<SidePanelTab>('analyze');
  const [isPinnedGlobal, setIsPinnedGlobal] = useState<boolean>(false);
  const panelContextRef = useRef<SidePanelContext | null>(null);

  // Ustawienia (theme, api keys)
  const settingsHook = useSettings({ settings, aiClient });
  useDocumentTheme(settingsHook.theme);

  // Historia analiz (zapisane analizy użytkownika)
  const historyHook = useAnalysisHistory({ history });

  // Sesja analizy (Film, transkrypcja, podsumowanie, rozmowa, błędy i rewizje operacji)
  const analysisSession = useAnalysisSession({
    youtube,
    history,
    aiClient,
    onHistoryUpdated: historyHook.loadHistory,
    onRequireSettings: (msg) => {
      setActiveTab('settings');
      analysisSession.setErrorMessage(msg);
    },
  });

  const { loadActiveFilm } = analysisSession;

  // Inicjalizacja side panelu, nasłuchiwanie i sprawdzanie przypięcia
  useEffect(() => {
    const initPanel = async () => {
      const panelContext = await runtime.getContext();
      if (panelContext) {
        panelContextRef.current = panelContext;
        const response = await runtime.initialize(panelContext.tabId);
        if (response && typeof response.isPinnedGlobal === 'boolean') {
          setIsPinnedGlobal(response.isPinnedGlobal);
        }
      }

      await loadActiveFilm();
    };
    initPanel();
  }, [loadActiveFilm, runtime]);

  // Nasłuch na aktualizacje w locie - jak zmienił się URL YouTube
  useEffect(
    () =>
      runtime.subscribeNotifications((notification) => {
        if (notification.type === 'YOUTUBE_URL_UPDATED') {
          loadActiveFilm();
        }
      }),
    [loadActiveFilm, runtime]
  );

  const handlePinGlobal = () => {
    const panelContext = panelContextRef.current;
    if (!panelContext) return;

    runtime
      .requestGlobalPin(panelContext)
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

  const handleDeleteHistory = async (videoId: string) => {
    // eslint-disable-next-line no-alert -- intentional user confirmation
    if (window.confirm('Czy chcesz usunąć to podsumowanie z historii?')) {
      await historyHook.deleteRecord(videoId);
      analysisSession.handleDeleteHistoryCleanup(videoId);
    }
  };

  const handleClearHistory = async () => {
    if (
      // eslint-disable-next-line no-alert -- intentional user confirmation
      window.confirm('Czy na pewno chcesz usunąć całą historię podsumowań?')
    ) {
      await historyHook.clearRecords();
    }
  };

  const handleClearApiKeysAndHistory = async () => {
    if (
      // eslint-disable-next-line no-alert -- intentional user confirmation
      window.confirm(
        'Czy na pewno chcesz usunąć wszystkie klucze API oraz całą historię? Tej operacji nie można cofnąć.'
      )
    ) {
      await clearUserData({
        settings: settingsHook,
        history: historyHook,
      });
      settingsHook.clearApiKeyState();
      await historyHook.loadHistory();
      analysisSession.handleClearSession();
    }
  };

  const handleClearChat = () => {
    // eslint-disable-next-line no-alert -- intentional user confirmation
    if (window.confirm('Wyczyścić rozmowę dla tego filmu?')) {
      analysisSession.handleClearChat();
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
              isSearchingFilm={analysisSession.isSearchingFilm}
              currentFilm={analysisSession.currentFilm}
              isLoading={analysisSession.isLoading}
              loadingMessage={analysisSession.loadingMessage}
              summary={analysisSession.summary}
              chatMessages={analysisSession.chatMessages}
              isSendingChat={analysisSession.isSendingChat}
              chatInput={analysisSession.chatInput}
              settings={settingsHook.settings}
              onLoadActiveFilm={analysisSession.loadActiveFilm}
              onClearChat={handleClearChat}
              onSendChatMessage={() =>
                analysisSession.handleSendChatMessage(
                  settingsHook.settings,
                  settingsHook.apiKeys
                )
              }
              onChatInputChange={analysisSession.setChatInput}
              onSummarizeFilm={() =>
                analysisSession.handleSummarizeFilm(
                  settingsHook.settings,
                  settingsHook.apiKeys
                )
              }
              onSetActiveTab={setActiveTab}
              onSeekTimestamp={analysisSession.handleSeekToTimestamp}
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
              onClearHistory={handleClearHistory}
              onClearApiKeysAndHistory={handleClearApiKeysAndHistory}
            />
          )}
        </main>
      </div>
    </div>
  );
}
