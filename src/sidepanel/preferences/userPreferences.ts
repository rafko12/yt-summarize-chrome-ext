import type { AiProvider } from '../ai';

import { STORAGE_KEYS, StorageAdapter } from '../../storage';
import { isModelAvailable, resolveCompatibleModel } from '../ai';
import { InitialPreferences, Settings, Theme, UserPreferences } from './types';

export const DEFAULT_SETTINGS: Settings = {
  language: 'Polski',
  model: 'gemini-3.5-flash',
};

const API_KEY_STORAGE_KEYS: Record<AiProvider, string> = {
  gemini: STORAGE_KEYS.GEMINI_API_KEY,
  openai: STORAGE_KEYS.OPENAI_API_KEY,
  claude: STORAGE_KEYS.CLAUDE_API_KEY,
};

const ALL_API_KEY_KEYS = [
  STORAGE_KEYS.GEMINI_API_KEY,
  STORAGE_KEYS.OPENAI_API_KEY,
  STORAGE_KEYS.CLAUDE_API_KEY,
] as const;

const ALL_PREFERENCE_KEYS = [
  ...ALL_API_KEY_KEYS,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.UI_THEME,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeSettings(value: unknown): Settings {
  if (!isRecord(value)) {
    return DEFAULT_SETTINGS;
  }
  return {
    language:
      typeof value.language === 'string'
        ? value.language
        : DEFAULT_SETTINGS.language,
    model:
      typeof value.model === 'string' ? value.model : DEFAULT_SETTINGS.model,
  };
}

function normalizeTheme(value: unknown): Theme | null {
  return value === 'night' || value === 'nord' ? value : null;
}

function normalizeApiKeys(
  raw: Record<string, unknown>
): Record<AiProvider, string> {
  return {
    gemini: normalizeString(raw[STORAGE_KEYS.GEMINI_API_KEY]),
    openai: normalizeString(raw[STORAGE_KEYS.OPENAI_API_KEY]),
    claude: normalizeString(raw[STORAGE_KEYS.CLAUDE_API_KEY]),
  };
}

export default function createUserPreferences(
  platform: StorageAdapter
): UserPreferences {
  return {
    async readInitialPreferences(): Promise<InitialPreferences> {
      const raw = await platform.read(ALL_PREFERENCE_KEYS);
      const apiKeys = normalizeApiKeys(raw);
      let settings = normalizeSettings(raw[STORAGE_KEYS.SETTINGS]);
      const theme = normalizeTheme(raw[STORAGE_KEYS.UI_THEME]);

      const hasAnyAvailableKey = Object.values(apiKeys).some(
        (key) => key.trim().length > 0
      );

      if (hasAnyAvailableKey && !isModelAvailable(settings.model, apiKeys)) {
        const compatibleModel = resolveCompatibleModel({
          currentModel: settings.model,
          apiKeys,
        });

        if (compatibleModel !== settings.model) {
          settings = { ...settings, model: compatibleModel };
          await platform.write({
            [STORAGE_KEYS.SETTINGS]: settings,
          });
        }
      }

      return {
        apiKeys,
        settings,
        theme,
      };
    },

    async getSettings(): Promise<Settings> {
      const raw = await platform.read([STORAGE_KEYS.SETTINGS]);
      return normalizeSettings(raw[STORAGE_KEYS.SETTINGS]);
    },

    async setSettings(settings: Settings): Promise<void> {
      await platform.write({
        [STORAGE_KEYS.SETTINGS]: settings,
      });
    },

    async getApiKey(provider: AiProvider = 'gemini'): Promise<string> {
      const key = API_KEY_STORAGE_KEYS[provider];
      const raw = await platform.read([key]);
      return normalizeString(raw[key]);
    },

    async setApiKey(provider: AiProvider, apiKey: string): Promise<void> {
      const key = API_KEY_STORAGE_KEYS[provider];
      await platform.write({ [key]: apiKey });
    },

    async getAllApiKeys(): Promise<Record<AiProvider, string>> {
      const raw = await platform.read(ALL_API_KEY_KEYS);
      return normalizeApiKeys(raw);
    },

    async getTheme(): Promise<Theme | null> {
      const raw = await platform.read([STORAGE_KEYS.UI_THEME]);
      return normalizeTheme(raw[STORAGE_KEYS.UI_THEME]);
    },

    async setTheme(theme: Theme): Promise<void> {
      await platform.write({
        [STORAGE_KEYS.UI_THEME]: theme,
      });
    },

    async clearApiKeys(): Promise<void> {
      await platform.write({
        [STORAGE_KEYS.GEMINI_API_KEY]: '',
        [STORAGE_KEYS.OPENAI_API_KEY]: '',
        [STORAGE_KEYS.CLAUDE_API_KEY]: '',
      });
    },
  };
}
