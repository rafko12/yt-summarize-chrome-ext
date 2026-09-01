import { isModelAvailable, resolveCompatibleModel } from '../llm/modelPolicy';
import { AiProvider } from '../llm/registry';

export type Provider = AiProvider;

export interface Settings {
  language: string;
  model: string;
}

export type Theme = 'night' | 'nord';

export interface InitialPreferences {
  apiKeys: Record<Provider, string>;
  settings: Settings;
  theme: Theme | null;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'Polski',
  model: 'gemini-3.5-flash',
};

const PREFERENCE_STORAGE_KEYS = {
  GEMINI_API_KEY: 'gemini_api_key',
  OPENAI_API_KEY: 'openai_api_key',
  CLAUDE_API_KEY: 'claude_api_key',
  SETTINGS: 'summarizer_settings',
  UI_THEME: 'ui_theme',
} as const;

const API_KEY_STORAGE_KEYS: Record<Provider, string> = {
  gemini: PREFERENCE_STORAGE_KEYS.GEMINI_API_KEY,
  openai: PREFERENCE_STORAGE_KEYS.OPENAI_API_KEY,
  claude: PREFERENCE_STORAGE_KEYS.CLAUDE_API_KEY,
};

const ALL_API_KEY_KEYS = [
  PREFERENCE_STORAGE_KEYS.GEMINI_API_KEY,
  PREFERENCE_STORAGE_KEYS.OPENAI_API_KEY,
  PREFERENCE_STORAGE_KEYS.CLAUDE_API_KEY,
] as const;

const ALL_PREFERENCE_KEYS = [
  ...ALL_API_KEY_KEYS,
  PREFERENCE_STORAGE_KEYS.SETTINGS,
  PREFERENCE_STORAGE_KEYS.UI_THEME,
] as const;

export interface PreferencesPlatform {
  read(keys: readonly string[]): Promise<Record<string, unknown>>;
  write(values: Record<string, unknown>): Promise<void>;
}

export interface UserPreferences {
  readInitialPreferences(): Promise<InitialPreferences>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<void>;
  getApiKey(provider?: Provider): Promise<string>;
  setApiKey(provider: Provider, apiKey: string): Promise<void>;
  getAllApiKeys(): Promise<Record<Provider, string>>;
  getTheme(): Promise<Theme | null>;
  setTheme(theme: Theme): Promise<void>;
  clearApiKeys(): Promise<void>;
}

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
): Record<Provider, string> {
  return {
    gemini: normalizeString(raw[PREFERENCE_STORAGE_KEYS.GEMINI_API_KEY]),
    openai: normalizeString(raw[PREFERENCE_STORAGE_KEYS.OPENAI_API_KEY]),
    claude: normalizeString(raw[PREFERENCE_STORAGE_KEYS.CLAUDE_API_KEY]),
  };
}

export default function createUserPreferences(
  platform: PreferencesPlatform
): UserPreferences {
  return {
    async readInitialPreferences(): Promise<InitialPreferences> {
      const raw = await platform.read(ALL_PREFERENCE_KEYS);
      const apiKeys = normalizeApiKeys(raw);
      let settings = normalizeSettings(raw[PREFERENCE_STORAGE_KEYS.SETTINGS]);
      const theme = normalizeTheme(raw[PREFERENCE_STORAGE_KEYS.UI_THEME]);

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
            [PREFERENCE_STORAGE_KEYS.SETTINGS]: settings,
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
      const raw = await platform.read([PREFERENCE_STORAGE_KEYS.SETTINGS]);
      return normalizeSettings(raw[PREFERENCE_STORAGE_KEYS.SETTINGS]);
    },

    async setSettings(settings: Settings): Promise<void> {
      await platform.write({
        [PREFERENCE_STORAGE_KEYS.SETTINGS]: settings,
      });
    },

    async getApiKey(provider: Provider = 'gemini'): Promise<string> {
      const key = API_KEY_STORAGE_KEYS[provider];
      const raw = await platform.read([key]);
      return normalizeString(raw[key]);
    },

    async setApiKey(provider: Provider, apiKey: string): Promise<void> {
      const key = API_KEY_STORAGE_KEYS[provider];
      await platform.write({ [key]: apiKey });
    },

    async getAllApiKeys(): Promise<Record<Provider, string>> {
      const raw = await platform.read(ALL_API_KEY_KEYS);
      return normalizeApiKeys(raw);
    },

    async getTheme(): Promise<Theme | null> {
      const raw = await platform.read([PREFERENCE_STORAGE_KEYS.UI_THEME]);
      return normalizeTheme(raw[PREFERENCE_STORAGE_KEYS.UI_THEME]);
    },

    async setTheme(theme: Theme): Promise<void> {
      await platform.write({
        [PREFERENCE_STORAGE_KEYS.UI_THEME]: theme,
      });
    },

    async clearApiKeys(): Promise<void> {
      await platform.write({
        [PREFERENCE_STORAGE_KEYS.GEMINI_API_KEY]: '',
        [PREFERENCE_STORAGE_KEYS.OPENAI_API_KEY]: '',
        [PREFERENCE_STORAGE_KEYS.CLAUDE_API_KEY]: '',
      });
    },
  };
}
