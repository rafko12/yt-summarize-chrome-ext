import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import createAnalysisHistory, {
  AnalysisHistory,
} from '../../analysisHistory/analysisHistory';
import createChromeAnalysisHistoryPlatform from '../../analysisHistory/chromeAnalysisHistoryPlatform';
import {
  generateChatResponse,
  generateSummary,
  getProvider,
} from '../../llm/client';
import { ChatMessage, TranscriptItem } from '../../llm/types';
import { Provider, Settings } from '../../preferences/userPreferences';
import { VideoSession } from '../../shared/video';

interface UseChatProps {
  settings: Settings;
  apiKeys: Record<Provider, string>;
  currentVideo: VideoSession | null;
  transcript: TranscriptItem[] | null;
  ensureVideoAndTranscript: (
    language: string,
    onInjecting?: () => void
  ) => Promise<{
    activeTranscript: TranscriptItem[];
    targetVideo: VideoSession;
  }>;
  onHistoryUpdated: () => void;
  onRequireSettings: (msg: string) => void;
  historyOverride?: AnalysisHistory;
}

export default function useChat({
  settings,
  apiKeys,
  currentVideo,
  transcript,
  ensureVideoAndTranscript,
  onHistoryUpdated,
  onRequireSettings,
  historyOverride,
}: UseChatProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [chatInput, setChatInput] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const history = useMemo(
    () =>
      historyOverride ||
      createAnalysisHistory(createChromeAnalysisHistoryPlatform()),
    [historyOverride]
  );

  const chatListRef = useRef<HTMLDivElement>(null);
  const analysisRevision = useRef(0);

  // Scroll to bottom of chat container when new message arrives
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages, isLoading]);

  const resetAnalysisState = useCallback(() => {
    analysisRevision.current += 1;
    setSummary(null);
    setChatMessages([]);
    setChatInput('');
    setIsLoading(false);
    setIsSendingChat(false);
    setLoadingMessage('');
    setErrorMessage(null);
  }, []);

  const handleSummarizeVideo = async () => {
    if (!currentVideo) return;

    const provider = getProvider(settings.model) as Provider;
    const keyToUse = apiKeys[provider];

    if (!keyToUse) {
      onRequireSettings(
        'Aby podsumować film, musisz najpierw podać klucz API dla wybranego dostawcy.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingMessage('Łączenie z odtwarzaczem i pobieranie transkrypcji...');
    analysisRevision.current += 1;
    const requestRevision = analysisRevision.current;

    try {
      const { activeTranscript, targetVideo } = await ensureVideoAndTranscript(
        settings.language,
        () =>
          setLoadingMessage(
            'Wstrzykiwanie skryptu na stronę YouTube (jednorazowo)...'
          )
      );

      setLoadingMessage(
        'Generowanie podsumowania (może potrwać kilka sekund)...'
      );
      const generatedSummary = await generateSummary(
        keyToUse,
        activeTranscript,
        settings.language,
        settings.model || 'gemini-3.6-flash'
      );

      const [currentTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const currentUrl = new URL(currentTab?.url || '');
      if (currentUrl.searchParams.get('v') !== targetVideo.videoId) {
        throw new Error(
          'Film został zmieniony podczas generowania. Spróbuj ponownie.'
        );
      }
      if (requestRevision !== analysisRevision.current) return;

      setSummary(generatedSummary);
      setChatMessages([]);

      await history.saveRecord({
        videoId: targetVideo.videoId,
        title: targetVideo.title,
        author: targetVideo.author,
        thumbnailUrl: targetVideo.thumbnailUrl,
        summary: generatedSummary,
        transcript: activeTranscript,
        chat: [],
      });
      onHistoryUpdated();
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Wystąpił nieoczekiwany błąd podczas podsumowywania.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChatMessage = async (e: FormEvent) => {
    e.preventDefault();
    const provider = getProvider(settings.model) as Provider;
    const keyToUse = apiKeys[provider];

    if (!chatInput.trim() || !currentVideo || isSendingChat || !keyToUse)
      return;

    const userMsgText = chatInput.trim();
    analysisRevision.current += 1;
    const requestRevision = analysisRevision.current;
    setChatInput('');

    const updatedChat: ChatMessage[] = [
      ...chatMessages,
      { role: 'user', message: userMsgText },
    ];
    setChatMessages(updatedChat);
    setIsSendingChat(true);

    if (!transcript) {
      setIsLoading(true);
      setLoadingMessage(
        'Łączenie z odtwarzaczem i pobieranie transkrypcji do czatu...'
      );
    }

    try {
      const { activeTranscript, targetVideo } = await ensureVideoAndTranscript(
        settings.language,
        () =>
          setLoadingMessage(
            'Wstrzykiwanie skryptu na stronę YouTube (jednorazowo)...'
          )
      );

      if (isLoading) {
        setIsLoading(false);
      }

      const responseText = await generateChatResponse(
        keyToUse,
        activeTranscript,
        chatMessages,
        userMsgText,
        settings.language,
        settings.model || 'gemini-3.6-flash'
      );
      if (requestRevision !== analysisRevision.current) return;

      const finalChat: ChatMessage[] = [
        ...updatedChat,
        { role: 'model', message: responseText },
      ];
      setChatMessages(finalChat);

      const currentHistory = await history.getRecords();
      const existingItem = currentHistory.find(
        (i) => i.videoId === targetVideo.videoId
      );

      if (existingItem) {
        await history.updateRecordChat(targetVideo.videoId, finalChat);
      } else {
        await history.saveRecord({
          videoId: targetVideo.videoId,
          title: targetVideo.title,
          author: targetVideo.author,
          thumbnailUrl: targetVideo.thumbnailUrl,
          summary: summary || null,
          transcript: activeTranscript,
          chat: finalChat,
        });
      }
      onHistoryUpdated();
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error(err);
      if (isLoading) setIsLoading(false);
      setChatMessages([
        ...updatedChat,
        {
          role: 'model',
          message: `Błąd czatu: ${err instanceof Error ? err.message : 'Nieznany błąd'}`,
        },
      ]);
    } finally {
      setIsSendingChat(false);
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Wyczyścić rozmowę dla tego filmu?')) {
      setChatMessages([]);
      if (currentVideo) {
        history.updateRecordChat(currentVideo.videoId, []);
      }
    }
  };

  return {
    summary,
    setSummary,
    chatMessages,
    setChatMessages,
    isLoading,
    setIsLoading,
    loadingMessage,
    chatInput,
    setChatInput,
    isSendingChat,
    errorMessage,
    setErrorMessage,
    chatListRef,
    resetAnalysisState,
    handleSummarizeVideo,
    handleSendChatMessage,
    handleClearChat,
  };
}
