import { describe, expect, it, vi } from 'vitest';

import defaultCreateUserPreferences, {
  createUserPreferences,
  DEFAULT_SETTINGS,
  SettingsView,
  useSettings,
} from './index';

describe('Preferences Module public seam (src/sidepanel/preferences)', () => {
  it('exposes createUserPreferences factory and default export', () => {
    expect(createUserPreferences).toBeDefined();
    expect(typeof createUserPreferences).toBe('function');
    expect(defaultCreateUserPreferences).toBe(createUserPreferences);
  });

  it('exposes useSettings hook', () => {
    expect(useSettings).toBeDefined();
    expect(typeof useSettings).toBe('function');
  });

  it('exposes SettingsView component', () => {
    expect(SettingsView).toBeDefined();
    expect(typeof SettingsView).toBe('function');
  });

  it('exposes DEFAULT_SETTINGS constant', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(DEFAULT_SETTINGS).toEqual({
      language: 'Polski',
      model: 'gemini-3.5-flash',
    });
  });

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

    const { createChromeStorageLocalAdapter, STORAGE_KEYS } = await import(
      '../../storage'
    );
    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);
    const preferences = createUserPreferences(adapter);

    await preferences.setApiKey('openai', 'sk-test');
    expect(await preferences.getApiKey('openai')).toBe('sk-test');
    expect(memoryStore[STORAGE_KEYS.OPENAI_API_KEY]).toBe('sk-test');
  });
});
