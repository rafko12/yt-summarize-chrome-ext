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
      expect(platform.write).not.toHaveBeenCalled();
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
      expect(platform.write).not.toHaveBeenCalled();
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

  describe('initial preferences active model normalization', () => {
    it('preserves valid user-selected model when corresponding API key exists without modifying storage', async () => {
      // Valid Gemini model
      storageData.gemini_api_key = 'gemini-key';
      storageData.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.1-pro',
      };
      const geminiResult = await preferences.readInitialPreferences();
      expect(geminiResult.settings.model).toBe('gemini-3.1-pro');
      expect(platform.write).not.toHaveBeenCalled();

      // Valid OpenAI model
      storageData.gemini_api_key = '';
      storageData.openai_api_key = 'openai-key';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'gpt-5.6-terra',
      };
      const openaiResult = await preferences.readInitialPreferences();
      expect(openaiResult.settings.model).toBe('gpt-5.6-terra');
      expect(platform.write).not.toHaveBeenCalled();

      // Valid Claude model
      storageData.openai_api_key = '';
      storageData.claude_api_key = 'claude-key';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'claude-opus-5',
      };
      const claudeResult = await preferences.readInitialPreferences();
      expect(claudeResult.settings.model).toBe('claude-opus-5');
      expect(platform.write).not.toHaveBeenCalled();
    });

    it('normalizes model and persists it to storage when saved model belongs to a provider without API key', async () => {
      // Saved model is Gemini, but user only configured OpenAI key
      storageData.gemini_api_key = '';
      storageData.openai_api_key = 'openai-key';
      storageData.claude_api_key = '';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'gemini-3.6-flash',
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings).toEqual({
        language: 'English',
        model: 'gpt-5.6-luna',
      });
      expect(platform.write).toHaveBeenCalledWith({
        summarizer_settings: {
          language: 'English',
          model: 'gpt-5.6-luna',
        },
      });
      expect(storageData.summarizer_settings).toEqual({
        language: 'English',
        model: 'gpt-5.6-luna',
      });
    });

    it('normalizes unknown or invalid model to the default model of available provider and persists to storage', async () => {
      storageData.claude_api_key = 'claude-key';
      storageData.summarizer_settings = {
        language: 'Polski',
        model: 'non-existent-legacy-model',
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings.model).toBe('claude-sonnet-5');
      expect(platform.write).toHaveBeenCalledWith({
        summarizer_settings: {
          language: 'Polski',
          model: 'claude-sonnet-5',
        },
      });
      expect(storageData.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'claude-sonnet-5',
      });
    });

    it('normalizes hidden models (e.g. gemini-3.5-flash or gpt-4o-mini) to visible registered models', async () => {
      // gemini-3.5-flash is hidden in settings catalog
      storageData.gemini_api_key = 'gemini-key';
      storageData.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.5-flash',
      };

      const initialGemini = await preferences.readInitialPreferences();
      expect(initialGemini.settings.model).toBe('gemini-3.6-flash');
      expect(storageData.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gemini-3.6-flash',
      });

      // gpt-4o-mini is hidden in settings catalog
      storageData.gemini_api_key = '';
      storageData.openai_api_key = 'openai-key';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'gpt-4o-mini',
      };

      const initialOpenAi = await preferences.readInitialPreferences();
      expect(initialOpenAi.settings.model).toBe('gpt-5.6-luna');
      expect(storageData.summarizer_settings).toEqual({
        language: 'English',
        model: 'gpt-5.6-luna',
      });
    });

    it('deterministically selects the first available provider in registry order when multiple keys exist and current model is unavailable', async () => {
      // Order is gemini -> openai -> claude
      // Here: OpenAI and Claude have keys, current model is invalid Gemini model
      storageData.openai_api_key = 'openai-key';
      storageData.claude_api_key = 'claude-key';
      storageData.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash', // no gemini key
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings.model).toBe('gpt-5.6-luna');
      expect(storageData.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });
    });

    it('does not write to storage or create phantom active model when no API keys are present', async () => {
      storageData.gemini_api_key = '';
      storageData.openai_api_key = '   ';
      storageData.claude_api_key = undefined;
      storageData.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.5-flash',
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings).toEqual({
        language: 'Polski',
        model: 'gemini-3.5-flash',
      });
      expect(platform.write).not.toHaveBeenCalled();
    });

    it('subsequent read after normalization yields the normalized model directly without redundant writes', async () => {
      storageData.openai_api_key = 'openai-key';
      storageData.summarizer_settings = {
        language: 'Polski',
        model: 'unknown-model',
      };

      // First read: normalizes and writes
      const firstRead = await preferences.readInitialPreferences();
      expect(firstRead.settings.model).toBe('gpt-5.6-luna');
      expect(platform.write).toHaveBeenCalledTimes(1);

      // Reset mock tracking
      vi.clearAllMocks();

      // Second read (simulating reopening the panel): storage already holds gpt-5.6-luna
      const secondRead = await preferences.readInitialPreferences();
      expect(secondRead.settings.model).toBe('gpt-5.6-luna');
      expect(platform.read).toHaveBeenCalledTimes(1);
      expect(platform.write).not.toHaveBeenCalled();
    });

    it('preserves backward compatibility with existing storage keys and summarizer_settings format', async () => {
      // Legacy storage record with all existing key names
      storageData.gemini_api_key = 'legacy-gemini-key';
      storageData.openai_api_key = 'legacy-openai-key';
      storageData.claude_api_key = 'legacy-claude-key';
      storageData.summarizer_settings = {
        language: 'English',
        model: 'gpt-5.6-luna',
      };
      storageData.ui_theme = 'night';

      const initial = await preferences.readInitialPreferences();

      expect(initial).toEqual({
        apiKeys: {
          gemini: 'legacy-gemini-key',
          openai: 'legacy-openai-key',
          claude: 'legacy-claude-key',
        },
        settings: {
          language: 'English',
          model: 'gpt-5.6-luna',
        },
        theme: 'night',
      });
      expect(platform.write).not.toHaveBeenCalled();
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
