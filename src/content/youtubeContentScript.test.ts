/* @vitest-environment jsdom */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import initializeYoutubeContentScript from './youtubeContentScript';

const { fetchTranscript } = vi.hoisted(() => ({ fetchTranscript: vi.fn() }));
vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: { fetchTranscript },
}));

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  reply: (response?: unknown) => void
) => boolean;

let listener: Listener;

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  document.title = 'Fallback title';
  global.fetch = vi.fn();
  global.chrome = {
    ...chrome,
    runtime: {
      ...chrome.runtime,
      onMessage: {
        addListener: vi.fn((candidate) => {
          listener = candidate as Listener;
        }),
      },
    },
  } as unknown as typeof chrome;
  initializeYoutubeContentScript();
  window.history.replaceState({}, '', '/watch?v=movie');
});

describe('content script messages', () => {
  test('returns video data from the YouTube player response', async () => {
    document.body.innerHTML =
      '<script>var ytInitialPlayerResponse = {"videoDetails":{"videoId":"movie","title":"Movie","author":"Creator","thumbnail":{"thumbnails":[{"url":"small"},{"url":"large"}]}}};</script>';
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_VIDEO_DATA' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({
        success: true,
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'large',
      })
    );
  });

  test('returns a clear error outside a video URL and ignores unknown messages', () => {
    window.history.replaceState({}, '', '/');
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_VIDEO_DATA' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      error: 'Nie jesteś na stronie filmu YouTube.',
    });
    expect(
      listener({ type: 'UNKNOWN' }, {} as chrome.runtime.MessageSender, reply)
    ).toBe(false);
  });

  test('returns an error when video ID is missing in transcript request', () => {
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_TRANSCRIPT', videoId: '', targetLang: 'pl' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      error: 'Brak identyfikatora wideo.',
    });
  });

  test('normalizes transcript durations in milliseconds and uses the fallback language', async () => {
    fetchTranscript
      .mockRejectedValueOnce(new Error('language unavailable'))
      .mockResolvedValueOnce([
        { offset: 60000, duration: 12000, text: 'line' },
      ]);
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_TRANSCRIPT', videoId: 'movie', targetLang: 'pl' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({
        success: true,
        transcript: [{ start: 60, duration: 12, text: 'line' }],
      })
    );
    expect(fetchTranscript).toHaveBeenNthCalledWith(1, 'movie', { lang: 'pl' });
    expect(fetchTranscript).toHaveBeenNthCalledWith(2, 'movie');
  });

  test('preserves transcript durations when already in seconds', async () => {
    fetchTranscript.mockResolvedValueOnce([
      { offset: 15, duration: 3, text: 'line in seconds' },
    ]);
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_TRANSCRIPT', videoId: 'movie', targetLang: 'en' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({
        success: true,
        transcript: [{ start: 15, duration: 3, text: 'line in seconds' }],
      })
    );
  });

  test('reports an error when transcript is empty', async () => {
    fetchTranscript.mockResolvedValueOnce([]);
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_TRANSCRIPT', videoId: 'movie', targetLang: 'en' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({
        error:
          'Transkrypcja jest pusta — film może nie mieć napisów z treścią.',
      })
    );
  });

  test('reports YouTube errors with fallback message', async () => {
    fetchTranscript.mockRejectedValueOnce(new Error('Network error'));
    fetchTranscript.mockRejectedValueOnce(new Error(''));
    const reply = vi.fn();

    expect(
      listener(
        { type: 'GET_TRANSCRIPT', videoId: 'movie', targetLang: 'pl' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(true);

    await vi.waitFor(() =>
      expect(reply).toHaveBeenCalledWith({
        error: 'Nie udało się pobrać napisów z YouTube.',
      })
    );
  });

  test('seeks video player when present and handles missing player', () => {
    const reply = vi.fn();
    const video = document.createElement('video');
    video.play = vi.fn(async () => undefined);
    document.body.appendChild(video);

    expect(
      listener(
        { type: 'SEEK_TO', seconds: 19 },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(false);
    expect(video.currentTime).toBe(19);
    expect(video.play).toHaveBeenCalled();
    expect(reply).toHaveBeenLastCalledWith({ success: true });

    document.body.innerHTML = '';
    expect(
      listener(
        { type: 'SEEK_TO', seconds: 19 },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(false);
    expect(reply).toHaveBeenLastCalledWith({
      error: 'Nie znaleziono odtwarzacza wideo na tej stronie.',
    });
  });
});
