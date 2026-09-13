import { beforeEach, describe, expect, test, vi } from 'vitest';

import { PinStateResponse, SuccessResponse } from '../../messaging';
import createChromePanelRuntime from './chromePanelRuntime';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chromePanelRuntime', () => {
  describe('getContext', () => {
    test('returns tabId and windowId when active tab has both properties', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
        { id: 42, windowId: 7 } as chrome.tabs.Tab,
      ]);

      const runtime = createChromePanelRuntime();
      const context = await runtime.getContext();

      expect(context).toEqual({ tabId: 42, windowId: 7 });
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    test('returns null when query returns an empty list', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValueOnce([]);

      const runtime = createChromePanelRuntime();
      const context = await runtime.getContext();

      expect(context).toBeNull();
    });

    test('returns null when active tab has no id or windowId', async () => {
      vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
        { title: 'Untitled' } as chrome.tabs.Tab,
      ]);

      const runtime = createChromePanelRuntime();
      const context = await runtime.getContext();

      expect(context).toBeNull();
    });

    test('returns null when chrome.tabs.query rejects', async () => {
      vi.mocked(chrome.tabs.query).mockRejectedValueOnce(
        new Error('Tabs query failed')
      );

      const runtime = createChromePanelRuntime();
      const context = await runtime.getContext();

      expect(context).toBeNull();
    });
  });

  describe('initialize', () => {
    test('sends PANEL_INIT to background and returns PinStateResponse', async () => {
      const response: PinStateResponse = { isPinnedGlobal: false };
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(response);

      const runtime = createChromePanelRuntime();
      const result = await runtime.initialize(10);

      expect(result).toEqual({ isPinnedGlobal: false });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PANEL_INIT',
        tabId: 10,
      });
    });
  });

  describe('requestGlobalPin', () => {
    test('sends PIN_GLOBAL to background and returns PinResult', async () => {
      const response: SuccessResponse = { success: true };
      vi.mocked(chrome.runtime.sendMessage).mockResolvedValueOnce(response);

      const runtime = createChromePanelRuntime();
      const result = await runtime.requestGlobalPin({
        tabId: 10,
        windowId: 20,
      });

      expect(result).toEqual({ success: true });
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PIN_GLOBAL',
        tabId: 10,
        windowId: 20,
      });
    });
  });

  describe('subscribeNotifications', () => {
    test('subscribes to chrome.runtime.onMessage, delivers panel notifications, returns false, and unsubscribes', () => {
      type MessageListener = Parameters<
        typeof chrome.runtime.onMessage.addListener
      >[0];
      let registeredListener: MessageListener | undefined;
      vi.mocked(chrome.runtime.onMessage.addListener).mockImplementation(
        (listener) => {
          registeredListener = listener;
        }
      );

      const onNotification = vi.fn();
      const runtime = createChromePanelRuntime();
      const unsubscribe = runtime.subscribeNotifications(onNotification);

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
      expect(registeredListener).toBeDefined();

      const validNotification = {
        type: 'YOUTUBE_URL_UPDATED' as const,
        tabId: 1,
        url: 'https://www.youtube.com/watch?v=abc',
      };

      const dummySender = {} as chrome.runtime.MessageSender;
      const dummySendResponse = () => undefined;

      const result1 = registeredListener!(
        validNotification,
        dummySender,
        dummySendResponse
      );
      expect(result1).toBe(false);
      expect(onNotification).toHaveBeenCalledWith(validNotification);

      const invalidMessage = { type: 'PANEL_INIT', tabId: 1 };
      const result2 = registeredListener!(
        invalidMessage,
        dummySender,
        dummySendResponse
      );
      expect(result2).toBe(false);
      expect(onNotification).toHaveBeenCalledTimes(1);

      unsubscribe();
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        registeredListener
      );
    });
  });
});
