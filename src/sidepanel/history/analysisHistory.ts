import {
  AnalysisRecord,
  AnalysisRecordInput,
  ChatMessage,
  isAnalysisRecord,
} from '../../domain/analysis';
import { AnalysisHistory, AnalysisHistoryPlatform } from './types';

const ANALYSIS_HISTORY_STORAGE_KEY = 'summarizer_history';
const MAX_HISTORY_ITEMS = 50;

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
