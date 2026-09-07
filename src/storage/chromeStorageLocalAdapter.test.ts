import { beforeEach, describe, expect, it, vi } from 'vitest';

import createChromeStorageLocalAdapter from './chromeStorageLocalAdapter';

describe('createChromeStorageLocalAdapter (src/storage)', () => {
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
    mockStorageData.some_key = 'some-value';
    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);

    const result = await adapter.read(['some_key']);

    expect(result).toEqual({ some_key: 'some-value' });
    expect(mockStorageLocal.get).toHaveBeenCalledWith(
      ['some_key'],
      expect.any(Function)
    );
  });

  it('writes values to chrome.storage.local via injected storage', async () => {
    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);

    await adapter.write({ some_key: 'updated-value', other_key: 123 });

    expect(mockStorageData.some_key).toBe('updated-value');
    expect(mockStorageData.other_key).toBe(123);
    expect(mockStorageLocal.set).toHaveBeenCalledWith(
      { some_key: 'updated-value', other_key: 123 },
      expect.any(Function)
    );
  });

  it('passes through raw data without performing domain validation', async () => {
    // Verifies that the adapter does not filter or normalize invalid structures
    const rawData = {
      summarizer_settings: 'not-an-object',
      summarizer_history: 'not-an-array',
      gemini_api_key: 12345,
    };
    mockStorageData = { ...rawData };

    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);
    const result = await adapter.read([
      'summarizer_settings',
      'summarizer_history',
      'gemini_api_key',
    ]);

    expect(result).toEqual(rawData);

    await adapter.write({ summarizer_settings: null, custom: [1, 2] });
    expect(mockStorageData.summarizer_settings).toBeNull();
    expect(mockStorageData.custom).toEqual([1, 2]);
  });

  it('falls back to global chrome.storage.local when no storage is passed', async () => {
    const globalGet = vi.fn(
      (
        _keys: string[],
        callback: (result: Record<string, unknown>) => void
      ) => {
        callback({ fallback_key: 'global-value' });
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

    const adapter = createChromeStorageLocalAdapter();

    const result = await adapter.read(['fallback_key']);
    expect(result).toEqual({ fallback_key: 'global-value' });
    expect(globalGet).toHaveBeenCalledWith(
      ['fallback_key'],
      expect.any(Function)
    );

    await adapter.write({ fallback_key: 'new-global-value' });
    expect(globalSet).toHaveBeenCalledWith(
      { fallback_key: 'new-global-value' },
      expect.any(Function)
    );
  });
});
