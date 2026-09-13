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
  setSettings(settings: Settings): Promise<void>;
  setApiKey(provider: AiProvider, apiKey: string): Promise<void>;
  setTheme(theme: Theme): Promise<void>;
  clearApiKeys(): Promise<void>;
}
