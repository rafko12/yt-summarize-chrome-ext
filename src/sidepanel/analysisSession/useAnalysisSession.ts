import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import createAnalysisHistory, {
  AnalysisHistory,
  AnalysisRecord,
} from '../../analysisHistory/analysisHistory';
import createChromeAnalysisHistoryPlatform from '../../analysisHistory/chromeAnalysisHistoryPlatform';
import { Provider, Settings } from '../../preferences/userPreferences';
import { isErrorResponse } from '../../shared/messages';
import {
  ChatMessage,
  generateChatResponse,
  generateSummary,
  getProvider,
} from '../ai';
import { createYoutube, YoutubeIntegration } from '../youtube';
import {
  analysisSessionReducer,
  initialAnalysisSessionState,
} from './analysisSessionReducer';

export interface UseAnalysisSessionProps {
  youtubePageOverride?: YoutubeIntegration;
  historyOverride?: AnalysisHistory;
  onHistoryUpdated?: () => void;
  onRequireSettings?: (message: string) => void;
}

export default function useAnalysisSession({
  youtubePageOverride,
  historyOverride,
  onHistoryUpdated,
  onRequireSettings,
}: UseAnalysisSessionProps = {}) {
  const [state, dispatch] = useReducer(
    analysisSessionReducer,
    initialAnalysisSessionState
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const chatListRef = useRef<HTMLDivElement>(null);

  const youtubePage = useMemo(
    () => youtubePageOverride || createYoutube(),
    [youtubePageOverride]
  );

  const history = useMemo(
    () =>
      historyOverride ||
      createAnalysisHistory(createChromeAnalysisHistoryPlatform()),
    [historyOverride]
  );

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [state.chatMessages, state.isLoading]);

  const loadActiveVideo =
    useCallback(async (): Promise<AnalysisRecord | null> => {
      dispatch({ type: 'START_SEARCHING' });
      try {
        const activeVideo = await youtubePage.readActiveVideo();
        if (!activeVideo) {
          dispatch({ type: 'SET_ACTIVE_VIDEO', video: null });
          return null;
        }

        const savedHistory = await history.getRecords();
        const existingSession = savedHistory.find(
          (item) => item.videoId === activeVideo.videoId
        );

        if (existingSession) {
          dispatch({
            type: 'RESTORE_SAVED_SESSION',
            video: {
              videoId: existingSession.videoId,
              title: existingSession.title,
              author: existingSession.author,
              thumbnailUrl: existingSession.thumbnailUrl,
            },
            transcript: existingSession.transcript,
            summary: existingSession.summary,
            chat: existingSession.chat || [],
          });
          return existingSession;
        }

        dispatch({ type: 'SET_ACTIVE_VIDEO', video: activeVideo });
        return null;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading video details:', err);
        dispatch({ type: 'STOP_SEARCHING' });
        return null;
      }
    }, [history, youtubePage]);

  const ensureVideoAndTranscript = useCallback(
    async (language: string, onInjecting?: () => void) => {
      let targetVideo = stateRef.current.currentVideo!;

      if (
        stateRef.current.transcript &&
        targetVideo.videoId === stateRef.current.currentVideo?.videoId
      ) {
        return {
          activeTranscript: stateRef.current.transcript,
          targetVideo,
        };
      }

      const activeVideo = await youtubePage.readActiveVideo(targetVideo);

      if (activeVideo && activeVideo.videoId !== targetVideo.videoId) {
        targetVideo = activeVideo;
        dispatch({ type: 'SET_ACTIVE_VIDEO', video: targetVideo });
      }

      const response = await youtubePage.fetchActiveTranscript(
        targetVideo.videoId,
        language === 'Polski' ? 'pl' : 'en',
        { onInjecting }
      );

      if (isErrorResponse(response) || response.transcript.length === 0) {
        throw new Error(
          isErrorResponse(response)
            ? response.error
            : 'Nie udało się pobrać transkrypcji dla tego filmu.'
        );
      }

      dispatch({
        type: 'SET_TRANSCRIPT',
        transcript: response.transcript,
      });

      return {
        activeTranscript: response.transcript,
        targetVideo,
      };
    },
    [youtubePage]
  );

  const handleSummarizeVideo = useCallback(
    async (settings: Settings, apiKeys: Record<Provider, string>) => {
      const { currentVideo } = stateRef.current;
      if (!currentVideo) return;

      const provider = getProvider(settings.model) as Provider;
      const keyToUse = apiKeys[provider];

      if (!keyToUse) {
        onRequireSettings?.(
          'Aby podsumować film, musisz najpierw podać klucz API dla wybranego dostawcy.'
        );
        return;
      }

      const requestRevision = stateRef.current.revision + 1;
      dispatch({
        type: 'START_SUMMARIZATION',
        message: 'Łączenie z odtwarzaczem i pobieranie transkrypcji...',
      });

      try {
        const { activeTranscript, targetVideo } =
          await ensureVideoAndTranscript(settings.language, () =>
            dispatch({
              type: 'SET_LOADING_MESSAGE',
              message:
                'Wstrzykiwanie skryptu na stronę YouTube (jednorazowo)...',
            })
          );

        dispatch({
          type: 'SET_LOADING_MESSAGE',
          message: 'Generowanie podsumowania (może potrwać kilka sekund)...',
        });

        const generatedSummary = await generateSummary(
          keyToUse,
          activeTranscript,
          settings.language,
          settings.model || 'gemini-3.6-flash'
        );

        const activeVideoAfter = await youtubePage.readActiveVideo(targetVideo);
        if (
          !activeVideoAfter ||
          activeVideoAfter.videoId !== targetVideo.videoId
        ) {
          throw new Error(
            'Film został zmieniony podczas generowania. Spróbuj ponownie.'
          );
        }

        if (requestRevision !== stateRef.current.revision) return;

        dispatch({
          type: 'SUMMARIZATION_SUCCESS',
          revision: requestRevision,
          summary: generatedSummary,
        });

        await history.saveRecord({
          videoId: targetVideo.videoId,
          title: targetVideo.title,
          author: targetVideo.author,
          thumbnailUrl: targetVideo.thumbnailUrl,
          summary: generatedSummary,
          transcript: activeTranscript,
          chat: [],
        });

        onHistoryUpdated?.();
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Wystąpił nieoczekiwany błąd podczas podsumowywania.';
        dispatch({
          type: 'SUMMARIZATION_FAILURE',
          revision: requestRevision,
          errorMessage,
        });
      }
    },
    [
      ensureVideoAndTranscript,
      history,
      onHistoryUpdated,
      onRequireSettings,
      youtubePage,
    ]
  );

  const handleSendChatMessage = useCallback(
    async (
      e: FormEvent,
      settings: Settings,
      apiKeys: Record<Provider, string>
    ) => {
      e.preventDefault();
      const {
        currentVideo,
        chatInput,
        isSendingChat,
        transcript,
        chatMessages,
      } = stateRef.current;

      const provider = getProvider(settings.model) as Provider;
      const keyToUse = apiKeys[provider];

      if (!chatInput.trim() || !currentVideo || isSendingChat || !keyToUse) {
        return;
      }

      const userMsgText = chatInput.trim();
      const requestRevision = stateRef.current.revision;
      const userMessage: ChatMessage = { role: 'user', message: userMsgText };

      dispatch({
        type: 'START_CHAT_SEND',
        userMessage,
        showLoading: !transcript,
        loadingMessage:
          'Łączenie z odtwarzaczem i pobieranie transkrypcji do czatu...',
      });

      try {
        const { activeTranscript, targetVideo } =
          await ensureVideoAndTranscript(settings.language, () =>
            dispatch({
              type: 'SET_LOADING_MESSAGE',
              message:
                'Wstrzykiwanie skryptu na stronę YouTube (jednorazowo)...',
            })
          );

        dispatch({ type: 'STOP_CHAT_LOADING' });

        const responseText = await generateChatResponse(
          keyToUse,
          activeTranscript,
          chatMessages,
          userMsgText,
          settings.language,
          settings.model || 'gemini-3.6-flash'
        );

        if (requestRevision !== stateRef.current.revision) return;

        const modelMessage: ChatMessage = {
          role: 'model',
          message: responseText,
        };
        dispatch({
          type: 'CHAT_SUCCESS',
          revision: requestRevision,
          modelMessage,
        });

        const finalChat: ChatMessage[] = [
          ...chatMessages,
          userMessage,
          modelMessage,
        ];
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
            summary: stateRef.current.summary || null,
            transcript: activeTranscript,
            chat: finalChat,
          });
        }

        onHistoryUpdated?.();
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.error(err);
        if (requestRevision !== stateRef.current.revision) return;
        dispatch({
          type: 'CHAT_FAILURE',
          revision: requestRevision,
          errorMessage: `Błąd czatu: ${err instanceof Error ? err.message : 'Nieznany błąd'}`,
        });
      }
    },
    [ensureVideoAndTranscript, history, onHistoryUpdated]
  );

  const handleClearChat = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Wyczyścić rozmowę dla tego filmu?')) {
      dispatch({ type: 'CLEAR_CHAT' });
      if (stateRef.current.currentVideo) {
        history.updateRecordChat(stateRef.current.currentVideo.videoId, []);
      }
    }
  }, [history]);

  const handleResumeSession = useCallback((record: AnalysisRecord) => {
    dispatch({
      type: 'RESTORE_SAVED_SESSION',
      video: {
        videoId: record.videoId,
        title: record.title,
        author: record.author,
        thumbnailUrl: record.thumbnailUrl,
      },
      transcript: record.transcript,
      summary: record.summary,
      chat: record.chat || [],
    });
  }, []);

  const handleDeleteHistoryCleanup = useCallback((videoId: string) => {
    if (stateRef.current.currentVideo?.videoId === videoId) {
      dispatch({ type: 'CLEAR_TRANSCRIPT_AND_ANALYSIS' });
    }
  }, []);

  const handleClearSession = useCallback(() => {
    dispatch({ type: 'CLEAR_SESSION' });
  }, []);

  const setChatInput = useCallback((input: string) => {
    dispatch({ type: 'SET_CHAT_INPUT', input });
  }, []);

  const setErrorMessage = useCallback((errorMessage: string | null) => {
    dispatch({ type: 'SET_ERROR_MESSAGE', errorMessage });
  }, []);

  return {
    ...state,
    chatListRef,
    loadActiveVideo,
    handleSummarizeVideo,
    handleSendChatMessage,
    handleClearChat,
    handleResumeSession,
    handleDeleteHistoryCleanup,
    handleClearSession,
    setChatInput,
    setErrorMessage,
  };
}
