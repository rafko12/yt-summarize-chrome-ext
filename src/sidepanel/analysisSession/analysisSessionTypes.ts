import { ChatMessage, TranscriptItem } from '../../llm/types';
import { VideoSession } from '../../shared/video';

export interface AnalysisSessionState {
  currentVideo: VideoSession | null;
  transcript: TranscriptItem[] | null;
  summary: string | null;
  chatMessages: ChatMessage[];
  chatInput: string;
  isSearchingVideo: boolean;
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
      type: 'SET_ACTIVE_VIDEO';
      video: VideoSession | null;
    }
  | {
      type: 'RESTORE_SAVED_SESSION';
      video: VideoSession;
      transcript: TranscriptItem[];
      summary: string | null;
      chat: ChatMessage[];
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
      transcript: TranscriptItem[];
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
      userMessage: ChatMessage;
      showLoading: boolean;
      loadingMessage: string;
    }
  | {
      type: 'STOP_CHAT_LOADING';
    }
  | {
      type: 'CHAT_SUCCESS';
      revision: number;
      modelMessage: ChatMessage;
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
