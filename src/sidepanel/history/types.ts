import { MouseEvent } from 'react';

import {
  AnalysisRecord,
  AnalysisRecordInput,
  ChatMessage,
  TranscriptSegment,
} from '../../domain/analysis';

export type {
  AnalysisRecord,
  AnalysisRecordInput,
  ChatMessage,
  TranscriptSegment,
};

export interface AnalysisHistoryPlatform {
  read(keys: readonly string[]): Promise<Record<string, unknown>>;
  write(values: Record<string, unknown>): Promise<void>;
}

export interface AnalysisHistory {
  getRecords(): Promise<AnalysisRecord[]>;
  saveRecord(item: AnalysisRecordInput): Promise<AnalysisRecord[]>;
  updateRecordChat(videoId: string, chat: ChatMessage[]): Promise<void>;
  deleteRecord(videoId: string): Promise<AnalysisRecord[]>;
  clearRecords(): Promise<void>;
}

export interface HistoryViewProps {
  historyList: AnalysisRecord[];
  onResumeSession: (item: AnalysisRecord) => void;
  onDeleteHistory: (e: MouseEvent, videoId: string) => void;
}
