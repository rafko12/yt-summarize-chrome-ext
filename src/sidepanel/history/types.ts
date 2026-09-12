import {
  AnalysisRecord,
  AnalysisRecordInput,
  ConversationMessage,
  TranscriptSegment,
} from '../../domain/analysis';

export type {
  AnalysisRecord,
  AnalysisRecordInput,
  ConversationMessage,
  TranscriptSegment,
};

export interface AnalysisHistory {
  getRecords(): Promise<AnalysisRecord[]>;
  saveRecord(item: AnalysisRecordInput): Promise<AnalysisRecord[]>;
  updateRecordChat(videoId: string, chat: ConversationMessage[]): Promise<void>;
  /**
   * Persists chat messages for an analysis session.
   *
   * If a record already exists for the given videoId:
   * - Performs a restricted in-place update modifying ONLY the `chat` property.
   * - Preserves the record's position, metadata (title, author, thumbnailUrl),
   *   transcript, summary, and original `createdAt` timestamp.
   *
   * If no record exists for the given videoId:
   * - Inserts a complete new `AnalysisRecord` at index 0 (with fresh `createdAt` timestamp)
   *   using the provided session input, maintaining the maximum history limit.
   */
  saveChat(session: AnalysisRecordInput): Promise<AnalysisRecord[]>;
  deleteRecord(videoId: string): Promise<AnalysisRecord[]>;
  clearRecords(): Promise<void>;
}

export interface HistoryViewProps {
  historyList: AnalysisRecord[];
  onResumeSession: (item: AnalysisRecord) => void;
  onDeleteHistory: (videoId: string) => void;
}
