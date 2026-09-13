import { Film } from '../../domain/analysis';
import { isErrorResponse } from '../../messaging';
import {
  ActiveYoutubeTab,
  TranscriptRequestOptions,
  YoutubeAdapter,
  YoutubeBridge,
} from './types';

function createFallbackFilm(
  videoId: string,
  tab: ActiveYoutubeTab,
  fallbackFilm?: Film
): Film {
  return {
    videoId,
    title: tab.title || 'Film YouTube',
    author: fallbackFilm?.author || 'YouTube Creator',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export default function createYoutube(adapter: YoutubeAdapter): YoutubeBridge {
  if (!adapter) {
    throw new Error('Wymagany jest jawny adapter YouTube.');
  }
  return {
    async readActiveFilm(fallbackFilm?: Film): Promise<Film | null> {
      try {
        const tab = await adapter.getActiveTab();
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
          const response = await adapter.getVideoData(tab.id);
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

        return createFallbackFilm(videoId, tab, fallbackFilm);
      } catch {
        return null;
      }
    },
    async fetchActiveTranscript(
      videoId: string,
      targetLang: string,
      options?: TranscriptRequestOptions
    ) {
      const tab = await adapter.getActiveTab();
      if (!tab?.id) {
        throw new Error('Nie znaleziono aktywnej karty.');
      }

      return adapter.getTranscript(tab.id, videoId, targetLang, options);
    },
    async seekToTimestamp(seconds: number): Promise<void> {
      const tab = await adapter.getActiveTab();
      if (!tab?.id) return;

      const response = await adapter.seekTo(tab.id, seconds);
      if (isErrorResponse(response)) {
        throw new Error(response.error);
      }
    },
  };
}
