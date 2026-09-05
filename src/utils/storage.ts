import { ChatMessage } from '../sidepanel/ai';
import {
  AnalysisRecord,
  AnalysisRecordInput,
  createAnalysisHistory,
  createChromeAnalysisHistoryPlatform,
} from '../sidepanel/history';
import {
  createChromePreferencesPlatform,
  createUserPreferences,
  DEFAULT_SETTINGS,
  Provider,
  Settings,
  Theme,
} from '../sidepanel/preferences';

export type { Provider, Settings, Theme };
export { DEFAULT_SETTINGS };
export type { AnalysisRecord, AnalysisRecordInput };

export type HistoryItem = AnalysisRecord;
export type HistoryItemInput = AnalysisRecordInput;

/**
 * Stable names of values persisted in Chrome storage.
 *
 * Do not rename these values without adding a migration: they belong to the
 * user's browser profile and can outlive an extension update.
 */
export const STORAGE_KEYS = {
  GEMINI_API_KEY: 'gemini_api_key',
  OPENAI_API_KEY: 'openai_api_key',
  CLAUDE_API_KEY: 'claude_api_key',
  SETTINGS: 'summarizer_settings',
  HISTORY: 'summarizer_history',
  PANEL_PIN_STATE: 'panel_pin_state',
  UI_THEME: 'ui_theme',
} as const;

const defaultPreferences = createUserPreferences(
  createChromePreferencesPlatform()
);

const defaultAnalysisHistory = createAnalysisHistory(
  createChromeAnalysisHistoryPlatform()
);

// API Key Management
export function getApiKey(provider: Provider = 'gemini'): Promise<string> {
  return defaultPreferences.getApiKey(provider);
}

export function setApiKey(provider: Provider, apiKey: string): Promise<void> {
  return defaultPreferences.setApiKey(provider, apiKey);
}

export function getAllApiKeys(): Promise<Record<Provider, string>> {
  return defaultPreferences.getAllApiKeys();
}

// Settings Management
export function getSettings(): Promise<Settings> {
  return defaultPreferences.getSettings();
}

export function setSettings(settings: Settings): Promise<void> {
  return defaultPreferences.setSettings(settings);
}

// History Management
export function getHistory(): Promise<AnalysisRecord[]> {
  return defaultAnalysisHistory.getRecords();
}

export function saveHistoryItem(
  item: AnalysisRecordInput
): Promise<AnalysisRecord[]> {
  return defaultAnalysisHistory.saveRecord(item);
}

export function updateHistoryItemChat(
  videoId: string,
  chat: ChatMessage[]
): Promise<void> {
  return defaultAnalysisHistory.updateRecordChat(videoId, chat);
}

export function deleteHistoryItem(videoId: string): Promise<AnalysisRecord[]> {
  return defaultAnalysisHistory.deleteRecord(videoId);
}

export function clearHistory(): Promise<void> {
  return defaultAnalysisHistory.clearRecords();
}

/** Removes every saved API key and every history entry, preserving preferences. */
export async function clearApiKeysAndHistory(): Promise<void> {
  await defaultPreferences.clearApiKeys();
  await defaultAnalysisHistory.clearRecords();
}

export function getTheme(): Promise<Theme | null> {
  return defaultPreferences.getTheme();
}

export function setTheme(theme: Theme): Promise<void> {
  return defaultPreferences.setTheme(theme);
}

// Pin State Management
export function getPinState(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.PANEL_PIN_STATE], (result) => {
      resolve(result[STORAGE_KEYS.PANEL_PIN_STATE] === true);
    });
  });
}

export function setPinState(pinned: boolean): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.PANEL_PIN_STATE]: pinned }, () => {
      resolve();
    });
  });
}
