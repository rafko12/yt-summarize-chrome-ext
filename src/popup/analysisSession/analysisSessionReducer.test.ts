import { describe, expect, it } from 'vitest';

import {
  analysisSessionReducer,
  initialAnalysisSessionState,
} from './analysisSessionReducer';
import { AnalysisSessionState } from './analysisSessionTypes';

describe('analysisSessionReducer', () => {
  const sampleVideo = {
    videoId: 'vid1',
    title: 'Test Video',
    author: 'Author',
    thumbnailUrl: 'https://example.com/thumb.jpg',
  };

  const sampleTranscript = [{ start: 0, duration: 2, text: 'Hello' }];

  it('handles START_SEARCHING and STOP_SEARCHING', () => {
    const searching = analysisSessionReducer(initialAnalysisSessionState, {
      type: 'START_SEARCHING',
    });
    expect(searching.isSearchingVideo).toBe(true);
    expect(searching.errorMessage).toBeNull();

    const stopped = analysisSessionReducer(searching, {
      type: 'STOP_SEARCHING',
    });
    expect(stopped.isSearchingVideo).toBe(false);
  });

  it('handles SET_ACTIVE_VIDEO with atomic reset and revision increment', () => {
    const dirtyState: AnalysisSessionState = {
      ...initialAnalysisSessionState,
      summary: 'Old summary',
      chatMessages: [{ role: 'user', message: 'Old question' }],
      chatInput: 'Draft',
      isLoading: true,
      loadingMessage: 'Old message',
      errorMessage: 'Old error',
      revision: 3,
    };

    const next = analysisSessionReducer(dirtyState, {
      type: 'SET_ACTIVE_VIDEO',
      video: sampleVideo,
    });

    expect(next.currentVideo).toEqual(sampleVideo);
    expect(next.transcript).toBeNull();
    expect(next.summary).toBeNull();
    expect(next.chatMessages).toEqual([]);
    expect(next.chatInput).toBe('');
    expect(next.isLoading).toBe(false);
    expect(next.loadingMessage).toBe('');
    expect(next.errorMessage).toBeNull();
    expect(next.revision).toBe(4);
  });

  it('handles RESTORE_SAVED_SESSION with atomic state restoration and revision increment', () => {
    const dirtyState: AnalysisSessionState = {
      ...initialAnalysisSessionState,
      summary: 'Old summary',
      chatMessages: [{ role: 'user', message: 'Old chat' }],
      revision: 2,
    };

    const next = analysisSessionReducer(dirtyState, {
      type: 'RESTORE_SAVED_SESSION',
      video: sampleVideo,
      transcript: sampleTranscript,
      summary: 'Restored summary',
      chat: [{ role: 'user', message: 'Saved question' }],
    });

    expect(next.currentVideo).toEqual(sampleVideo);
    expect(next.transcript).toEqual(sampleTranscript);
    expect(next.summary).toBe('Restored summary');
    expect(next.chatMessages).toEqual([
      { role: 'user', message: 'Saved question' },
    ]);
    expect(next.revision).toBe(3);
  });

  it('handles START_SUMMARIZATION, SET_LOADING_MESSAGE, SET_TRANSCRIPT, and SUMMARIZATION_SUCCESS', () => {
    const start = analysisSessionReducer(initialAnalysisSessionState, {
      type: 'START_SUMMARIZATION',
      message: 'Loading transcript...',
    });
    expect(start.isLoading).toBe(true);
    expect(start.loadingMessage).toBe('Loading transcript...');
    expect(start.revision).toBe(1);

    const msgUpdated = analysisSessionReducer(start, {
      type: 'SET_LOADING_MESSAGE',
      message: 'Generating summary...',
    });
    expect(msgUpdated.loadingMessage).toBe('Generating summary...');

    const transcriptSet = analysisSessionReducer(msgUpdated, {
      type: 'SET_TRANSCRIPT',
      transcript: sampleTranscript,
    });
    expect(transcriptSet.transcript).toEqual(sampleTranscript);

    // Mismatched revision should be ignored
    const ignoredSuccess = analysisSessionReducer(transcriptSet, {
      type: 'SUMMARIZATION_SUCCESS',
      revision: 999,
      summary: 'Ignored summary',
    });
    expect(ignoredSuccess.summary).toBeNull();
    expect(ignoredSuccess.isLoading).toBe(true);

    // Matching revision succeeds
    const success = analysisSessionReducer(transcriptSet, {
      type: 'SUMMARIZATION_SUCCESS',
      revision: 1,
      summary: 'Fresh summary',
    });
    expect(success.summary).toBe('Fresh summary');
    expect(success.isLoading).toBe(false);
    expect(success.loadingMessage).toBe('');
    expect(success.errorMessage).toBeNull();
  });

  it('handles SUMMARIZATION_FAILURE with revision matching', () => {
    const start = analysisSessionReducer(initialAnalysisSessionState, {
      type: 'START_SUMMARIZATION',
      message: 'Loading...',
    });
    expect(start.revision).toBe(1);

    const ignoredFailure = analysisSessionReducer(start, {
      type: 'SUMMARIZATION_FAILURE',
      revision: 999,
      errorMessage: 'Ignored error',
    });
    expect(ignoredFailure.errorMessage).toBeNull();
    expect(ignoredFailure.isLoading).toBe(true);

    const failure = analysisSessionReducer(start, {
      type: 'SUMMARIZATION_FAILURE',
      revision: 1,
      errorMessage: 'AI error occurred',
    });
    expect(failure.errorMessage).toBe('AI error occurred');
    expect(failure.isLoading).toBe(false);
    expect(failure.loadingMessage).toBe('');
  });

  it('handles START_CHAT_SEND, STOP_CHAT_LOADING, CHAT_SUCCESS, and CHAT_FAILURE', () => {
    const sendingWithLoading = analysisSessionReducer(
      initialAnalysisSessionState,
      {
        type: 'START_CHAT_SEND',
        userMessage: { role: 'user', message: 'Hello AI' },
        showLoading: true,
        loadingMessage: 'Loading transcript for chat...',
      }
    );
    expect(sendingWithLoading.chatMessages).toEqual([
      { role: 'user', message: 'Hello AI' },
    ]);
    expect(sendingWithLoading.isSendingChat).toBe(true);
    expect(sendingWithLoading.isLoading).toBe(true);
    expect(sendingWithLoading.loadingMessage).toBe(
      'Loading transcript for chat...'
    );

    const stopLoading = analysisSessionReducer(sendingWithLoading, {
      type: 'STOP_CHAT_LOADING',
    });
    expect(stopLoading.isLoading).toBe(false);

    // Outdated revision in chat success resets sending flag without adding message
    const outdatedSuccess = analysisSessionReducer(stopLoading, {
      type: 'CHAT_SUCCESS',
      revision: 999,
      modelMessage: { role: 'model', message: 'Outdated reply' },
    });
    expect(outdatedSuccess.isSendingChat).toBe(false);
    expect(outdatedSuccess.chatMessages).toHaveLength(1);

    // Matching revision adds reply
    const matchingSuccess = analysisSessionReducer(stopLoading, {
      type: 'CHAT_SUCCESS',
      revision: 0,
      modelMessage: { role: 'model', message: 'Valid reply' },
    });
    expect(matchingSuccess.isSendingChat).toBe(false);
    expect(matchingSuccess.chatMessages).toEqual([
      { role: 'user', message: 'Hello AI' },
      { role: 'model', message: 'Valid reply' },
    ]);

    // Chat failure adds error chat message
    const chatFail = analysisSessionReducer(stopLoading, {
      type: 'CHAT_FAILURE',
      revision: 0,
      errorMessage: 'Network error',
    });
    expect(chatFail.isSendingChat).toBe(false);
    expect(chatFail.chatMessages).toEqual([
      { role: 'user', message: 'Hello AI' },
      { role: 'model', message: 'Network error' },
    ]);
  });

  it('handles SET_CHAT_INPUT, CLEAR_CHAT, CLEAR_TRANSCRIPT_AND_ANALYSIS, CLEAR_SESSION, and SET_ERROR_MESSAGE', () => {
    const inputSet = analysisSessionReducer(initialAnalysisSessionState, {
      type: 'SET_CHAT_INPUT',
      input: 'Typing...',
    });
    expect(inputSet.chatInput).toBe('Typing...');

    const chatCleared = analysisSessionReducer(
      {
        ...inputSet,
        chatMessages: [{ role: 'user', message: 'Msg' }],
      },
      { type: 'CLEAR_CHAT' }
    );
    expect(chatCleared.chatMessages).toEqual([]);

    const transcriptCleared = analysisSessionReducer(
      {
        ...chatCleared,
        currentVideo: sampleVideo,
        transcript: sampleTranscript,
        summary: 'Some summary',
        revision: 2,
      },
      { type: 'CLEAR_TRANSCRIPT_AND_ANALYSIS' }
    );
    expect(transcriptCleared.currentVideo).toEqual(sampleVideo);
    expect(transcriptCleared.transcript).toBeNull();
    expect(transcriptCleared.summary).toBeNull();
    expect(transcriptCleared.revision).toBe(3);

    const sessionCleared = analysisSessionReducer(transcriptCleared, {
      type: 'CLEAR_SESSION',
    });
    expect(sessionCleared.currentVideo).toBeNull();
    expect(sessionCleared.revision).toBe(4);

    const errorSet = analysisSessionReducer(sessionCleared, {
      type: 'SET_ERROR_MESSAGE',
      errorMessage: 'Custom error',
    });
    expect(errorSet.errorMessage).toBe('Custom error');
  });

  it('returns unchanged state for unknown action type', () => {
    const unchanged = analysisSessionReducer(
      initialAnalysisSessionState,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: 'UNKNOWN_ACTION' } as any
    );
    expect(unchanged).toBe(initialAnalysisSessionState);
  });
});
