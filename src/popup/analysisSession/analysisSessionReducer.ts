import {
  AnalysisSessionAction,
  AnalysisSessionState,
} from './analysisSessionTypes';

export const initialAnalysisSessionState: AnalysisSessionState = {
  currentVideo: null,
  transcript: null,
  summary: null,
  chatMessages: [],
  chatInput: '',
  isSearchingVideo: false,
  isLoading: false,
  loadingMessage: '',
  isSendingChat: false,
  errorMessage: null,
  revision: 0,
};

export function analysisSessionReducer(
  state: AnalysisSessionState,
  action: AnalysisSessionAction
): AnalysisSessionState {
  switch (action.type) {
    case 'START_SEARCHING':
      return {
        ...state,
        isSearchingVideo: true,
        errorMessage: null,
      };

    case 'STOP_SEARCHING':
      return {
        ...state,
        isSearchingVideo: false,
      };

    case 'SET_ACTIVE_VIDEO':
      return {
        ...state,
        currentVideo: action.video,
        transcript: null,
        summary: null,
        chatMessages: [],
        chatInput: '',
        isLoading: false,
        loadingMessage: '',
        isSendingChat: false,
        errorMessage: null,
        isSearchingVideo: false,
        revision: state.revision + 1,
      };

    case 'RESTORE_SAVED_SESSION':
      return {
        ...state,
        currentVideo: action.video,
        transcript: action.transcript,
        summary: action.summary,
        chatMessages: action.chat,
        chatInput: '',
        isLoading: false,
        loadingMessage: '',
        isSendingChat: false,
        errorMessage: null,
        isSearchingVideo: false,
        revision: state.revision + 1,
      };

    case 'START_SUMMARIZATION':
      return {
        ...state,
        isLoading: true,
        loadingMessage: action.message,
        errorMessage: null,
        revision: state.revision + 1,
      };

    case 'SET_LOADING_MESSAGE':
      return {
        ...state,
        loadingMessage: action.message,
      };

    case 'SET_TRANSCRIPT':
      return {
        ...state,
        transcript: action.transcript,
      };

    case 'SUMMARIZATION_SUCCESS':
      if (action.revision !== state.revision) {
        return state;
      }
      return {
        ...state,
        summary: action.summary,
        chatMessages: [],
        isLoading: false,
        loadingMessage: '',
        errorMessage: null,
      };

    case 'SUMMARIZATION_FAILURE':
      if (action.revision !== state.revision) {
        return state;
      }
      return {
        ...state,
        errorMessage: action.errorMessage,
        isLoading: false,
        loadingMessage: '',
      };

    case 'START_CHAT_SEND':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.userMessage],
        chatInput: '',
        isSendingChat: true,
        isLoading: action.showLoading ? true : state.isLoading,
        loadingMessage: action.showLoading
          ? action.loadingMessage
          : state.loadingMessage,
      };

    case 'STOP_CHAT_LOADING':
      return {
        ...state,
        isLoading: false,
      };

    case 'CHAT_SUCCESS':
      if (action.revision !== state.revision) {
        return {
          ...state,
          isSendingChat: false,
          isLoading: false,
        };
      }
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.modelMessage],
        isSendingChat: false,
        isLoading: false,
      };

    case 'CHAT_FAILURE':
      return {
        ...state,
        chatMessages: [
          ...state.chatMessages,
          { role: 'model', message: action.errorMessage },
        ],
        isSendingChat: false,
        isLoading: false,
      };

    case 'SET_CHAT_INPUT':
      return {
        ...state,
        chatInput: action.input,
      };

    case 'CLEAR_CHAT':
      return {
        ...state,
        chatMessages: [],
      };

    case 'CLEAR_TRANSCRIPT_AND_ANALYSIS':
      return {
        ...state,
        transcript: null,
        summary: null,
        chatMessages: [],
        chatInput: '',
        isLoading: false,
        loadingMessage: '',
        isSendingChat: false,
        errorMessage: null,
        revision: state.revision + 1,
      };

    case 'CLEAR_SESSION':
      return {
        ...state,
        currentVideo: null,
        transcript: null,
        summary: null,
        chatMessages: [],
        chatInput: '',
        isLoading: false,
        loadingMessage: '',
        isSendingChat: false,
        errorMessage: null,
        isSearchingVideo: false,
        revision: state.revision + 1,
      };

    case 'SET_ERROR_MESSAGE':
      return {
        ...state,
        errorMessage: action.errorMessage,
      };

    default:
      return state;
  }
}
