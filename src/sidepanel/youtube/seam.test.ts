import { describe, expect, it } from 'vitest';

import { createYoutube, YoutubeIntegration } from './index';
import { YoutubeAdapter } from './types';

describe('YouTube Module public seam (src/sidepanel/youtube)', () => {
  it('performs film reading and navigation operations through the public seam', async () => {
    let seekedSeconds: number | null = null;
    const mockAdapter: YoutubeAdapter = {
      getActiveTab: async () => ({
        id: 101,
        url: 'https://www.youtube.com/watch?v=seam-video-123',
        title: 'Seam Video Title',
      }),
      getVideoData: async () => ({
        success: true,
        videoId: 'seam-video-123',
        title: 'Seam Film',
        author: 'Seam Author',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      }),
      getTranscript: async () => ({
        success: true,
        transcript: [{ start: 0, duration: 5, text: 'Hello seam' }],
      }),
      seekTo: async (_tabId, seconds) => {
        seekedSeconds = seconds;
        return { success: true };
      },
    };

    const youtube: YoutubeIntegration = createYoutube(mockAdapter);

    const film = await youtube.readActiveFilm();
    expect(film).toEqual({
      videoId: 'seam-video-123',
      title: 'Seam Film',
      author: 'Seam Author',
      thumbnailUrl: 'https://example.com/thumb.jpg',
    });

    await youtube.seekToTimestamp(42);
    expect(seekedSeconds).toBe(42);
  });
});
