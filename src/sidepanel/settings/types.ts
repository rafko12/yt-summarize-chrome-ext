import type { AiProvider } from '../ai';

export interface Settings {
  language: string;
  model: string;
}

export type Theme = 'night' | 'nord';

export interface InitialPreferences {
  apiKeys: Record<AiProvider, string>;
  settings: Settings;
  theme: Theme | null;
}

export interface UserPreferencesStore {
  readInitialPreferences(): Promise<InitialPreferences>;
  getSettings(): Promise<Settings>;
  setSettings(settings: Settings): Promise<void>;
  getApiKey(provider?: AiProvider): Promise<string>;
  setApiKey(provider: AiProvider, apiKey: string): Promise<void>;
  getAllApiKeys(): Promise<Record<AiProvider, string>>;
  getTheme(): Promise<Theme | null>;
  setTheme(theme: Theme): Promise<void>;
  clearApiKeys(): Promise<void>;
}

export type UserPreferences = UserPreferencesStore;
