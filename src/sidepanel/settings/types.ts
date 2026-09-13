import type { AiProvider } from '../ai';
import type { PanelTheme } from '../theme';

export interface Settings {
  language: string;
  model: string;
}

export type { PanelTheme };
export type Theme = PanelTheme;

export interface InitialPreferences {
  apiKeys: Record<AiProvider, string>;
  settings: Settings;
  theme: PanelTheme | null;
}

export interface UserPreferencesStore {
  readInitialPreferences(): Promise<InitialPreferences>;
  setSettings(settings: Settings): Promise<void>;
  setApiKey(provider: AiProvider, apiKey: string): Promise<void>;
  setTheme(theme: PanelTheme): Promise<void>;
  clearApiKeys(): Promise<void>;
}
