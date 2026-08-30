import { isErrorResponse, VideoDataResponse } from '../../shared/messages';
import { VideoSession } from '../../shared/video';

export interface ActiveYoutubeTab {
  id?: number;
  title?: string;
  url?: string;
}

export interface YoutubePagePlatform {
  getActiveTab(): Promise<ActiveYoutubeTab | undefined>;
  getVideoData(tabId: number): Promise<VideoDataResponse | { error: string }>;
}

export interface YoutubePage {
  readActiveVideo(): Promise<VideoSession | null>;
}

function createFallbackVideo(
  videoId: string,
  tab: ActiveYoutubeTab
): VideoSession {
  return {
    videoId,
    title: tab.title || 'Film YouTube',
    author: 'YouTube Creator',
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

export default function createYoutubePage(
  platform: YoutubePagePlatform
): YoutubePage {
  return {
    async readActiveVideo(): Promise<VideoSession | null> {
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
          // Zachowujemy dotychczasowe dane awaryjne, gdy content script nie odpowiada.
        }

        return createFallbackVideo(videoId, tab);
      } catch {
        return null;
      }
    },
  };
}
