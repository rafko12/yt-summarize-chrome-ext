import { Film } from '../../domain/analysis';
import { TranscriptResponse, VideoDataResponse } from '../../messaging';

export interface TranscriptRequestOptions {
  onInjecting?: () => void;
}

export interface ActiveYoutubeTab {
  id?: number;
  title?: string;
  url?: string;
}

export interface YoutubeAdapter {
  getActiveTab(): Promise<ActiveYoutubeTab | undefined>;
  getVideoData(tabId: number): Promise<VideoDataResponse | { error: string }>;
  getTranscript(
    tabId: number,
    videoId: string,
    targetLang: string,
    options?: TranscriptRequestOptions
  ): Promise<TranscriptResponse | { error: string }>;
  seekTo(
    tabId: number,
    seconds: number
  ): Promise<{ error: string } | { success: true }>;
}

export interface YoutubeIntegration {
  readActiveFilm(fallbackFilm?: Film): Promise<Film | null>;
  fetchActiveTranscript(
    videoId: string,
    targetLang: string,
    options?: TranscriptRequestOptions
  ): Promise<TranscriptResponse | { error: string }>;
  seekToTimestamp(seconds: number): Promise<void>;
}
