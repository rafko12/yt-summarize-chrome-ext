import { FormEvent, useCallback, useReducer, useRef } from 'react';

import { AnalysisRecord, ConversationMessage } from '../../domain/analysis';
import { isErrorResponse } from '../../messaging';
import { AiClient } from '../ai';
import { AnalysisHistory } from '../history';
import { AiProvider, Settings } from '../preferences';
import { YoutubeIntegration } from '../youtube';
import {
  analysisSessionReducer,
  initialAnalysisSessionState,
} from './analysisSessionReducer';

export interface UseAnalysisSessionProps {
  youtube: YoutubeIntegration;
  history: AnalysisHistory;
  aiClient: AiClient;
  onHistoryUpdated?: () => void;
  onRequireSettings?: (message: string) => void;
}

export default function useAnalysisSession({
  youtube,
  history,
  aiClient,
  onHistoryUpdated,
  onRequireSettings,
}: UseAnalysisSessionProps) {
  const [state, dispatch] = useReducer(
    analysisSessionReducer,
    initialAnalysisSessionState
  );
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadActiveFilm =
    useCallback(async (): Promise<AnalysisRecord | null> => {
      dispatch({ type: 'START_SEARCHING' });
      try {
        const activeFilm = await youtube.readActiveFilm();
        if (!activeFilm) {
          dispatch({ type: 'SET_ACTIVE_FILM', film: null });
          return null;
        }

        const savedHistory = await history.getRecords();
        const existingSession = savedHistory.find(
          (item) => item.videoId === activeFilm.videoId
        );

        if (existingSession) {
          dispatch({
            type: 'RESTORE_SAVED_SESSION',
            film: {
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

        dispatch({ type: 'SET_ACTIVE_FILM', film: activeFilm });
        return null;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error loading video details:', err);
        dispatch({ type: 'STOP_SEARCHING' });
        return null;
      }
    }, [history, youtube]);

  const ensureVideoAndTranscript = useCallback(
    async (language: string, onInjecting?: () => void) => {
      let targetFilm = stateRef.current.currentFilm!;

      if (
        stateRef.current.transcript &&
        targetFilm.videoId === stateRef.current.currentFilm?.videoId
      ) {
        return {
          activeTranscript: stateRef.current.transcript,
          targetFilm,
        };
      }

      const activeFilm = await youtube.readActiveFilm(targetFilm);

      if (activeFilm && activeFilm.videoId !== targetFilm.videoId) {
        targetFilm = activeFilm;
        dispatch({ type: 'SET_ACTIVE_FILM', film: targetFilm });
      }

      const response = await youtube.fetchActiveTranscript(
        targetFilm.videoId,
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
        targetFilm,
      };
    },
    [youtube]
  );

  const handleSummarizeFilm = useCallback(
    async (settings: Settings, apiKeys: Record<AiProvider, string>) => {
      const { currentFilm } = stateRef.current;
      if (!currentFilm) return;

      const provider = aiClient.getProvider(settings.model);
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
        const { activeTranscript, targetFilm } = await ensureVideoAndTranscript(
          settings.language,
          () =>
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

        const generatedSummary = await aiClient.generateSummary(
          keyToUse,
          activeTranscript,
          settings.language,
          settings.model || 'gemini-3.6-flash'
        );

        const activeFilmAfter = await youtube.readActiveFilm(targetFilm);
        if (
          !activeFilmAfter ||
          activeFilmAfter.videoId !== targetFilm.videoId
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
          videoId: targetFilm.videoId,
          title: targetFilm.title,
          author: targetFilm.author,
          thumbnailUrl: targetFilm.thumbnailUrl,
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
      aiClient,
      ensureVideoAndTranscript,
      history,
      onHistoryUpdated,
      onRequireSettings,
      youtube,
    ]
  );

  const handleSendChatMessage = useCallback(
    async (
      e: FormEvent,
      settings: Settings,
      apiKeys: Record<AiProvider, string>
    ) => {
      e.preventDefault();
      const {
        currentFilm,
        chatInput,
        isSendingChat,
        transcript,
        chatMessages,
      } = stateRef.current;

      const provider = aiClient.getProvider(settings.model);
      const keyToUse = apiKeys[provider];

      if (!chatInput.trim() || !currentFilm || isSendingChat || !keyToUse) {
        return;
      }

      const userMsgText = chatInput.trim();
      const requestRevision = stateRef.current.revision;
      const userMessage: ConversationMessage = {
        role: 'user',
        message: userMsgText,
      };

      dispatch({
        type: 'START_CHAT_SEND',
        userMessage,
        showLoading: !transcript,
        loadingMessage:
          'Łączenie z odtwarzaczem i pobieranie transkrypcji do czatu...',
      });

      try {
        const { activeTranscript, targetFilm } = await ensureVideoAndTranscript(
          settings.language,
          () =>
            dispatch({
              type: 'SET_LOADING_MESSAGE',
              message:
                'Wstrzykiwanie skryptu na stronę YouTube (jednorazowo)...',
            })
        );

        dispatch({ type: 'STOP_CHAT_LOADING' });

        const responseText = await aiClient.generateChatResponse(
          keyToUse,
          activeTranscript,
          chatMessages,
          userMsgText,
          settings.language,
          settings.model || 'gemini-3.6-flash'
        );

        if (requestRevision !== stateRef.current.revision) return;

        const modelMessage: ConversationMessage = {
          role: 'model',
          message: responseText,
        };
        dispatch({
          type: 'CHAT_SUCCESS',
          revision: requestRevision,
          modelMessage,
        });

        const finalChat: ConversationMessage[] = [
          ...chatMessages,
          userMessage,
          modelMessage,
        ];

        await history.saveChat({
          videoId: targetFilm.videoId,
          title: targetFilm.title,
          author: targetFilm.author,
          thumbnailUrl: targetFilm.thumbnailUrl,
          summary: stateRef.current.summary || null,
          transcript: activeTranscript,
          chat: finalChat,
        });

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
    [aiClient, ensureVideoAndTranscript, history, onHistoryUpdated]
  );

  const handleClearChat = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (window.confirm('Wyczyścić rozmowę dla tego filmu?')) {
      dispatch({ type: 'CLEAR_CHAT' });
      if (stateRef.current.currentFilm) {
        history.updateRecordChat(stateRef.current.currentFilm.videoId, []);
      }
    }
  }, [history]);

  const handleResumeSession = useCallback((record: AnalysisRecord) => {
    dispatch({
      type: 'RESTORE_SAVED_SESSION',
      film: {
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
    if (stateRef.current.currentFilm?.videoId === videoId) {
      dispatch({ type: 'CLEAR_TRANSCRIPT_AND_ANALYSIS' });
    }
  }, []);

  const handleSeekToTimestamp = useCallback(
    async (seconds: number) => {
      try {
        await youtube.seekToTimestamp(seconds);
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error('Failed to seek player:', error);
      }
    },
    [youtube]
  );

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
    loadActiveFilm,
    handleSummarizeFilm,
    handleSendChatMessage,
    handleSeekToTimestamp,
    handleClearChat,
    handleResumeSession,
    handleDeleteHistoryCleanup,
    handleClearSession,
    setChatInput,
    setErrorMessage,
  };
}
