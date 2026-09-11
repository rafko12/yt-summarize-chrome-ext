import {
  ConversationMessage,
  Film,
  TranscriptSegment,
} from '../../domain/analysis';

export interface AnalysisSessionState {
  currentFilm: Film | null;
  transcript: TranscriptSegment[] | null;
  summary: string | null;
  chatMessages: ConversationMessage[];
  chatInput: string;
  isSearchingFilm: boolean;
  isLoading: boolean;
  loadingMessage: string;
  isSendingChat: boolean;
  errorMessage: string | null;
  revision: number;
}

export type AnalysisSessionAction =
  | { type: 'START_SEARCHING' }
  | { type: 'STOP_SEARCHING' }
  | {
      type: 'SET_ACTIVE_FILM';
      film: Film | null;
    }
  | {
      type: 'RESTORE_SAVED_SESSION';
      film: Film;
      transcript: TranscriptSegment[];
      summary: string | null;
      chat: ConversationMessage[];
    }
  | {
      type: 'START_SUMMARIZATION';
      message: string;
    }
  | {
      type: 'SET_LOADING_MESSAGE';
      message: string;
    }
  | {
      type: 'SET_TRANSCRIPT';
      transcript: TranscriptSegment[];
    }
  | {
      type: 'SUMMARIZATION_SUCCESS';
      revision: number;
      summary: string;
    }
  | {
      type: 'SUMMARIZATION_FAILURE';
      revision: number;
      errorMessage: string;
    }
  | {
      type: 'START_CHAT_SEND';
      userMessage: ConversationMessage;
      showLoading: boolean;
      loadingMessage: string;
    }
  | {
      type: 'STOP_CHAT_LOADING';
    }
  | {
      type: 'CHAT_SUCCESS';
      revision: number;
      modelMessage: ConversationMessage;
    }
  | {
      type: 'CHAT_FAILURE';
      revision: number;
      errorMessage: string;
    }
  | {
      type: 'SET_CHAT_INPUT';
      input: string;
    }
  | {
      type: 'CLEAR_CHAT';
    }
  | {
      type: 'CLEAR_TRANSCRIPT_AND_ANALYSIS';
    }
  | {
      type: 'CLEAR_SESSION';
    }
  | {
      type: 'SET_ERROR_MESSAGE';
      errorMessage: string | null;
    };
