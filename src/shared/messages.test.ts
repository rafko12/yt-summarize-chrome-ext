import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  sendMessageToBackground,
  sendMessageToTabWithRetry,
} from './chromeMessageTransport';
import {
  isBackgroundMessage,
  isContentMessage,
  isErrorResponse,
} from './messages';

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
  } as unknown as typeof chrome;
});

describe('communication contract', () => {
  test('recognizes only complete content and background messages', () => {
    expect(isContentMessage({ type: 'GET_VIDEO_DATA' })).toBe(true);
    expect(isContentMessage({ type: 'GET_VIDEO_DATA', extra: true })).toBe(
      false
    );
    expect(
      isContentMessage({
        type: 'GET_TRANSCRIPT',
        videoId: 'film',
        targetLang: 'pl',
      })
    ).toBe(true);
    expect(isContentMessage({ type: 'SEEK_TO', seconds: 20 })).toBe(true);
    expect(isContentMessage({ type: 'SEEK_TO', seconds: '20' })).toBe(false);
    expect(isContentMessage({ type: 'GET_TRANSCRIPT', videoId: 'film' })).toBe(
      false
    );
    expect(isContentMessage(null)).toBe(false);
    expect(isContentMessage({ type: 'UNKNOWN' })).toBe(false);

    expect(isBackgroundMessage({ type: 'PANEL_INIT', tabId: 2 })).toBe(true);
    expect(
      isBackgroundMessage({ type: 'PIN_GLOBAL', tabId: 2, windowId: 3 })
    ).toBe(true);
    expect(
      isBackgroundMessage({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 2,
        url: 'https://youtube.com/watch?v=film',
      })
    ).toBe(true);
    expect(isBackgroundMessage({ type: 'GET_PIN_STATE' })).toBe(true);
    expect(isBackgroundMessage({ type: 'PANEL_INIT' })).toBe(false);
    expect(isBackgroundMessage({ type: 'UNKNOWN' })).toBe(false);
  });

  test('recognizes an error response and forwards a background message', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce({
      isPinnedGlobal: true,
      success: true,
    });

    await expect(
      sendMessageToBackground({ type: 'GET_PIN_STATE' })
    ).resolves.toEqual({ isPinnedGlobal: true, success: true });
    expect(isErrorResponse({ error: 'problem' })).toBe(true);
    expect(isErrorResponse({ error: 10 })).toBe(false);
    expect(isErrorResponse(null)).toBe(false);
  });

  test('sends a message to an installed content script', async () => {
    await expect(
      sendMessageToTabWithRetry(7, { type: 'SEEK_TO', seconds: 42 })
    ).resolves.toEqual({ success: true });

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: 'SEEK_TO',
      seconds: 42,
    });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  test('reinserts the content script after a missing receiver and retries', async () => {
    const onInjecting = vi.fn();
    vi.mocked(chrome.tabs.sendMessage)
      .mockRejectedValueOnce(new Error('Receiving end does not exist'))
      .mockResolvedValueOnce({ success: true });

    await expect(
      sendMessageToTabWithRetry(
        7,
        { type: 'SEEK_TO', seconds: 42 },
        { onInjecting }
      )
    ).resolves.toEqual({ success: true });

    expect(onInjecting).toHaveBeenCalledOnce();
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['content.js'],
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  test('preserves an unrelated transport error', async () => {
    const failure = new Error('permission denied');
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(failure);

    await expect(
      sendMessageToTabWithRetry(7, { type: 'GET_VIDEO_DATA' })
    ).rejects.toBe(failure);
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  test('reports a clear error when reinsertion is impossible', async () => {
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(
      new Error('Could not establish connection')
    );
    vi.mocked(chrome.runtime.getManifest).mockReturnValueOnce({
      content_scripts: [],
    } as unknown as chrome.runtime.Manifest);

    await expect(
      sendMessageToTabWithRetry(7, { type: 'GET_VIDEO_DATA' })
    ).rejects.toThrow(/od/);
  });
});
