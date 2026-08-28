import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  getAllApiKeys,
  getApiKey,
  getPinState,
  getSettings,
  getTheme,
  setApiKey,
  setPinState,
  setSettings,
  setTheme,
} from './storage';

let data: Record<string, unknown>;

beforeEach(() => {
  data = {};
  global.chrome = {
    ...chrome,
    storage: {
      local: {
        get: vi.fn(
          (
            keys: string[],
            callback: (result: Record<string, unknown>) => void
          ) => {
            callback(Object.fromEntries(keys.map((key) => [key, data[key]])));
          }
        ),
        set: vi.fn((values: Record<string, unknown>, callback: () => void) => {
          Object.assign(data, values);
          callback();
        }),
        remove: vi.fn(),
      },
    },
  } as unknown as typeof chrome;
});

describe('storage settings and keys', () => {
  test('uses default settings and validates stored settings', async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
    data.summarizer_settings = { language: 'English', model: 4 };
    await expect(getSettings()).resolves.toEqual({
      language: 'English',
      model: DEFAULT_SETTINGS.model,
    });
    data.summarizer_settings = 'invalid';
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  test('persists settings, individual keys and all keys', async () => {
    await setSettings({ language: 'English', model: 'gpt-5.6-luna' });
    await setApiKey('openai', 'openai-key');
    await setApiKey('gemini', 'gemini-key');
    await setApiKey('claude', 'claude-key');

    await expect(getApiKey('openai')).resolves.toBe('openai-key');
    await expect(getApiKey()).resolves.toBe('gemini-key');
    await expect(getAllApiKeys()).resolves.toEqual({
      gemini: 'gemini-key',
      openai: 'openai-key',
      claude: 'claude-key',
    });
  });

  test('normalizes malformed API keys and theme or pin state', async () => {
    data.openai_api_key = 4;
    data.ui_theme = 'invalid';
    data.panel_pin_state = 'true';

    await expect(getApiKey('openai')).resolves.toBe('');
    await expect(getTheme()).resolves.toBeNull();
    await expect(getPinState()).resolves.toBe(false);

    await setTheme('nord');
    await setPinState(true);
    await expect(getTheme()).resolves.toBe('nord');
    await expect(getPinState()).resolves.toBe(true);
  });
});
