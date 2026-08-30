/* @vitest-environment jsdom */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import initializeContentScript from './Content';

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
  initializeContentScript();
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

  test('normalizes transcript durations and uses the fallback language', async () => {
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

  test('reports transcript failures and handles player seeking synchronously', async () => {
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
      expect(reply).toHaveBeenCalledWith({ error: expect.any(String) })
    );

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
    expect(reply).toHaveBeenLastCalledWith({ success: true });

    document.body.innerHTML = '';
    expect(
      listener(
        { type: 'SEEK_TO', seconds: 19 },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toBe(false);
    expect(reply).toHaveBeenLastCalledWith({ error: expect.any(String) });
  });
});
