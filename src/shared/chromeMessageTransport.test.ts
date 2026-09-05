import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  sendMessageToBackground,
  sendMessageToTabWithRetry,
} from './chromeMessageTransport';
import { PinStateResponse, SuccessResponse } from './messages';

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

describe('Chrome message transport', () => {
  describe('sendMessageToTabWithRetry', () => {
    test('sends a video-data request and returns its response', async () => {
      const response = {
        success: true as const,
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'thumbnail',
      };
      vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(response);

      await expect(
        sendMessageToTabWithRetry(7, { type: 'GET_VIDEO_DATA' })
      ).resolves.toEqual(response);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: 'GET_VIDEO_DATA',
      });
      expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    });

    test('sends a seek-to request and returns success response', async () => {
      const response: SuccessResponse = { success: true };
      vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce(response);

      await expect(
        sendMessageToTabWithRetry(7, { type: 'SEEK_TO', seconds: 42 })
      ).resolves.toEqual(response);

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

  describe('sendMessageToBackground', () => {
    test('sends a GET_PIN_STATE request and returns runtime PinStateResponse', async () => {
      const response: PinStateResponse = { isPinnedGlobal: true };
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(response);

      await expect(
        sendMessageToBackground({ type: 'GET_PIN_STATE' })
      ).resolves.toEqual({ isPinnedGlobal: true });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_PIN_STATE',
      });
    });

    test('sends a PANEL_INIT request and returns runtime PinStateResponse', async () => {
      const response: PinStateResponse = { isPinnedGlobal: false };
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(response);

      await expect(
        sendMessageToBackground({ type: 'PANEL_INIT', tabId: 10 })
      ).resolves.toEqual({ isPinnedGlobal: false });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PANEL_INIT',
        tabId: 10,
      });
    });

    test('sends a PIN_GLOBAL request and returns success response', async () => {
      const response: SuccessResponse = { success: true };
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(response);

      await expect(
        sendMessageToBackground({
          type: 'PIN_GLOBAL',
          tabId: 10,
          windowId: 20,
        })
      ).resolves.toEqual({ success: true });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PIN_GLOBAL',
        tabId: 10,
        windowId: 20,
      });
    });
  });
});
