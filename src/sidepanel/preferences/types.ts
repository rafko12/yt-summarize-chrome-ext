import type { StorageAdapter } from '../../storage';
import type { AiProvider } from '../ai';

export type { AiProvider };

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

export type PreferencesPlatform = StorageAdapter;

export interface UserPreferences {
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

export interface SettingsViewProps {
  selectedProvider: AiProvider;
  apiKeys: Record<AiProvider, string>;
  apiKeyInput: string;
  showKey: boolean;
  isCheckingKey: boolean;
  keyValidationMsg: { text: string; success: boolean } | null;
  settings: Settings;
  hasAnyKey: boolean;
  historyListLength: number;
  onSelectProvider: (p: AiProvider) => void;
  onApiKeyInputChange: (val: string) => void;
  onToggleShowKey: () => void;
  onSaveApiKey: () => void;
  onDeleteApiKey: (p: AiProvider) => void;
  onModelChange: (val: string) => void;
  onLanguageChange: (val: string) => void;
  onClearHistory: () => void;
  onClearApiKeysAndHistory: () => void;
}
