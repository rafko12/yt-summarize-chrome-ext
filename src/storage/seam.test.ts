import { describe, expect, it, vi } from 'vitest';

import { createAnalysisHistory } from '../sidepanel/history';
import { createUserPreferences } from '../sidepanel/preferences';
import {
  createChromeStorageLocalAdapter,
  STORAGE_KEYS,
  StorageAdapter,
} from './index';

describe('Storage Seam (src/storage/seam)', () => {
  it('supplies the read and write seam required by user preferences', async () => {
    const storageState: Record<string, unknown> = {
      [STORAGE_KEYS.SETTINGS]: {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      },
      [STORAGE_KEYS.GEMINI_API_KEY]: 'test-gemini-key',
    };

    const mockStorage = {
      get: vi.fn(
        (
          keys: string | string[],
          callback: (items: Record<string, unknown>) => void
        ) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(
            Object.fromEntries(keyList.map((key) => [key, storageState[key]]))
          );
        }
      ),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageState, items);
        if (callback) callback();
      }),
    } as unknown as typeof chrome.storage.local;

    const adapter: StorageAdapter =
      createChromeStorageLocalAdapter(mockStorage);
    const preferences = createUserPreferences(adapter);

    const initial = await preferences.readInitialPreferences();
    expect(initial.settings).toEqual({
      language: 'Polski',
      model: 'gemini-3.6-flash',
    });
    expect(initial.apiKeys.gemini).toBe('test-gemini-key');

    await preferences.setApiKey('openai', 'sk-openai-key');
    expect(storageState[STORAGE_KEYS.OPENAI_API_KEY]).toBe('sk-openai-key');
  });

  it('supplies the read and write seam required by analysis history', async () => {
    const storageState: Record<string, unknown> = {
      [STORAGE_KEYS.HISTORY]: [
        {
          videoId: 'vid-001',
          title: 'Tytuł Filmu',
          author: 'Kanał',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          summary: 'Podsumowanie',
          transcript: [{ start: 0, duration: 10, text: 'Wstęp' }],
          chat: [{ role: 'user', message: 'Cześć' }],
          createdAt: 1700000000000,
        },
      ],
    };

    const mockStorage = {
      get: vi.fn(
        (
          keys: string | string[],
          callback: (items: Record<string, unknown>) => void
        ) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          callback(
            Object.fromEntries(keyList.map((key) => [key, storageState[key]]))
          );
        }
      ),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(storageState, items);
        if (callback) callback();
      }),
    } as unknown as typeof chrome.storage.local;

    const adapter: StorageAdapter =
      createChromeStorageLocalAdapter(mockStorage);
    const history = createAnalysisHistory(adapter);

    const records = await history.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].videoId).toBe('vid-001');

    await history.saveRecord({
      videoId: 'vid-002',
      title: 'Nowy Film',
      author: 'Autor',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      summary: null,
      transcript: [],
      chat: [],
    });

    expect(storageState[STORAGE_KEYS.HISTORY]).toHaveLength(2);
  });
});
