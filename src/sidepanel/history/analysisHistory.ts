import { ChatMessage, TranscriptItem } from '../ai';
import {
  AnalysisHistory,
  AnalysisHistoryPlatform,
  AnalysisRecord,
  AnalysisRecordInput,
} from './types';

const ANALYSIS_HISTORY_STORAGE_KEY = 'summarizer_history';
const MAX_HISTORY_ITEMS = 50;

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

function isAnalysisRecord(value: unknown): value is AnalysisRecord {
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

export default function createAnalysisHistory(
  platform: AnalysisHistoryPlatform
): AnalysisHistory {
  return {
    async getRecords(): Promise<AnalysisRecord[]> {
      const raw = await platform.read([ANALYSIS_HISTORY_STORAGE_KEY]);
      const stored = raw[ANALYSIS_HISTORY_STORAGE_KEY];
      return Array.isArray(stored) ? stored.filter(isAnalysisRecord) : [];
    },

    async saveRecord(item: AnalysisRecordInput): Promise<AnalysisRecord[]> {
      const current = await this.getRecords();
      const filtered = current.filter((r) => r.videoId !== item.videoId);
      const newRecord: AnalysisRecord = {
        ...item,
        createdAt: Date.now(),
      };
      const updated = [newRecord, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      await platform.write({ [ANALYSIS_HISTORY_STORAGE_KEY]: updated });
      return updated;
    },

    async updateRecordChat(
      videoId: string,
      chat: ChatMessage[]
    ): Promise<void> {
      const current = await this.getRecords();
      const targetIndex = current.findIndex((r) => r.videoId === videoId);
      if (targetIndex === -1) {
        return;
      }
      const updated = current.map((record, index) =>
        index === targetIndex ? { ...record, chat } : record
      );
      await platform.write({ [ANALYSIS_HISTORY_STORAGE_KEY]: updated });
    },

    async deleteRecord(videoId: string): Promise<AnalysisRecord[]> {
      const current = await this.getRecords();
      const updated = current.filter((r) => r.videoId !== videoId);
      await platform.write({ [ANALYSIS_HISTORY_STORAGE_KEY]: updated });
      return updated;
    },

    async clearRecords(): Promise<void> {
      await platform.write({ [ANALYSIS_HISTORY_STORAGE_KEY]: [] });
    },
  };
}
