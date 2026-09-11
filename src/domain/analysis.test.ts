import { describe, expect, it } from 'vitest';

import {
  AnalysisRecord,
  ConversationMessage,
  Film,
  isAnalysisRecord,
  isConversationMessage,
  isFilm,
  isTranscriptSegment,
  TranscriptSegment,
} from './analysis';

describe('Domain analysis module (src/domain/analysis)', () => {
  describe('isFilm', () => {
    it('returns true for a valid Film object', () => {
      const validFilm: Film = {
        videoId: 'vid123',
        title: 'Film Title',
        author: 'Channel Name',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      };
      expect(isFilm(validFilm)).toBe(true);
    });

    it('returns false for null, primitives, or objects missing required fields', () => {
      expect(isFilm(null)).toBe(false);
      expect(isFilm(undefined)).toBe(false);
      expect(isFilm('string')).toBe(false);
      expect(isFilm({ videoId: 'vid123', title: 'Film Title' })).toBe(false);
      expect(
        isFilm({
          videoId: 'vid123',
          title: 'Film Title',
          author: 123,
          thumbnailUrl: 'https://example.com/thumb.jpg',
        })
      ).toBe(false);
    });
  });

  describe('isTranscriptSegment', () => {
    it('returns true for a valid TranscriptSegment', () => {
      const validSegment: TranscriptSegment = {
        start: 12.5,
        duration: 3.0,
        text: 'Napisy filmu',
      };
      expect(isTranscriptSegment(validSegment)).toBe(true);
    });

    it('returns false for non-segment objects or invalid property types', () => {
      expect(isTranscriptSegment(null)).toBe(false);
      expect(isTranscriptSegment({ start: 0, duration: 2 })).toBe(false);
      expect(
        isTranscriptSegment({ start: '0', duration: 2, text: 'text' })
      ).toBe(false);
      expect(
        isTranscriptSegment({ start: 0, duration: '2', text: 'text' })
      ).toBe(false);
      expect(isTranscriptSegment({ start: 0, duration: 2, text: 123 })).toBe(
        false
      );
    });
  });

  describe('isConversationMessage', () => {
    it('returns true for valid user and model messages', () => {
      const userMsg: ConversationMessage = { role: 'user', message: 'Cześć' };
      const modelMsg: ConversationMessage = {
        role: 'model',
        message: 'Odpowiedź',
      };

      expect(isConversationMessage(userMsg)).toBe(true);
      expect(isConversationMessage(modelMsg)).toBe(true);
    });

    it('returns false for invalid roles or missing fields', () => {
      expect(isConversationMessage(null)).toBe(false);
      expect(isConversationMessage({ role: 'admin', message: 'Hi' })).toBe(
        false
      );
      expect(isConversationMessage({ role: 'user', message: 123 })).toBe(false);
      expect(isConversationMessage({ message: 'Missing role' })).toBe(false);
    });
  });

  describe('isAnalysisRecord', () => {
    const validRecord: AnalysisRecord = {
      videoId: 'vid123',
      title: 'Film z analizą',
      author: 'Autor',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      summary: 'Podsumowanie filmu',
      transcript: [{ start: 0, duration: 5, text: 'Wstęp' }],
      chat: [{ role: 'user', message: 'Pytanie' }],
      createdAt: 1700000000000,
    };

    it('returns true for a valid AnalysisRecord with summary', () => {
      expect(isAnalysisRecord(validRecord)).toBe(true);
    });

    it('returns true for a valid AnalysisRecord with null summary', () => {
      expect(isAnalysisRecord({ ...validRecord, summary: null })).toBe(true);
    });

    it('returns false when required film fields or types are invalid', () => {
      expect(isAnalysisRecord(null)).toBe(false);
      expect(isAnalysisRecord({ ...validRecord, videoId: 123 })).toBe(false);
      expect(isAnalysisRecord({ ...validRecord, createdAt: '1700' })).toBe(
        false
      );
    });

    it('returns false when transcript contains invalid segments', () => {
      expect(
        isAnalysisRecord({
          ...validRecord,
          transcript: [{ start: 'zero', duration: 5, text: 'text' }],
        })
      ).toBe(false);
      expect(
        isAnalysisRecord({
          ...validRecord,
          transcript: 'not-array',
        })
      ).toBe(false);
    });

    it('returns false when chat contains invalid messages', () => {
      expect(
        isAnalysisRecord({
          ...validRecord,
          chat: [{ role: 'assistant', message: 'invalid role' }],
        })
      ).toBe(false);
      expect(
        isAnalysisRecord({
          ...validRecord,
          chat: 'not-array',
        })
      ).toBe(false);
    });
  });
});
