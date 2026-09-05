import { MouseEvent } from 'react';

import { ChatMessage, TranscriptItem } from '../ai';

export interface AnalysisRecord {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  summary: string | null;
  transcript: TranscriptItem[];
  chat: ChatMessage[];
  createdAt: number;
}

export type AnalysisRecordInput = Omit<AnalysisRecord, 'createdAt'>;

export type HistoryItem = AnalysisRecord;
export type HistoryItemInput = AnalysisRecordInput;

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
