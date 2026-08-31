import { describe, expect, it, vi } from 'vitest';

import createChromePreferencesPlatform from './chromePreferencesPlatform';

describe('createChromePreferencesPlatform', () => {
  it('reads keys from storage.local', async () => {
    const mockStorage = {
      get: vi.fn(
        (
          keys: string[],
          callback: (result: Record<string, unknown>) => void
        ) => {
          callback({ [keys[0]]: 'test-val' });
        }
      ),
      set: vi.fn(),
    } as unknown as typeof chrome.storage.local;

    const platform = createChromePreferencesPlatform(mockStorage);
    const result = await platform.read(['some_key']);

    expect(mockStorage.get).toHaveBeenCalledWith(
      ['some_key'],
      expect.any(Function)
    );
    expect(result).toEqual({ some_key: 'test-val' });
  });

  it('writes values to storage.local', async () => {
    const mockStorage = {
      get: vi.fn(),
      set: vi.fn((_values: Record<string, unknown>, callback: () => void) => {
        callback();
      }),
    } as unknown as typeof chrome.storage.local;

    const platform = createChromePreferencesPlatform(mockStorage);
    await platform.write({ some_key: 'new-val' });

    expect(mockStorage.set).toHaveBeenCalledWith(
      { some_key: 'new-val' },
      expect.any(Function)
    );
  });
});
