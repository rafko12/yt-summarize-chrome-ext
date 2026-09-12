import { describe, expect, it } from 'vitest';

import {
  AnalysisRecord,
  AnalysisRecordInput,
  ConversationMessage,
  TranscriptSegment,
} from '../../domain/analysis';
import { StorageAdapter } from '../../storage';
import { createAnalysisHistory } from './index';

function createMemoryPlatform(
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

const sampleTranscript: TranscriptSegment[] = [
  { text: 'Wstęp do filmu', start: 0, duration: 15 },
  { text: 'Główna część', start: 15, duration: 45 },
];

const sampleChat: ConversationMessage[] = [
  { role: 'user', message: 'O czym jest ten film?' },
  { role: 'model', message: 'Film przedstawia architekturę rozszerzenia.' },
];

const sampleRecordInput: AnalysisRecordInput = {
  videoId: 'video-1',
  title: 'Film 1 - Architektura',
  author: 'Autor 1',
  thumbnailUrl: 'https://img.youtube.com/vi/video-1/hqdefault.jpg',
  summary: 'Podsumowanie filmu 1',
  transcript: sampleTranscript,
  chat: sampleChat,
};

describe('AnalysisHistory (src/sidepanel/history)', () => {
  it('returns empty array when storage is empty or contains non-array data', async () => {
    const emptyPlatform = createMemoryPlatform({});
    const history = createAnalysisHistory(emptyPlatform);

    await expect(history.getRecords()).resolves.toEqual([]);

    const malformedPlatform = createMemoryPlatform({
      summarizer_history: 'not-an-array',
    });
    const malformedHistory = createAnalysisHistory(malformedPlatform);

    await expect(malformedHistory.getRecords()).resolves.toEqual([]);
  });

  it('filters malformed items and preserves all valid analysis records', async () => {
    const validRecord: AnalysisRecord = {
      ...sampleRecordInput,
      createdAt: 1700000000000,
    };

    const platform = createMemoryPlatform({
      summarizer_history: [
        validRecord,
        null,
        123,
        { ...validRecord, videoId: 123 }, // invalid videoId type
        { ...validRecord, title: undefined }, // missing title
        { ...validRecord, author: null }, // invalid author
        { ...validRecord, thumbnailUrl: 456 }, // invalid thumbnail
        { ...validRecord, summary: 789 }, // invalid summary (must be string | null)
        { ...validRecord, transcript: 'invalid' }, // transcript not an array
        {
          ...validRecord,
          transcript: [{ text: 123, start: 0, duration: 10 }], // transcript item text not a string
        },
        {
          ...validRecord,
          transcript: [{ text: 'valid', start: 'zero', duration: 10 }], // start not a number
        },
        {
          ...validRecord,
          transcript: [{ text: 'valid', start: 0, duration: 'ten' }], // duration not a number
        },
        {
          ...validRecord,
          transcript: [null], // transcript item not an object
        },
        { ...validRecord, chat: 'invalid' }, // chat not an array
        {
          ...validRecord,
          chat: [{ role: 'invalid_role', message: 'hello' }], // invalid chat role
        },
        {
          ...validRecord,
          chat: [{ role: 'user', message: 123 }], // message not a string
        },
        {
          ...validRecord,
          chat: [null], // chat item not an object
        },
        { ...validRecord, createdAt: 'not-a-number' }, // createdAt not a number
      ],
    });

    const history = createAnalysisHistory(platform);
    const records = await history.getRecords();

    expect(records).toEqual([validRecord]);
  });

  it('saves new analysis record at the beginning of the list with createdAt timestamp', async () => {
    const platform = createMemoryPlatform({});
    const history = createAnalysisHistory(platform);

    const before = Date.now();
    const saved = await history.saveRecord(sampleRecordInput);
    const after = Date.now();

    expect(saved).toHaveLength(1);
    expect(saved[0].videoId).toBe('video-1');
    expect(saved[0].title).toBe('Film 1 - Architektura');
    expect(saved[0].summary).toBe('Podsumowanie filmu 1');
    expect(saved[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(saved[0].createdAt).toBeLessThanOrEqual(after);

    const readBack = await history.getRecords();
    expect(readBack).toEqual(saved);
  });

  it('updates existing record and avoids duplicates for the same video', async () => {
    const platform = createMemoryPlatform({});
    const history = createAnalysisHistory(platform);

    await history.saveRecord(sampleRecordInput);
    await history.saveRecord({
      ...sampleRecordInput,
      videoId: 'video-2',
      title: 'Film 2',
    });

    const updated = await history.saveRecord({
      ...sampleRecordInput,
      title: 'Zaktualizowany tytuł 1',
      summary: 'Nowe podsumowanie 1',
    });

    expect(updated).toHaveLength(2);
    expect(updated[0].videoId).toBe('video-1');
    expect(updated[0].title).toBe('Zaktualizowany tytuł 1');
    expect(updated[0].summary).toBe('Nowe podsumowanie 1');
    expect(updated[1].videoId).toBe('video-2');
  });

  it('maintains limit of 50 items and preserves newest while dropping oldest', async () => {
    const initialRecords: AnalysisRecord[] = Array.from(
      { length: 50 },
      (_, i) => ({
        ...sampleRecordInput,
        videoId: `vid-${i + 1}`,
        title: `Film ${i + 1}`,
        createdAt: 1000 + i,
      })
    );
    const platform = createMemoryPlatform({
      summarizer_history: initialRecords,
    });
    const history = createAnalysisHistory(platform);

    await history.saveRecord({
      ...sampleRecordInput,
      videoId: 'vid-51',
      title: 'Film 51',
    });

    const records = await history.getRecords();
    expect(records).toHaveLength(50);
    expect(records[0].videoId).toBe('vid-51');
    expect(records[49].videoId).toBe('vid-49');
  });

  it('updates chat messages exclusively for the matching existing record', async () => {
    const platform = createMemoryPlatform({});
    const history = createAnalysisHistory(platform);

    await history.saveRecord(sampleRecordInput);
    await history.saveRecord({
      ...sampleRecordInput,
      videoId: 'video-2',
      title: 'Film 2',
      chat: [],
    });

    const newChat: ConversationMessage[] = [
      { role: 'user', message: 'Pytanie uzupełniające' },
      { role: 'model', message: 'Odpowiedź uzupełniająca' },
    ];

    await history.updateRecordChat('video-1', newChat);

    const records = await history.getRecords();
    const updatedRecord = records.find((r) => r.videoId === 'video-1');
    const untouchedRecord = records.find((r) => r.videoId === 'video-2');

    expect(updatedRecord?.chat).toEqual(newChat);
    expect(untouchedRecord?.chat).toEqual([]);

    // Updating a non-existent video does not alter storage
    await history.updateRecordChat('non-existent-video', [
      { role: 'user', message: 'Ghost message' },
    ]);

    const recordsAfterMissing = await history.getRecords();
    expect(recordsAfterMissing).toEqual(records);
  });

  it('deletes single record without affecting others', async () => {
    const platform = createMemoryPlatform({});
    const history = createAnalysisHistory(platform);

    await history.saveRecord({ ...sampleRecordInput, videoId: 'v1' });
    await history.saveRecord({ ...sampleRecordInput, videoId: 'v2' });
    await history.saveRecord({ ...sampleRecordInput, videoId: 'v3' });

    const remaining = await history.deleteRecord('v2');
    expect(remaining.map((r) => r.videoId)).toEqual(['v3', 'v1']);

    const readBack = await history.getRecords();
    expect(readBack.map((r) => r.videoId)).toEqual(['v3', 'v1']);
  });

  it('clears all records leaving an empty history', async () => {
    const platform = createMemoryPlatform({});
    const history = createAnalysisHistory(platform);

    await history.saveRecord(sampleRecordInput);
    await history.saveRecord({ ...sampleRecordInput, videoId: 'v2' });

    await history.clearRecords();

    await expect(history.getRecords()).resolves.toEqual([]);
    expect(platform.data.summarizer_history).toEqual([]);
  });

  describe('saveChat (canonical chat persistence operation)', () => {
    it('creates a new record when videoId does not exist in history', async () => {
      const platform = createMemoryPlatform({});
      const history = createAnalysisHistory(platform);

      const before = Date.now();
      const updated = await history.saveChat({
        ...sampleRecordInput,
        videoId: 'new-session-vid',
        title: 'Nowa sesja',
        summary: null,
      });
      const after = Date.now();

      expect(updated).toHaveLength(1);
      expect(updated[0].videoId).toBe('new-session-vid');
      expect(updated[0].title).toBe('Nowa sesja');
      expect(updated[0].summary).toBeNull();
      expect(updated[0].createdAt).toBeGreaterThanOrEqual(before);
      expect(updated[0].createdAt).toBeLessThanOrEqual(after);

      const records = await history.getRecords();
      expect(records).toEqual(updated);
    });

    it('updates only chat for existing record even if caller provides different metadata, transcript, or summary', async () => {
      const platform = createMemoryPlatform({});
      const history = createAnalysisHistory(platform);

      await history.saveRecord({
        ...sampleRecordInput,
        videoId: 'vid-before',
        title: 'Film Poprzedzający',
      });
      await history.saveRecord({
        videoId: 'vid-target',
        title: 'Oryginalny Tytuł',
        author: 'Oryginalny Autor',
        thumbnailUrl: 'https://example.com/original.jpg',
        summary: 'Oryginalne Podsumowanie',
        transcript: [
          { text: 'Oryginalna transkrypcja', start: 0, duration: 10 },
        ],
        chat: [{ role: 'user', message: 'Stare pytanie' }],
      });
      await history.saveRecord({
        ...sampleRecordInput,
        videoId: 'vid-after',
        title: 'Film Następujący',
      });

      const initialRecords = await history.getRecords();
      expect(initialRecords.map((r) => r.videoId)).toEqual([
        'vid-after',
        'vid-target',
        'vid-before',
      ]);
      const originalTarget = initialRecords[1];
      const originalAfter = initialRecords[0];
      const originalBefore = initialRecords[2];

      const newChat: ConversationMessage[] = [
        { role: 'user', message: 'Stare pytanie' },
        { role: 'model', message: 'Odpowiedź' },
        { role: 'user', message: 'Nowe pytanie w sesji' },
      ];

      const result = await history.saveChat({
        videoId: 'vid-target',
        title: 'Zupełnie Inny Tytuł ze starego stanu',
        author: 'Zupełnie Inny Autor',
        thumbnailUrl: 'https://example.com/outdated.jpg',
        summary: 'Zupełnie inne podsumowanie',
        transcript: [{ text: 'Inna transkrypcja', start: 99, duration: 5 }],
        chat: newChat,
      });

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.videoId)).toEqual([
        'vid-after',
        'vid-target',
        'vid-before',
      ]);
      expect(result[0]).toEqual(originalAfter);
      expect(result[2]).toEqual(originalBefore);

      const updatedTarget = result[1];
      expect(updatedTarget.videoId).toBe('vid-target');
      expect(updatedTarget.title).toBe(originalTarget.title);
      expect(updatedTarget.author).toBe(originalTarget.author);
      expect(updatedTarget.thumbnailUrl).toBe(originalTarget.thumbnailUrl);
      expect(updatedTarget.summary).toBe(originalTarget.summary);
      expect(updatedTarget.transcript).toEqual(originalTarget.transcript);
      expect(updatedTarget.createdAt).toBe(originalTarget.createdAt);
      expect(updatedTarget.chat).toEqual(newChat);

      const persisted = await history.getRecords();
      expect(persisted).toEqual(result);
    });

    it('updates existing record in-place preserving its position and original createdAt', async () => {
      const platform = createMemoryPlatform({});
      const history = createAnalysisHistory(platform);

      await history.saveRecord({
        ...sampleRecordInput,
        videoId: 'vid-1',
        title: 'Film 1',
      });
      await history.saveRecord({
        ...sampleRecordInput,
        videoId: 'vid-2',
        title: 'Film 2',
      });
      await history.saveRecord({
        ...sampleRecordInput,
        videoId: 'vid-3',
        title: 'Film 3',
      });

      // Current order: vid-3, vid-2, vid-1
      const initialRecords = await history.getRecords();
      const originalVid2 = initialRecords.find((r) => r.videoId === 'vid-2')!;
      expect(initialRecords[1].videoId).toBe('vid-2');

      const updatedChat: ConversationMessage[] = [
        { role: 'user', message: 'Nowe pytanie w sesji' },
        { role: 'model', message: 'Nowa odpowiedź w sesji' },
      ];

      const result = await history.saveChat({
        ...sampleRecordInput,
        videoId: 'vid-2',
        title: 'Film 2 Zaktualizowany',
        summary: 'Zaktualizowane podsumowanie',
        chat: updatedChat,
      });

      expect(result).toHaveLength(3);
      // Position MUST be preserved (vid-3 at 0, vid-2 at 1, vid-1 at 2)
      expect(result.map((r) => r.videoId)).toEqual(['vid-3', 'vid-2', 'vid-1']);

      const updatedVid2 = result[1];
      expect(updatedVid2.videoId).toBe('vid-2');
      expect(updatedVid2.chat).toEqual(updatedChat);
      expect(updatedVid2.title).toBe('Film 2');
      expect(updatedVid2.summary).toBe(originalVid2.summary);
      expect(updatedVid2.createdAt).toBe(originalVid2.createdAt);

      const readBack = await history.getRecords();
      expect(readBack).toEqual(result);
    });

    it('preserves existing summary when saving a session with null summary for an already summarized video', async () => {
      const platform = createMemoryPlatform({});
      const history = createAnalysisHistory(platform);

      await history.saveRecord({
        ...sampleRecordInput,
        videoId: 'vid-summarized',
        summary: 'Istniejące podsumowanie',
      });

      const updated = await history.saveChat({
        ...sampleRecordInput,
        videoId: 'vid-summarized',
        summary: null,
        chat: [{ role: 'user', message: 'Pytanie' }],
      });

      expect(updated[0].summary).toBe('Istniejące podsumowanie');
      expect(updated[0].chat).toHaveLength(1);
    });

    it('adds new session at index 0 and maintains limit of 50 items when videoId is not yet in history', async () => {
      const initialRecords: AnalysisRecord[] = Array.from(
        { length: 50 },
        (_, i) => ({
          ...sampleRecordInput,
          videoId: `existing-vid-${i + 1}`,
          title: `Film ${i + 1}`,
          createdAt: 1000 + i,
        })
      );
      const platform = createMemoryPlatform({
        summarizer_history: initialRecords,
      });
      const history = createAnalysisHistory(platform);

      const result = await history.saveChat({
        ...sampleRecordInput,
        videoId: 'new-session-51',
        title: 'Nowy Film 51',
        chat: [{ role: 'user', message: 'Cześć' }],
      });

      expect(result).toHaveLength(50);
      expect(result[0].videoId).toBe('new-session-51');
      expect(result[0].title).toBe('Nowy Film 51');
      expect(result[0].chat).toEqual([{ role: 'user', message: 'Cześć' }]);
      // The last item (existing-vid-50) should be dropped by slice
      expect(result.some((r) => r.videoId === 'existing-vid-50')).toBe(false);
      expect(result[49].videoId).toBe('existing-vid-49');
    });
  });
});
