import { beforeEach, describe, expect, it, vi } from 'vitest';

import createUserPreferences, {
  DEFAULT_SETTINGS,
  PreferencesPlatform,
  UserPreferences,
} from './userPreferences';

describe('UserPreferences', () => {
  let storageData: Record<string, unknown>;
  let platform: PreferencesPlatform;
  let preferences: UserPreferences;

  beforeEach(() => {
    storageData = {};
    platform = {
      read: vi.fn(async (keys: readonly string[]) =>
        Object.fromEntries(keys.map((k) => [k, storageData[k]]))
      ),
      write: vi.fn(async (values: Record<string, unknown>) => {
        Object.assign(storageData, values);
      }),
    };
    preferences = createUserPreferences(platform);
  });

  describe('initial preferences batch read (waterfall elimination)', () => {
    it('reads all preferences in a single batched platform call with safe defaults', async () => {
      const initial = await preferences.readInitialPreferences();

      expect(platform.read).toHaveBeenCalledTimes(1);
      expect(initial).toEqual({
        apiKeys: {
          gemini: '',
          openai: '',
          claude: '',
        },
        settings: DEFAULT_SETTINGS,
        theme: null,
      });
    });

    it('reads and validates populated preferences in a single platform call', async () => {
      storageData.gemini_api_key = 'gemini-secret';
      storageData.openai_api_key = 'openai-secret';
      storageData.claude_api_key = 'claude-secret';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'gemini-3.1-pro',
      };
      storageData.ui_theme = 'nord';

      const initial = await preferences.readInitialPreferences();

      expect(platform.read).toHaveBeenCalledTimes(1);
      expect(initial).toEqual({
        apiKeys: {
          gemini: 'gemini-secret',
          openai: 'openai-secret',
          claude: 'claude-secret',
        },
        settings: {
          language: 'English',
          model: 'gemini-3.1-pro',
        },
        theme: 'nord',
      });
    });
  });

  describe('settings management', () => {
    it('returns default settings when storage is empty or invalid', async () => {
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );

      storageData.summarizer_settings = 'invalid-format';
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );

      storageData.summarizer_settings = null;
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );
    });

    it('falls back to safe defaults for partial or malformed settings fields', async () => {
      storageData.summarizer_settings = { language: 'English', model: 1234 };
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'English',
        model: DEFAULT_SETTINGS.model,
      });

      storageData.summarizer_settings = {
        language: null,
        model: 'gpt-5.6-luna',
      };
      await expect(preferences.getSettings()).resolves.toEqual({
        language: DEFAULT_SETTINGS.language,
        model: 'gpt-5.6-luna',
      });
    });

    it('persists and retrieves valid settings', async () => {
      const newSettings = {
        language: 'English',
        model: 'claude-3-7-sonnet',
      };
      await preferences.setSettings(newSettings);

      expect(storageData.summarizer_settings).toEqual(newSettings);
      await expect(preferences.getSettings()).resolves.toEqual(newSettings);
    });
  });

  describe('api keys management', () => {
    it('normalizes missing or malformed api keys to empty string', async () => {
      storageData.gemini_api_key = 12345;
      storageData.openai_api_key = null;
      storageData.claude_api_key = undefined;

      await expect(preferences.getApiKey('gemini')).resolves.toBe('');
      await expect(preferences.getApiKey('openai')).resolves.toBe('');
      await expect(preferences.getApiKey('claude')).resolves.toBe('');
      await expect(preferences.getAllApiKeys()).resolves.toEqual({
        gemini: '',
        openai: '',
        claude: '',
      });
    });

    it('defaults to gemini provider when provider is not specified in getApiKey', async () => {
      storageData.gemini_api_key = 'gemini-key';
      await expect(preferences.getApiKey()).resolves.toBe('gemini-key');
    });

    it('persists individual api keys and updates all keys map', async () => {
      await preferences.setApiKey('openai', 'sk-openai');
      await preferences.setApiKey('gemini', 'sk-gemini');
      await preferences.setApiKey('claude', 'sk-claude');

      expect(storageData.openai_api_key).toBe('sk-openai');
      expect(storageData.gemini_api_key).toBe('sk-gemini');
      expect(storageData.claude_api_key).toBe('sk-claude');

      await expect(preferences.getApiKey('openai')).resolves.toBe('sk-openai');
      await expect(preferences.getAllApiKeys()).resolves.toEqual({
        gemini: 'sk-gemini',
        openai: 'sk-openai',
        claude: 'sk-claude',
      });
    });

    it('clears all api keys without touching other preferences', async () => {
      storageData.gemini_api_key = 'sk-gemini';
      storageData.openai_api_key = 'sk-openai';
      storageData.claude_api_key = 'sk-claude';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'gemini-3.1-pro',
      };
      storageData.ui_theme = 'nord';

      await preferences.clearApiKeys();

      expect(storageData.gemini_api_key).toBe('');
      expect(storageData.openai_api_key).toBe('');
      expect(storageData.claude_api_key).toBe('');
      expect(storageData.summarizer_settings).toEqual({
        language: 'English',
        model: 'gemini-3.1-pro',
      });
      expect(storageData.ui_theme).toBe('nord');
    });
  });

  describe('theme management', () => {
    it('normalizes invalid theme values to null', async () => {
      storageData.ui_theme = 'solarized';
      await expect(preferences.getTheme()).resolves.toBeNull();

      storageData.ui_theme = 123;
      await expect(preferences.getTheme()).resolves.toBeNull();
    });

    it('persists and retrieves valid themes (night and nord)', async () => {
      await preferences.setTheme('nord');
      expect(storageData.ui_theme).toBe('nord');
      await expect(preferences.getTheme()).resolves.toBe('nord');

      await preferences.setTheme('night');
      expect(storageData.ui_theme).toBe('night');
      await expect(preferences.getTheme()).resolves.toBe('night');
    });
  });
});
