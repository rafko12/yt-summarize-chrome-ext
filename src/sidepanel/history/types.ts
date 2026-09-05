import { MouseEvent } from 'react';
import type { StorageAdapter } from '../../storage';

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

export type AnalysisHistoryPlatform = StorageAdapter;

export interface AnalysisHistory {
  getRecords(): Promise<AnalysisRecord[]>;
  saveRecord(item: AnalysisRecordInput): Promise<AnalysisRecord[]>;
  updateRecordChat(videoId: string, chat: ChatMessage[]): Promise<void>;
  saveSession(session: AnalysisRecordInput): Promise<AnalysisRecord[]>;
  saveAnalysisSession?(session: AnalysisRecordInput): Promise<AnalysisRecord[]>;
  deleteRecord(videoId: string): Promise<AnalysisRecord[]>;
  clearRecords(): Promise<void>;
}

export interface HistoryViewProps {
  historyList: AnalysisRecord[];
  onResumeSession: (item: AnalysisRecord) => void;
  onDeleteHistory: (e: MouseEvent, videoId: string) => void;
}
