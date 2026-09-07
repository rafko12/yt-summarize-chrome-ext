import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS, StorageAdapter } from '../../storage';
import createUserPreferences, {
  DEFAULT_SETTINGS,
  UserPreferences,
} from './userPreferences';

describe('UserPreferences', () => {
  let storageData: Record<string, unknown>;
  let platform: StorageAdapter;
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
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 'gemini-secret';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'openai-secret';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = 'claude-secret';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'gemini-3.1-pro',
      };
      storageData[STORAGE_KEYS.UI_THEME] = 'nord';

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
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 'gemini-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'Polski',
        model: 'gemini-3.1-pro',
      };
      const geminiResult = await preferences.readInitialPreferences();
      expect(geminiResult.settings.model).toBe('gemini-3.1-pro');
      expect(platform.write).not.toHaveBeenCalled();

      // Valid OpenAI model
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = '';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'openai-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'gpt-5.6-terra',
      };
      const openaiResult = await preferences.readInitialPreferences();
      expect(openaiResult.settings.model).toBe('gpt-5.6-terra');
      expect(platform.write).not.toHaveBeenCalled();

      // Valid Claude model
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = '';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = 'claude-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'claude-opus-5',
      };
      const claudeResult = await preferences.readInitialPreferences();
      expect(claudeResult.settings.model).toBe('claude-opus-5');
      expect(platform.write).not.toHaveBeenCalled();
    });

    it('normalizes model and persists it to storage when saved model belongs to a provider without API key', async () => {
      // Saved model is Gemini, but user only configured OpenAI key
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = '';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'openai-key';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = '';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'gemini-3.6-flash',
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings).toEqual({
        language: 'English',
        model: 'gpt-5.6-luna',
      });
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'English',
        model: 'gpt-5.6-luna',
      });
    });

    it('normalizes unknown or invalid model to the default model of available provider and persists to storage', async () => {
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = 'claude-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'Polski',
        model: 'non-existent-legacy-model',
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings.model).toBe('claude-sonnet-5');
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'Polski',
        model: 'claude-sonnet-5',
      });
    });

    it('normalizes hidden models (e.g. gemini-3.5-flash or gpt-4o-mini) to visible registered models', async () => {
      // gemini-3.5-flash is hidden in settings catalog
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 'gemini-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'Polski',
        model: 'gemini-3.5-flash',
      };

      const initialGemini = await preferences.readInitialPreferences();
      expect(initialGemini.settings.model).toBe('gemini-3.6-flash');
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'Polski',
        model: 'gemini-3.6-flash',
      });

      // gpt-4o-mini is hidden in settings catalog
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = '';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'openai-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'gpt-4o-mini',
      };

      const initialOpenAi = await preferences.readInitialPreferences();
      expect(initialOpenAi.settings.model).toBe('gpt-5.6-luna');
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'English',
        model: 'gpt-5.6-luna',
      });
    });

    it('deterministically selects the first available provider in registry order when multiple keys exist and current model is unavailable', async () => {
      // Order is gemini -> openai -> claude
      // Here: OpenAI and Claude have keys, current model is invalid Gemini model
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'openai-key';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = 'claude-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'Polski',
        model: 'gemini-3.6-flash', // no gemini key
      };

      const initial = await preferences.readInitialPreferences();

      expect(initial.settings.model).toBe('gpt-5.6-luna');
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });
    });

    it('does not write to storage or create phantom active model when no API keys are present', async () => {
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = '';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = '   ';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = undefined;
      storageData[STORAGE_KEYS.SETTINGS] = {
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
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'openai-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
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
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 'legacy-gemini-key';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'legacy-openai-key';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = 'legacy-claude-key';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'gpt-5.6-luna',
      };
      storageData[STORAGE_KEYS.UI_THEME] = 'night';

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

      storageData[STORAGE_KEYS.SETTINGS] = 'invalid-format';
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );

      storageData[STORAGE_KEYS.SETTINGS] = null;
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );
    });

    it('falls back to safe defaults for partial or malformed settings fields', async () => {
      storageData[STORAGE_KEYS.SETTINGS] = { language: 'English', model: 1234 };
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'English',
        model: DEFAULT_SETTINGS.model,
      });

      storageData[STORAGE_KEYS.SETTINGS] = {
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
        model: 'claude-sonnet-5',
      };
      await preferences.setSettings(newSettings);

      await expect(preferences.getSettings()).resolves.toEqual(newSettings);
    });
  });

  describe('api keys management', () => {
    it('normalizes missing or malformed api keys to empty string', async () => {
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 12345;
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = null;
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = undefined;

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
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 'gemini-key';
      await expect(preferences.getApiKey()).resolves.toBe('gemini-key');
    });

    it('persists individual api keys and updates all keys map', async () => {
      await preferences.setApiKey('openai', 'sk-openai');
      await preferences.setApiKey('gemini', 'sk-gemini');
      await preferences.setApiKey('claude', 'sk-claude');

      await expect(preferences.getApiKey('openai')).resolves.toBe('sk-openai');
      await expect(preferences.getApiKey('gemini')).resolves.toBe('sk-gemini');
      await expect(preferences.getApiKey('claude')).resolves.toBe('sk-claude');
      await expect(preferences.getAllApiKeys()).resolves.toEqual({
        gemini: 'sk-gemini',
        openai: 'sk-openai',
        claude: 'sk-claude',
      });
    });

    it('clears all api keys without touching other preferences', async () => {
      storageData[STORAGE_KEYS.GEMINI_API_KEY] = 'sk-gemini';
      storageData[STORAGE_KEYS.OPENAI_API_KEY] = 'sk-openai';
      storageData[STORAGE_KEYS.CLAUDE_API_KEY] = 'sk-claude';
      storageData[STORAGE_KEYS.SETTINGS] = {
        language: 'English',
        model: 'gemini-3.1-pro',
      };
      storageData[STORAGE_KEYS.UI_THEME] = 'nord';

      await preferences.clearApiKeys();

      await expect(preferences.getAllApiKeys()).resolves.toEqual({
        gemini: '',
        openai: '',
        claude: '',
      });
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'English',
        model: 'gemini-3.1-pro',
      });
      await expect(preferences.getTheme()).resolves.toBe('nord');
    });
  });

  describe('theme management', () => {
    it('normalizes invalid theme values to null', async () => {
      storageData[STORAGE_KEYS.UI_THEME] = 'solarized';
      await expect(preferences.getTheme()).resolves.toBeNull();

      storageData[STORAGE_KEYS.UI_THEME] = 123;
      await expect(preferences.getTheme()).resolves.toBeNull();
    });

    it('persists and retrieves valid themes (night and nord)', async () => {
      await preferences.setTheme('nord');
      await expect(preferences.getTheme()).resolves.toBe('nord');

      await preferences.setTheme('night');
      await expect(preferences.getTheme()).resolves.toBe('night');
    });
  });
});
