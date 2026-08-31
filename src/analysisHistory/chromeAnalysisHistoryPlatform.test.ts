import { beforeEach, describe, expect, it, vi } from 'vitest';

import createChromeAnalysisHistoryPlatform from './chromeAnalysisHistoryPlatform';

describe('createChromeAnalysisHistoryPlatform', () => {
  let mockStorageData: Record<string, unknown>;
  let mockStorageLocal: typeof chrome.storage.local;

  beforeEach(() => {
    mockStorageData = {};
    mockStorageLocal = {
      get: vi.fn(
        (
          keys: string | string[] | Record<string, unknown> | null,
          callback: (items: { [key: string]: unknown }) => void
        ) => {
          const keyList = Array.isArray(keys) ? keys : [keys as string];
          const result = Object.fromEntries(
            keyList.map((k) => [k, mockStorageData[k]])
          );
          callback(result);
        }
      ),
      set: vi.fn((items: { [key: string]: unknown }, callback?: () => void) => {
        Object.assign(mockStorageData, items);
        if (callback) callback();
      }),
    } as unknown as typeof chrome.storage.local;
  });

  it('reads keys from chrome.storage.local via injected storage', async () => {
    mockStorageData.summarizer_history = [{ videoId: 'vid-123' }];
    const platform = createChromeAnalysisHistoryPlatform(mockStorageLocal);

    const result = await platform.read(['summarizer_history']);
    expect(result).toEqual({
      summarizer_history: [{ videoId: 'vid-123' }],
    });
    expect(mockStorageLocal.get).toHaveBeenCalledWith(
      ['summarizer_history'],
      expect.any(Function)
    );
  });

  it('writes values to chrome.storage.local via injected storage', async () => {
    const platform = createChromeAnalysisHistoryPlatform(mockStorageLocal);

    await platform.write({ summarizer_history: [] });

    expect(mockStorageData.summarizer_history).toEqual([]);
    expect(mockStorageLocal.set).toHaveBeenCalledWith(
      { summarizer_history: [] },
      expect.any(Function)
    );
  });

  it('falls back to global chrome.storage.local when no storage is passed', async () => {
    const globalGet = vi.fn(
      (
        _keys: string[],
        callback: (result: Record<string, unknown>) => void
      ) => {
        callback({ summarizer_history: [] });
      }
    );
    const globalSet = vi.fn(
      (_values: Record<string, unknown>, callback: () => void) => {
        callback();
      }
    );

    global.chrome = {
      ...chrome,
      storage: {
        local: {
          get: globalGet,
          set: globalSet,
        },
      },
    } as unknown as typeof chrome;

    const platform = createChromeAnalysisHistoryPlatform();

    await platform.read(['summarizer_history']);
    expect(globalGet).toHaveBeenCalledWith(
      ['summarizer_history'],
      expect.any(Function)
    );

    await platform.write({ summarizer_history: [] });
    expect(globalSet).toHaveBeenCalledWith(
      { summarizer_history: [] },
      expect.any(Function)
    );
  });
});
