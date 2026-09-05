import { describe, expect, it } from 'vitest';

import { STORAGE_KEYS, StorageKey } from './keys';

describe('Canonical STORAGE_KEYS (src/storage/keys)', () => {
  it('declares all persistent storage keys with their exact stable string values', () => {
    expect(STORAGE_KEYS).toEqual({
      GEMINI_API_KEY: 'gemini_api_key',
      OPENAI_API_KEY: 'openai_api_key',
      CLAUDE_API_KEY: 'claude_api_key',
      SETTINGS: 'summarizer_settings',
      HISTORY: 'summarizer_history',
      PANEL_PIN_STATE: 'panel_pin_state',
      UI_THEME: 'ui_theme',
    });
  });

  it('contains exactly the 7 persistent storage keys', () => {
    const keys = Object.keys(STORAGE_KEYS);
    expect(keys).toHaveLength(7);
  });

  it('does not contain any chrome.storage.session keys', () => {
    const keyValues = Object.values(STORAGE_KEYS);
    expect(keyValues).not.toContain('local_open_panel_tab_ids');
    expect(keyValues).not.toContain('pinned_panel_window_id');
  });

  it('allows referencing keys via StorageKey type', () => {
    const sampleKey: StorageKey = STORAGE_KEYS.SETTINGS;
    expect(sampleKey).toBe('summarizer_settings');
  });
});
