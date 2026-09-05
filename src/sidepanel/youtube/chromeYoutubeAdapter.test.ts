import { beforeEach, describe, expect, test, vi } from 'vitest';

import createChromeYoutubeAdapter from './chromeYoutubeAdapter';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chrome.runtime.getManifest).mockReturnValue({
    content_scripts: [{ js: ['content.js'] }],
  } as unknown as chrome.runtime.Manifest);
  vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true });
  global.chrome = {
    ...chrome,
    scripting: {
      executeScript: vi.fn(async () => undefined),
    },
    tabs: {
      ...chrome.tabs,
      query: vi.fn(async () => [
        {
          id: 42,
          title: 'Sample Video',
          url: 'https://www.youtube.com/watch?v=sample',
        },
      ]),
      sendMessage: vi.fn(async () => ({ success: true })),
    },
  } as unknown as typeof chrome;
});

describe('chromeYoutubeAdapter', () => {
  test('returns the active tab from chrome.tabs.query', async () => {
    const adapter = createChromeYoutubeAdapter();
    const tab = await adapter.getActiveTab();

    expect(tab).toEqual({
      id: 42,
      title: 'Sample Video',
      url: 'https://www.youtube.com/watch?v=sample',
    });
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
  });

  test('sends a video-data request to the tab', async () => {
    const adapter = createChromeYoutubeAdapter();
    const videoData = {
      success: true as const,
      videoId: 'movie',
      title: 'Movie',
      author: 'Creator',
      thumbnailUrl: 'thumbnail',
    };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(videoData);

    const result = await adapter.getVideoData(7);
    expect(result).toEqual(videoData);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: 'GET_VIDEO_DATA',
    });
  });

  test('sends a get-transcript request with options', async () => {
    const adapter = createChromeYoutubeAdapter();
    const transcriptData = {
      success: true as const,
      transcript: [{ start: 0, duration: 2, text: 'Hello' }],
    };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(transcriptData);

    const result = await adapter.getTranscript(7, 'vid123', 'pl');
    expect(result).toEqual(transcriptData);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: 'GET_TRANSCRIPT',
      videoId: 'vid123',
      targetLang: 'pl',
    });
  });

  test('sends a seek-to request', async () => {
    const adapter = createChromeYoutubeAdapter();
    const seekResult = { success: true as const };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(seekResult);

    const result = await adapter.seekTo(7, 42);
    expect(result).toEqual(seekResult);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: 'SEEK_TO',
      seconds: 42,
    });
  });

  test('reinserts the content script after a missing receiver and retries', async () => {
    const adapter = createChromeYoutubeAdapter();
    vi.mocked(chrome.tabs.sendMessage)
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ success: true });

    await expect(adapter.seekTo(7, 42)).resolves.toEqual({ success: true });

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content.js'],
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  test('calls onInjecting callback when retry occurs in getTranscript', async () => {
    const adapter = createChromeYoutubeAdapter();
    const onInjecting = vi.fn();
    vi.mocked(chrome.tabs.sendMessage)
      .mockRejectedValueOnce(new Error('Could not establish connection'))
      .mockResolvedValueOnce({
        success: true,
        transcript: [{ start: 0, duration: 1, text: 'Text' }],
      });

    const result = await adapter.getTranscript(7, 'vid', 'en', { onInjecting });
    expect(result).toEqual({
      success: true,
      transcript: [{ start: 0, duration: 1, text: 'Text' }],
    });
    expect(onInjecting).toHaveBeenCalledOnce();
  });

  test('preserves an unrelated transport error', async () => {
    const adapter = createChromeYoutubeAdapter();
    const failure = new Error('permission denied');
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(failure);

    await expect(adapter.getVideoData(7)).rejects.toBe(failure);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  test('reports a clear error when reinsertion is impossible', async () => {
    const adapter = createChromeYoutubeAdapter();
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(
      new Error('Could not establish connection')
    );
    vi.mocked(chrome.runtime.getManifest).mockReturnValueOnce({
      content_scripts: [],
    } as unknown as chrome.runtime.Manifest);

    await expect(adapter.getVideoData(7)).rejects.toThrow(/od/);
  });
});
