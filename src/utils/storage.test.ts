/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearApiKeysAndHistory,
  clearHistory,
  deleteHistoryItem,
  getHistory,
  HistoryItem,
  saveHistoryItem,
  updateHistoryItemChat,
} from './storage';

describe('storage history operations', () => {
  const dummyItem: Omit<HistoryItem, 'createdAt'> = {
    videoId: '123',
    title: 'Test Video',
    author: 'Test Author',
    thumbnailUrl: 'http://test.com/thumb.jpg',
    summary: 'Test summary',
    transcript: [],
    chat: [],
  };

  beforeEach(() => {
    // Reset global chrome mock state
    let mockStorage: any = {};
    (global.chrome.storage.local.get as any) = vi.fn(
      (keys: string[], callback: (res: any) => void) => {
        callback(
          Object.fromEntries(keys.map((key) => [key, mockStorage[key]]))
        );
      }
    );
    (global.chrome.storage.local.set as any) = vi.fn(
      (data: any, callback: () => void) => {
        mockStorage = { ...mockStorage, ...data };
        if (callback) callback();
      }
    );
    (global.chrome.storage.local.remove as any) = vi.fn(
      (keys: string[], callback: () => void) => {
        keys.forEach((key) => delete mockStorage[key]);
        callback();
      }
    );
  });

  it('should save history item and cap at 50', async () => {
    // Fill storage with 50 items
    const initialItems = Array.from({ length: 50 }).map((_, i) => ({
      ...dummyItem,
      videoId: `vid_${i}`,
      createdAt: 1000 + i,
    }));

    (global.chrome.storage.local.get as any).mockImplementationOnce(
      (_keys: string[], callback: (res: any) => void) => {
        callback({ summarizer_history: initialItems });
      }
    );

    const newHistory = await saveHistoryItem({
      ...dummyItem,
      videoId: 'vid_new',
    });

    expect(newHistory).toHaveLength(50);
    expect(newHistory[0].videoId).toBe('vid_new');
    expect(newHistory[49].videoId).toBe('vid_48'); // The oldest item (vid_49) should be removed
  });

  it('should not duplicate items with same videoId when saving', async () => {
    await saveHistoryItem(dummyItem);
    const newHistory = await saveHistoryItem({
      ...dummyItem,
      title: 'Updated Title',
    });
    expect(newHistory).toHaveLength(1);
    expect(newHistory[0].title).toBe('Updated Title');
  });

  it('should delete history item', async () => {
    await saveHistoryItem(dummyItem);
    await saveHistoryItem({ ...dummyItem, videoId: '456' });

    const newHistory = await deleteHistoryItem('123');
    expect(newHistory).toHaveLength(1);
    expect(newHistory[0].videoId).toBe('456');
  });

  it('should clear history', async () => {
    await saveHistoryItem(dummyItem);
    await clearHistory();
    const history = await getHistory();
    expect(history).toHaveLength(0);
  });

  it('should update chat only for an existing history item', async () => {
    await saveHistoryItem(dummyItem);
    const chat = [{ role: 'user' as const, message: 'Question' }];

    await updateHistoryItemChat(dummyItem.videoId, chat);
    expect((await getHistory())[0].chat).toEqual(chat);

    await updateHistoryItemChat('missing-video', [
      { role: 'model', message: 'This should not be stored' },
    ]);
    expect(await getHistory()).toHaveLength(1);
    expect((await getHistory())[0].chat).toEqual(chat);
  });

  it('filters malformed history data read from storage', async () => {
    (global.chrome.storage.local.get as any).mockImplementationOnce(
      (_keys: string[], callback: (res: any) => void) => {
        callback({
          summarizer_history: [
            { ...dummyItem, createdAt: 1 },
            { ...dummyItem, videoId: 123, createdAt: 2 },
          ],
        });
      }
    );

    await expect(getHistory()).resolves.toEqual([
      { ...dummyItem, createdAt: 1 },
    ]);
  });

  it('removes every API key together with history', async () => {
    await saveHistoryItem(dummyItem);
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          gemini_api_key: 'gemini',
          openai_api_key: 'openai',
          claude_api_key: 'claude',
        },
        resolve
      );
    });

    await clearApiKeysAndHistory();

    expect(global.chrome.storage.local.remove).toHaveBeenCalledWith(
      [
        'gemini_api_key',
        'openai_api_key',
        'claude_api_key',
        'summarizer_history',
      ],
      expect.any(Function)
    );
    await expect(getHistory()).resolves.toEqual([]);
  });
});
