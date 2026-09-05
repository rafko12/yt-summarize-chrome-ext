/**
 * Stable names of values persisted in Chrome local storage.
 *
 * Do not rename these values without adding a lossless, versioned migration:
 * they belong to the user's browser profile and can outlive an extension update.
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

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
