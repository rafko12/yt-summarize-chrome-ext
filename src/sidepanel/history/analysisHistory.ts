import {
  AnalysisRecord,
  AnalysisRecordInput,
  ChatMessage,
  isAnalysisRecord,
} from '../../domain/analysis';
import { STORAGE_KEYS, StorageAdapter } from '../../storage';
import { AnalysisHistory } from './types';

const MAX_HISTORY_ITEMS = 50;

export default function createAnalysisHistory(
  platform: StorageAdapter
): AnalysisHistory {
  return {
    async getRecords(): Promise<AnalysisRecord[]> {
      const raw = await platform.read([STORAGE_KEYS.HISTORY]);
      const stored = raw[STORAGE_KEYS.HISTORY];
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
      await platform.write({ [STORAGE_KEYS.HISTORY]: updated });
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
      await platform.write({ [STORAGE_KEYS.HISTORY]: updated });
    },

    async saveChat(session: AnalysisRecordInput): Promise<AnalysisRecord[]> {
      const current = await this.getRecords();
      const targetIndex = current.findIndex(
        (r) => r.videoId === session.videoId
      );
      if (targetIndex === -1) {
        return this.saveRecord(session);
      }

      const existing = current[targetIndex];
      const updatedRecord: AnalysisRecord = {
        ...existing,
        chat: session.chat,
      };

      const updated = current.map((record, index) =>
        index === targetIndex ? updatedRecord : record
      );
      await platform.write({ [STORAGE_KEYS.HISTORY]: updated });
      return updated;
    },

    async deleteRecord(videoId: string): Promise<AnalysisRecord[]> {
      const current = await this.getRecords();
      const updated = current.filter((r) => r.videoId !== videoId);
      await platform.write({ [STORAGE_KEYS.HISTORY]: updated });
      return updated;
    },

    async clearRecords(): Promise<void> {
      await platform.write({ [STORAGE_KEYS.HISTORY]: [] });
    },
  };
}
