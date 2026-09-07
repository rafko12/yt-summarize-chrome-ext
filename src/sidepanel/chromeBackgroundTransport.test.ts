import { beforeEach, describe, expect, test, vi } from 'vitest';

import { PinStateResponse, SuccessResponse } from '../messaging';
import sendMessageToBackground from './chromeBackgroundTransport';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidepanel chromeBackgroundTransport', () => {
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

  describe('listenToPanelNotifications', () => {
    test('subscribes to chrome.runtime.onMessage, delivers valid panel notifications and returns false', async () => {
      const { listenToPanelNotifications } = await import(
        './chromeBackgroundTransport'
      );

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
      const unsubscribe = listenToPanelNotifications(onNotification);

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
