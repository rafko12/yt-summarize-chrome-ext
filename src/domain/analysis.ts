/**
 * Kanoniczne typy i reguły domeny analizy filmu.
 *
 * Moduł jest czystą domeną analizy niezależną od runtime'ów, UI, storage,
 * integracji AI oraz adapterów Chrome.
 */

export interface Film {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
}

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  message: string;
}

export interface AnalysisRecord {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  summary: string | null;
  transcript: TranscriptSegment[];
  chat: ChatMessage[];
  createdAt: number;
}

export type AnalysisRecordInput = Omit<AnalysisRecord, 'createdAt'>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isFilm(value: unknown): value is Film {
  return (
    isObjectRecord(value) &&
    typeof value.videoId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.author === 'string' &&
    typeof value.thumbnailUrl === 'string'
  );
}

export function isTranscriptSegment(
  value: unknown
): value is TranscriptSegment {
  return (
    isObjectRecord(value) &&
    typeof value.start === 'number' &&
    typeof value.duration === 'number' &&
    typeof value.text === 'string'
  );
}

export function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isObjectRecord(value) &&
    (value.role === 'user' || value.role === 'model') &&
    typeof value.message === 'string'
  );
}

export function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  if (!isObjectRecord(value) || !isFilm(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.summary === 'string' || record.summary === null) &&
    Array.isArray(record.transcript) &&
    record.transcript.every(isTranscriptSegment) &&
    Array.isArray(record.chat) &&
    record.chat.every(isChatMessage) &&
    typeof record.createdAt === 'number'
  );
}
