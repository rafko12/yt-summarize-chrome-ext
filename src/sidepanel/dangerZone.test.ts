import { describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../storage';
import { StorageAdapter } from '../storage/types';
import { clearApiKeysAndHistory, DangerZoneOwners } from './dangerZone';
import { createAnalysisHistory } from './history';
import { createUserPreferences } from './preferences';

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

describe('Danger Zone Cleanup (src/sidepanel/dangerZone)', () => {
  it('orchestrates data deletion explicitly through preferences and history owners', async () => {
    const mockPreferences: DangerZoneOwners['preferences'] = {
      clearApiKeys: vi.fn(async () => undefined),
    };
    const mockHistory: DangerZoneOwners['history'] = {
      clearRecords: vi.fn(async () => undefined),
    };

    await clearApiKeysAndHistory({
      preferences: mockPreferences,
      history: mockHistory,
    });

    expect(mockPreferences.clearApiKeys).toHaveBeenCalledTimes(1);
    expect(mockHistory.clearRecords).toHaveBeenCalledTimes(1);
  });

  it('removes every API key together with analysis history while preserving settings, theme, and pin state', async () => {
    const memory = createMemoryStorageAdapter();
    const preferences = createUserPreferences(memory);
    const history = createAnalysisHistory(memory);

    // Initial state setup across all storage areas
    await preferences.setApiKey('gemini', 'sk-gemini-secret');
    await preferences.setApiKey('openai', 'sk-openai-secret');
    await preferences.setApiKey('claude', 'sk-claude-secret');
    await preferences.setSettings({
      language: 'English',
      model: 'gpt-5.6-terra',
    });
    await preferences.setTheme('nord');
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
    const initialKeys = await preferences.getAllApiKeys();
    expect(initialKeys.gemini).toBe('sk-gemini-secret');
    expect(initialKeys.openai).toBe('sk-openai-secret');
    expect(initialKeys.claude).toBe('sk-claude-secret');
    expect(await history.getRecords()).toHaveLength(1);

    // Execute danger zone clear operation
    await clearApiKeysAndHistory({ preferences, history });

    // Assert: API keys are cleared
    const postKeys = await preferences.getAllApiKeys();
    expect(postKeys).toEqual({
      gemini: '',
      openai: '',
      claude: '',
    });

    // Assert: Analysis history is cleared
    const postRecords = await history.getRecords();
    expect(postRecords).toEqual([]);

    // Assert: Remaining user preferences and pin state are strictly preserved
    const postSettings = await preferences.getSettings();
    expect(postSettings).toEqual({
      language: 'English',
      model: 'gpt-5.6-terra',
    });

    const postTheme = await preferences.getTheme();
    expect(postTheme).toBe('nord');

    const readRaw = await memory.read([STORAGE_KEYS.PANEL_PIN_STATE]);
    expect(readRaw[STORAGE_KEYS.PANEL_PIN_STATE]).toBe(true);
  });
});
