import { describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../../storage';
import { StorageAdapter } from '../../storage/types';
import { createAnalysisHistory } from '../history';
import { clearUserData, ClearUserDataDependencies } from './clearUserData';
import createUserPreferencesStore from './userPreferencesStore';

function createMemoryStorageAdapter(
  initialData: Record<string, unknown> = {}
): StorageAdapter & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { ...initialData };
  return {
    data,
    async read(keys: readonly string[]): Promise<Record<string, unknown>> {
      return Object.fromEntries(keys.map((key) => [key, data[key]]));
    },
    async write(values: Record<string, unknown>): Promise<void> {
      Object.assign(data, values);
    },
  };
}

describe('Clear User Data use case (src/sidepanel/settings/clearUserData)', () => {
  it('orchestrates data deletion explicitly through settings and history dependencies', async () => {
    const mockSettings: ClearUserDataDependencies['settings'] = {
      clearApiKeys: vi.fn(async () => undefined),
    };
    const mockHistory: ClearUserDataDependencies['history'] = {
      clearRecords: vi.fn(async () => undefined),
    };

    await clearUserData({
      settings: mockSettings,
      history: mockHistory,
    });

    expect(mockSettings.clearApiKeys).toHaveBeenCalledTimes(1);
    expect(mockHistory.clearRecords).toHaveBeenCalledTimes(1);
  });

  it('removes every API key together with analysis history while preserving settings, theme, and pin state', async () => {
    const memory = createMemoryStorageAdapter();
    const settingsStore = createUserPreferencesStore(memory);
    const history = createAnalysisHistory(memory);

    // Initial state setup across all storage areas
    await settingsStore.setApiKey('gemini', 'sk-gemini-secret');
    await settingsStore.setApiKey('openai', 'sk-openai-secret');
    await settingsStore.setApiKey('claude', 'sk-claude-secret');
    await settingsStore.setSettings({
      language: 'English',
      model: 'gpt-5.6-terra',
    });
    await settingsStore.setTheme('nord');
    await memory.write({ [STORAGE_KEYS.PANEL_PIN_STATE]: true });

    await history.saveRecord({
      videoId: 'vid-test-123',
      title: 'Film weryfikacyjny',
      author: 'Tester',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      summary: 'Podsumowanie do usunięcia',
      transcript: [{ text: 'Tekst', start: 0, duration: 5 }],
      chat: [{ role: 'user', message: 'Wiadomość' }],
    });

    // Verify initial population
    const initialKeys = await settingsStore.getAllApiKeys();
    expect(initialKeys.gemini).toBe('sk-gemini-secret');
    expect(initialKeys.openai).toBe('sk-openai-secret');
    expect(initialKeys.claude).toBe('sk-claude-secret');
    expect(await history.getRecords()).toHaveLength(1);

    // Execute clearUserData operation
    await clearUserData({
      settings: settingsStore,
      history,
    });

    // Assert: API keys are cleared
    const postKeys = await settingsStore.getAllApiKeys();
    expect(postKeys).toEqual({
      gemini: '',
      openai: '',
      claude: '',
    });

    // Assert: Analysis history is cleared
    const postRecords = await history.getRecords();
    expect(postRecords).toEqual([]);

    // Assert: Remaining user settings, theme, and pin state are strictly preserved
    const postSettings = await settingsStore.getSettings();
    expect(postSettings).toEqual({
      language: 'English',
      model: 'gpt-5.6-terra',
    });

    const postTheme = await settingsStore.getTheme();
    expect(postTheme).toBe('nord');

    const readRaw = await memory.read([STORAGE_KEYS.PANEL_PIN_STATE]);
    expect(readRaw[STORAGE_KEYS.PANEL_PIN_STATE]).toBe(true);
  });
});
