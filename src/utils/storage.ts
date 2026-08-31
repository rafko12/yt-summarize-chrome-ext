import { ChatMessage, TranscriptItem } from '../llm/types';
import createChromePreferencesPlatform from '../preferences/chromePreferencesPlatform';
import createUserPreferences, {
  DEFAULT_SETTINGS,
  Provider,
  Settings,
  Theme,
} from '../preferences/userPreferences';

export type { Provider, Settings, Theme };
export { DEFAULT_SETTINGS };

export interface HistoryItem {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  summary: string | null;
  transcript: TranscriptItem[];
  chat: ChatMessage[];
  createdAt: number;
}

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

const API_KEY_STORAGE_KEYS: Record<Provider, string> = {
  gemini: STORAGE_KEYS.GEMINI_API_KEY,
  openai: STORAGE_KEYS.OPENAI_API_KEY,
  claude: STORAGE_KEYS.CLAUDE_API_KEY,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTranscriptItem(value: unknown): value is TranscriptItem {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    typeof value.start === 'number' &&
    typeof value.duration === 'number'
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    (value.role === 'user' || value.role === 'model') &&
    typeof value.message === 'string'
  );
}

function isHistoryItem(value: unknown): value is HistoryItem {
  return (
    isRecord(value) &&
    typeof value.videoId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.author === 'string' &&
    typeof value.thumbnailUrl === 'string' &&
    (typeof value.summary === 'string' || value.summary === null) &&
    Array.isArray(value.transcript) &&
    value.transcript.every(isTranscriptItem) &&
    Array.isArray(value.chat) &&
    value.chat.every(isChatMessage) &&
    typeof value.createdAt === 'number'
  );
}

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
export function getHistory(): Promise<HistoryItem[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.HISTORY], (result) => {
      const storedHistory = result[STORAGE_KEYS.HISTORY];
      resolve(
        Array.isArray(storedHistory) ? storedHistory.filter(isHistoryItem) : []
      );
    });
  });
}

export async function saveHistoryItem(
  item: Omit<HistoryItem, 'createdAt'>
): Promise<HistoryItem[]> {
  const history = await getHistory();

  // Filter out any existing item with the same videoId to avoid duplicates
  const filteredHistory = history.filter((i) => i.videoId !== item.videoId);

  const newItem: HistoryItem = {
    ...item,
    createdAt: Date.now(),
  };

  // Add to the beginning of the list
  const updatedHistory = [newItem, ...filteredHistory];

  // Keep history length capped at e.g. 50 items to conserve space
  const cappedHistory = updatedHistory.slice(0, 50);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: cappedHistory }, () => {
      resolve(cappedHistory);
    });
  });
}

export async function updateHistoryItemChat(
  videoId: string,
  chat: ChatMessage[]
): Promise<void> {
  const history = await getHistory();
  const itemIndex = history.findIndex((i) => i.videoId === videoId);
  if (itemIndex > -1) {
    history[itemIndex].chat = chat;
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history }, () => {
        resolve();
      });
    });
  }
}

export async function deleteHistoryItem(
  videoId: string
): Promise<HistoryItem[]> {
  const history = await getHistory();
  const updatedHistory = history.filter((i) => i.videoId !== videoId);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updatedHistory }, () => {
      resolve(updatedHistory);
    });
  });
}

export function clearHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: [] }, () => {
      resolve();
    });
  });
}

/** Removes every saved API key and every history entry, preserving preferences. */
export function clearApiKeysAndHistory(): Promise<void> {
  const keysToRemove = [
    ...Object.values(API_KEY_STORAGE_KEYS),
    STORAGE_KEYS.HISTORY,
  ];
  return new Promise((resolve) => {
    chrome.storage.local.remove(keysToRemove, () => {
      resolve();
    });
  });
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
