import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnalysisRecord,
  AnalysisRecordInput,
  ConversationMessage,
  TranscriptSegment,
} from '../domain/analysis';
import { clearApiKeysAndHistory } from '../sidepanel/dangerZone';
import { createAnalysisHistory } from '../sidepanel/history';
import {
  createUserPreferences,
  DEFAULT_SETTINGS,
} from '../sidepanel/preferences';
import {
  createChromeStorageLocalAdapter,
  STORAGE_KEYS,
  StorageAdapter,
} from './index';

describe('Storage Compatibility Suite (src/storage/storageCompatibility)', () => {
  let rawStorage: Record<string, unknown>;
  let mockStorageLocal: typeof chrome.storage.local;
  let adapter: StorageAdapter;

  const validTranscript: TranscriptSegment[] = [
    { start: 0, duration: 10, text: 'Wstęp' },
    { start: 10, duration: 20, text: 'Rozwinięcie' },
  ];

  const validChat: ConversationMessage[] = [
    { role: 'user', message: 'Jakie są wnioski?' },
    { role: 'model', message: 'Wnioski są obiecujące.' },
  ];

  const createSampleRecord = (
    id: string,
    overrides?: Partial<AnalysisRecord>
  ): AnalysisRecord => ({
    videoId: id,
    title: `Film ${id}`,
    author: `Autor ${id}`,
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    summary: `Podsumowanie filmu ${id}`,
    transcript: validTranscript,
    chat: validChat,
    createdAt: 1700000000000,
    ...overrides,
  });

  beforeEach(() => {
    rawStorage = {};
    mockStorageLocal = {
      get: vi.fn(
        (
          keys: string | string[] | Record<string, unknown> | null,
          callback: (items: Record<string, unknown>) => void
        ) => {
          const keyList = Array.isArray(keys) ? keys : [keys as string];
          const result = Object.fromEntries(
            keyList.map((k) => [k, rawStorage[k]])
          );
          callback(result);
        }
      ),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(rawStorage, items);
        if (callback) callback();
      }),
    } as unknown as typeof chrome.storage.local;

    global.chrome = {
      ...chrome,
      storage: {
        local: mockStorageLocal,
      },
    } as unknown as typeof chrome;

    adapter = createChromeStorageLocalAdapter(mockStorageLocal);
  });

  describe('1. All canonical storage keys contract', () => {
    it('declares all 7 persistent keys with unchanged stable values', () => {
      expect(STORAGE_KEYS.GEMINI_API_KEY).toBe('gemini_api_key');
      expect(STORAGE_KEYS.OPENAI_API_KEY).toBe('openai_api_key');
      expect(STORAGE_KEYS.CLAUDE_API_KEY).toBe('claude_api_key');
      expect(STORAGE_KEYS.SETTINGS).toBe('summarizer_settings');
      expect(STORAGE_KEYS.HISTORY).toBe('summarizer_history');
      expect(STORAGE_KEYS.PANEL_PIN_STATE).toBe('panel_pin_state');
      expect(STORAGE_KEYS.UI_THEME).toBe('ui_theme');

      expect(Object.keys(STORAGE_KEYS)).toHaveLength(7);
    });

    it('persists and reads back values under each canonical key through the shared adapter', async () => {
      const allValues = {
        [STORAGE_KEYS.GEMINI_API_KEY]: 'gemini-val',
        [STORAGE_KEYS.OPENAI_API_KEY]: 'openai-val',
        [STORAGE_KEYS.CLAUDE_API_KEY]: 'claude-val',
        [STORAGE_KEYS.SETTINGS]: {
          language: 'English',
          model: 'gemini-3.6-flash',
        },
        [STORAGE_KEYS.HISTORY]: [createSampleRecord('vid-1')],
        [STORAGE_KEYS.PANEL_PIN_STATE]: true,
        [STORAGE_KEYS.UI_THEME]: 'nord',
      };

      await adapter.write(allValues);

      const readBack = await adapter.read(Object.values(STORAGE_KEYS));
      expect(readBack).toEqual(allValues);
    });
  });

  describe('2. Legacy formats and partially invalid data', () => {
    it('normalizes legacy and partially invalid settings', async () => {
      const preferences = createUserPreferences(adapter);

      // Completely invalid non-object types fall back to DEFAULT_SETTINGS
      rawStorage[STORAGE_KEYS.SETTINGS] = 'invalid-string';
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );

      rawStorage[STORAGE_KEYS.SETTINGS] = null;
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );

      rawStorage[STORAGE_KEYS.SETTINGS] = 12345;
      await expect(preferences.getSettings()).resolves.toEqual(
        DEFAULT_SETTINGS
      );

      // Partially invalid: valid language, invalid model type
      rawStorage[STORAGE_KEYS.SETTINGS] = { language: 'English', model: 999 };
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'English',
        model: DEFAULT_SETTINGS.model,
      });

      // Partially invalid: null language, valid model
      rawStorage[STORAGE_KEYS.SETTINGS] = {
        language: null,
        model: 'gpt-5.6-luna',
      };
      await expect(preferences.getSettings()).resolves.toEqual({
        language: DEFAULT_SETTINGS.language,
        model: 'gpt-5.6-luna',
      });
    });

    it('normalizes non-string or malformed API keys to empty string', async () => {
      const preferences = createUserPreferences(adapter);

      rawStorage[STORAGE_KEYS.GEMINI_API_KEY] = 123;
      rawStorage[STORAGE_KEYS.OPENAI_API_KEY] = null;
      rawStorage[STORAGE_KEYS.CLAUDE_API_KEY] = { key: 'invalid' };

      await expect(preferences.getApiKey('gemini')).resolves.toBe('');
      await expect(preferences.getApiKey('openai')).resolves.toBe('');
      await expect(preferences.getApiKey('claude')).resolves.toBe('');
      await expect(preferences.getAllApiKeys()).resolves.toEqual({
        gemini: '',
        openai: '',
        claude: '',
      });
    });

    it('normalizes unrecognized themes to null while preserving night and nord', async () => {
      const preferences = createUserPreferences(adapter);

      rawStorage[STORAGE_KEYS.UI_THEME] = 'solarized';
      await expect(preferences.getTheme()).resolves.toBeNull();

      rawStorage[STORAGE_KEYS.UI_THEME] = 42;
      await expect(preferences.getTheme()).resolves.toBeNull();

      rawStorage[STORAGE_KEYS.UI_THEME] = 'night';
      await expect(preferences.getTheme()).resolves.toBe('night');

      rawStorage[STORAGE_KEYS.UI_THEME] = 'nord';
      await expect(preferences.getTheme()).resolves.toBe('nord');
    });

    it('handles panel pin state strictly preserving boolean true and false', async () => {
      rawStorage[STORAGE_KEYS.PANEL_PIN_STATE] = true;
      const readTrue = await adapter.read([STORAGE_KEYS.PANEL_PIN_STATE]);
      expect(readTrue[STORAGE_KEYS.PANEL_PIN_STATE] === true).toBe(true);

      rawStorage[STORAGE_KEYS.PANEL_PIN_STATE] = false;
      const readFalse = await adapter.read([STORAGE_KEYS.PANEL_PIN_STATE]);
      expect(readFalse[STORAGE_KEYS.PANEL_PIN_STATE] === true).toBe(false);

      // Non-boolean truthy values must not evaluate to boolean true
      rawStorage[STORAGE_KEYS.PANEL_PIN_STATE] = 'true';
      const readString = await adapter.read([STORAGE_KEYS.PANEL_PIN_STATE]);
      expect(readString[STORAGE_KEYS.PANEL_PIN_STATE] === true).toBe(false);

      rawStorage[STORAGE_KEYS.PANEL_PIN_STATE] = 1;
      const readNumber = await adapter.read([STORAGE_KEYS.PANEL_PIN_STATE]);
      expect(readNumber[STORAGE_KEYS.PANEL_PIN_STATE] === true).toBe(false);

      rawStorage[STORAGE_KEYS.PANEL_PIN_STATE] = null;
      const readNull = await adapter.read([STORAGE_KEYS.PANEL_PIN_STATE]);
      expect(readNull[STORAGE_KEYS.PANEL_PIN_STATE] === true).toBe(false);
    });

    it('accepts older record format with null summary and filters malformed records', async () => {
      const history = createAnalysisHistory(adapter);

      const recordWithSummary = createSampleRecord('rec-1', {
        summary: 'Już podsumowany',
      });
      const recordWithNullSummary = createSampleRecord('rec-2', {
        summary: null,
      }); // older format before summary generation

      rawStorage[STORAGE_KEYS.HISTORY] = [
        recordWithSummary,
        null,
        'not-a-record',
        { ...recordWithSummary, videoId: 123 }, // invalid videoId
        { ...recordWithSummary, title: undefined }, // missing title
        { ...recordWithSummary, author: null }, // missing author
        { ...recordWithSummary, thumbnailUrl: 123 }, // invalid thumbnail
        { ...recordWithSummary, summary: 456 }, // invalid summary type
        { ...recordWithSummary, transcript: 'invalid' }, // transcript not array
        {
          ...recordWithSummary,
          transcript: [{ start: 'zero', duration: 10, text: 'text' }],
        }, // invalid segment start
        { ...recordWithSummary, chat: [{ role: 'admin', message: 'Hello' }] }, // invalid role
        { ...recordWithSummary, createdAt: 'not-a-timestamp' }, // invalid createdAt
        recordWithNullSummary,
      ];

      const records = await history.getRecords();
      expect(records).toEqual([recordWithSummary, recordWithNullSummary]);
    });

    it('returns empty array when history in storage is not an array', async () => {
      const history = createAnalysisHistory(adapter);

      rawStorage[STORAGE_KEYS.HISTORY] = 'invalid-history-string';
      await expect(history.getRecords()).resolves.toEqual([]);

      rawStorage[STORAGE_KEYS.HISTORY] = null;
      await expect(history.getRecords()).resolves.toEqual([]);

      rawStorage[STORAGE_KEYS.HISTORY] = { videoId: 'vid-1' };
      await expect(history.getRecords()).resolves.toEqual([]);
    });
  });

  describe('3. History item limits and ordering', () => {
    it('enforces 50 items cap by placing newest at index 0 and dropping oldest', async () => {
      const history = createAnalysisHistory(adapter);

      const initial50: AnalysisRecord[] = Array.from({ length: 50 }, (_, i) =>
        createSampleRecord(`vid-${i}`, { createdAt: 1000 + i })
      );
      rawStorage[STORAGE_KEYS.HISTORY] = initial50;

      const input51: AnalysisRecordInput = {
        videoId: 'vid-new-51',
        title: 'Najnowszy Film',
        author: 'Autor',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        summary: 'Nowe podsumowanie',
        transcript: [],
        chat: [],
      };

      const updated = await history.saveRecord(input51);

      expect(updated).toHaveLength(50);
      expect(updated[0].videoId).toBe('vid-new-51');
      expect(updated[1].videoId).toBe('vid-0');
      expect(updated[49].videoId).toBe('vid-48'); // oldest (vid-49) was dropped
    });

    it('deduplicates by videoId when saving and moves updated record to index 0', async () => {
      const history = createAnalysisHistory(adapter);

      await history.saveRecord({
        videoId: 'vid-a',
        title: 'Film A',
        author: 'Autor A',
        thumbnailUrl: 'https://example.com/a.jpg',
        summary: 'Podsumowanie A',
        transcript: [],
        chat: [],
      });
      await history.saveRecord({
        videoId: 'vid-b',
        title: 'Film B',
        author: 'Autor B',
        thumbnailUrl: 'https://example.com/b.jpg',
        summary: 'Podsumowanie B',
        transcript: [],
        chat: [],
      });

      const updated = await history.saveRecord({
        videoId: 'vid-a',
        title: 'Zaktualizowany Film A',
        author: 'Autor A',
        thumbnailUrl: 'https://example.com/a.jpg',
        summary: 'Nowe podsumowanie A',
        transcript: [],
        chat: [],
      });

      expect(updated).toHaveLength(2);
      expect(updated[0].videoId).toBe('vid-a');
      expect(updated[0].title).toBe('Zaktualizowany Film A');
      expect(updated[1].videoId).toBe('vid-b');
    });

    it('updates chat for existing record in-place preserving its position and other records', async () => {
      const history = createAnalysisHistory(adapter);

      rawStorage[STORAGE_KEYS.HISTORY] = [
        createSampleRecord('vid-1', { chat: [] }),
        createSampleRecord('vid-2', { chat: [] }),
      ];

      const newChat: ConversationMessage[] = [
        { role: 'user', message: 'Pytanie' },
      ];
      await history.updateRecordChat('vid-2', newChat);

      const records = await history.getRecords();
      expect(records[0].videoId).toBe('vid-1');
      expect(records[0].chat).toEqual([]);
      expect(records[1].videoId).toBe('vid-2');
      expect(records[1].chat).toEqual(newChat);
    });

    it('performs high-level saveChat upsert preserving ordering when updating and adding to index 0 when creating', async () => {
      const history = createAnalysisHistory(adapter);

      rawStorage[STORAGE_KEYS.HISTORY] = [
        createSampleRecord('vid-1', { chat: [], createdAt: 100 }),
        createSampleRecord('vid-2', { chat: [], createdAt: 200 }),
      ];

      // Update existing vid-2: position and createdAt preserved
      const updatedChat = [{ role: 'user' as const, message: 'Wiadomość' }];
      await history.saveChat({
        ...createSampleRecord('vid-2'),
        chat: updatedChat,
      });

      let records = await history.getRecords();
      expect(records).toHaveLength(2);
      expect(records[0].videoId).toBe('vid-1');
      expect(records[1].videoId).toBe('vid-2');
      expect(records[1].chat).toEqual(updatedChat);
      expect(records[1].createdAt).toBe(200);

      // Create new vid-3: added at index 0
      await history.saveChat({
        ...createSampleRecord('vid-3'),
        chat: [{ role: 'user' as const, message: 'Nowy' }],
      });

      records = await history.getRecords();
      expect(records).toHaveLength(3);
      expect(records[0].videoId).toBe('vid-3');
      expect(records[1].videoId).toBe('vid-1');
      expect(records[2].videoId).toBe('vid-2');
    });

    it('deletes specific record by videoId and keeps remaining records in order', async () => {
      const history = createAnalysisHistory(adapter);

      rawStorage[STORAGE_KEYS.HISTORY] = [
        createSampleRecord('vid-1'),
        createSampleRecord('vid-2'),
        createSampleRecord('vid-3'),
      ];

      const remaining = await history.deleteRecord('vid-2');
      expect(remaining.map((r) => r.videoId)).toEqual(['vid-1', 'vid-3']);

      const readBack = await history.getRecords();
      expect(readBack.map((r) => r.videoId)).toEqual(['vid-1', 'vid-3']);
    });
  });

  describe('4. Clearing API keys and history while preserving preferences', () => {
    it('clears all API keys and history while preserving settings and theme', async () => {
      const preferences = createUserPreferences(adapter);
      const history = createAnalysisHistory(adapter);

      await preferences.setApiKey('gemini', 'key-gemini');
      await preferences.setApiKey('openai', 'key-openai');
      await preferences.setApiKey('claude', 'key-claude');
      await preferences.setSettings({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });
      await preferences.setTheme('nord');
      await adapter.write({ [STORAGE_KEYS.PANEL_PIN_STATE]: true });
      await history.saveRecord({
        videoId: 'vid-to-clear',
        title: 'Tytuł',
        author: 'Autor',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        summary: 'Podsumowanie',
        transcript: [],
        chat: [],
      });

      await clearApiKeysAndHistory({ preferences, history });

      await expect(preferences.getApiKey('gemini')).resolves.toBe('');
      await expect(preferences.getApiKey('openai')).resolves.toBe('');
      await expect(preferences.getApiKey('claude')).resolves.toBe('');
      await expect(history.getRecords()).resolves.toEqual([]);
      await expect(preferences.getSettings()).resolves.toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });
      await expect(preferences.getTheme()).resolves.toBe('nord');
      const pinRead = await adapter.read([STORAGE_KEYS.PANEL_PIN_STATE]);
      expect(pinRead[STORAGE_KEYS.PANEL_PIN_STATE]).toBe(true);
    });
  });

  describe('5. chrome.storage.session isolation', () => {
    it('does not include any session keys in STORAGE_KEYS or persistent storage operations', () => {
      const sessionKeys = [
        'local_open_panel_tab_ids',
        'pinned_panel_window_id',
      ];
      const persistentKeys = Object.values(STORAGE_KEYS);

      sessionKeys.forEach((sessionKey) => {
        expect(persistentKeys).not.toContain(sessionKey);
      });
    });
  });
});
