import { TranscriptResponse, VideoDataResponse } from '../../shared/messages';
import { VideoSession } from '../../shared/video';

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
  readActiveVideo(fallbackVideo?: VideoSession): Promise<VideoSession | null>;
  fetchActiveTranscript(
    videoId: string,
    targetLang: string,
    options?: TranscriptRequestOptions
  ): Promise<TranscriptResponse | { error: string }>;
  seekToTimestamp(seconds: number): Promise<void>;
}

// Backward-compatibility aliases for other modules before subsequent cleanups
export type YoutubePage = YoutubeIntegration;
export type YoutubePagePlatform = YoutubeAdapter;
