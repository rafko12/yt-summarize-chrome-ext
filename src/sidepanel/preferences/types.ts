import type { AiProvider } from '../ai';

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

export interface SettingsViewProps {
  selectedProvider: Provider;
  apiKeys: Record<Provider, string>;
  apiKeyInput: string;
  showKey: boolean;
  isCheckingKey: boolean;
  keyValidationMsg: { text: string; success: boolean } | null;
  settings: Settings;
  hasAnyKey: boolean;
  historyListLength: number;
  onSelectProvider: (p: Provider) => void;
  onApiKeyInputChange: (val: string) => void;
  onToggleShowKey: () => void;
  onSaveApiKey: () => void;
  onDeleteApiKey: (p: Provider) => void;
  onModelChange: (val: string) => void;
  onLanguageChange: (val: string) => void;
  onClearHistory: () => void;
  onClearApiKeysAndHistory: () => void;
}
