import { beforeEach, describe, expect, test, vi } from 'vitest';

import { sendMessageToTabWithRetry } from './chromeMessageTransport';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true });
  global.chrome = {
    ...chrome,
    scripting: {
      executeScript: vi.fn(async () => undefined),
    },
  } as unknown as typeof chrome;
});

describe('Chrome message transport', () => {
  test('sends a video-data request and returns its response', async () => {
    const response = {
      success: true,
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
  });
});
