import { describe, expect, it, vi } from 'vitest';

import { createChromeStorageLocalAdapter, STORAGE_KEYS } from '../../storage';
import { createUserPreferencesStore } from './index';

describe('Settings Module public seam (src/sidepanel/settings)', () => {
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
    const settingsStore = createUserPreferencesStore(adapter);

    await settingsStore.setApiKey('openai', 'sk-test');
    expect(await settingsStore.getApiKey('openai')).toBe('sk-test');
    expect(memoryStore[STORAGE_KEYS.OPENAI_API_KEY]).toBe('sk-test');
  });
});
