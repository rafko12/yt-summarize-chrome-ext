import { beforeEach, describe, expect, test, vi } from 'vitest';

import { PinStateResponse, SuccessResponse } from '../shared/messages';
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
});
