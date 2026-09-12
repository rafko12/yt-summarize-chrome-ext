import { describe, expect, it, vi } from 'vitest';

import { createChromeStorageLocalAdapter, STORAGE_KEYS } from '../../storage';
import { createUserPreferences } from './index';

describe('Preferences Module public seam (src/sidepanel/preferences)', () => {
  it('instantiates preferences directly with shared ChromeStorageLocalAdapter and canonical keys', async () => {
    const memoryStore: Record<string, unknown> = {};
    const mockStorageLocal = {
      get: vi.fn(
        (
          keys: string | string[],
          cb: (res: Record<string, unknown>) => void
        ) => {
          const keyList = Array.isArray(keys) ? keys : [keys];
          cb(Object.fromEntries(keyList.map((k) => [k, memoryStore[k]])));
        }
      ),
      set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(memoryStore, items);
        cb?.();
      }),
    } as unknown as typeof chrome.storage.local;

    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);
    const preferences = createUserPreferences(adapter);

    await preferences.setApiKey('openai', 'sk-test');
    expect(await preferences.getApiKey('openai')).toBe('sk-test');
    expect(memoryStore[STORAGE_KEYS.OPENAI_API_KEY]).toBe('sk-test');
  });
});
