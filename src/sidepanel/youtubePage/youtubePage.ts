import {
  isErrorResponse,
  TranscriptResponse,
  VideoDataResponse,
} from '../../shared/messages';
import { VideoSession } from '../../shared/video';

export interface TranscriptRequestOptions {
  onInjecting?: () => void;
}

export interface ActiveYoutubeTab {
  id?: number;
  title?: string;
  url?: string;
}

export interface YoutubePagePlatform {
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

export interface YoutubePage {
  readActiveVideo(fallbackVideo?: VideoSession): Promise<VideoSession | null>;
  fetchActiveTranscript(
    videoId: string,
    targetLang: string,
    options?: TranscriptRequestOptions
  ): Promise<TranscriptResponse | { error: string }>;
  seekToTimestamp(seconds: number): Promise<void>;
}

function createFallbackVideo(
  videoId: string,
  tab: ActiveYoutubeTab,
  fallbackVideo?: VideoSession
): VideoSession {
  return {
    videoId,
    title: tab.title || 'Film YouTube',
    author: fallbackVideo?.author || 'YouTube Creator',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export default function createYoutubePage(
  platform: YoutubePagePlatform
): YoutubePage {
  return {
    async readActiveVideo(
      fallbackVideo?: VideoSession
    ): Promise<VideoSession | null> {
      try {
        const tab = await platform.getActiveTab();
        if (
          !tab ||
          !tab.id ||
          !tab.url ||
          !tab.url.includes('youtube.com/watch')
        ) {
          return null;
        }

        const videoId = new URL(tab.url).searchParams.get('v');
        if (!videoId) return null;

        try {
          const response = await platform.getVideoData(tab.id);
          if (!isErrorResponse(response)) {
            return {
              videoId: response.videoId,
              title: response.title,
              author: response.author,
              thumbnailUrl: response.thumbnailUrl,
            };
          }
        } catch {
          // Preserve the existing fallback when the content script cannot respond.
        }

        return createFallbackVideo(videoId, tab, fallbackVideo);
      } catch {
        return null;
      }
    },
    async fetchActiveTranscript(
      videoId: string,
      targetLang: string,
      options?: TranscriptRequestOptions
    ): Promise<TranscriptResponse | { error: string }> {
      const tab = await platform.getActiveTab();
      if (!tab?.id) {
        throw new Error('Nie znaleziono aktywnej karty.');
      }

      return platform.getTranscript(tab.id, videoId, targetLang, options);
    },
    async seekToTimestamp(seconds: number): Promise<void> {
      const tab = await platform.getActiveTab();
      if (!tab?.id) return;

      const response = await platform.seekTo(tab.id, seconds);
      if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    },
  };
}
