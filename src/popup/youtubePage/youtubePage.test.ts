import { describe, expect, test } from 'vitest';

import createYoutubePage, { YoutubePagePlatform } from './youtubePage';

function createPlatform(
  overrides: Partial<YoutubePagePlatform> = {}
): YoutubePagePlatform {
  return {
    getActiveTab: async () => ({
      id: 7,
      url: 'https://www.youtube.com/watch?v=film',
      title: 'Tytuł karty',
    }),
    getVideoData: async () => ({
      success: true,
      videoId: 'film',
      title: 'Tytuł Filmu',
      author: 'Autor',
      thumbnailUrl: 'miniatura',
    }),
    getTranscript: async () => ({
      success: true,
      transcript: [{ start: 0, duration: 1, text: 'Text' }],
    }),
    seekTo: async () => ({ success: true }),
    ...overrides,
  };
}

describe('moduł strony YouTube', () => {
  test('odczytuje aktywny Film bez ujawniania panelowi karty ani wiadomości Chrome', async () => {
    const page = createYoutubePage(createPlatform());

    await expect(page.readActiveVideo()).resolves.toEqual({
      videoId: 'film',
      title: 'Tytuł Filmu',
      author: 'Autor',
      thumbnailUrl: 'miniatura',
    });
  });

  test('zachowuje awaryjne dane Filmu, gdy content script zwróci błąd', async () => {
    const page = createYoutubePage(
      createPlatform({ getVideoData: async () => ({ error: 'Brak danych' }) })
    );

    await expect(page.readActiveVideo()).resolves.toEqual({
      videoId: 'film',
      title: 'Tytuł karty',
      author: 'YouTube Creator',
      thumbnailUrl: 'https://img.youtube.com/vi/film/hqdefault.jpg',
    });
  });

  test('preserves the previous author in fallback session data', async () => {
    const page = createYoutubePage(
      createPlatform({ getVideoData: async () => ({ error: 'No data' }) })
    );

    await expect(
      page.readActiveVideo({
        videoId: 'previous-video',
        title: 'Previous title',
        author: 'Previous author',
        thumbnailUrl: 'previous-thumbnail',
      })
    ).resolves.toMatchObject({
      videoId: 'film',
      author: 'Previous author',
      thumbnailUrl: 'https://img.youtube.com/vi/film/hqdefault.jpg',
    });
  });

  test('fetches the active video transcript without exposing a Chrome tab or message', async () => {
    const getTranscript = async () => ({
      success: true as const,
      transcript: [{ start: 0, duration: 1, text: 'Text' }],
    });
    const page = createYoutubePage(createPlatform({ getTranscript }));

    await expect(page.fetchActiveTranscript('film', 'pl')).resolves.toEqual({
      success: true,
      transcript: [{ start: 0, duration: 1, text: 'Text' }],
    });
  });

  test('seeks within the active video without exposing a Chrome tab or message', async () => {
    const seekTo = async () => ({ success: true as const });
    const page = createYoutubePage(createPlatform({ seekTo }));

    await expect(page.seekToTimestamp(42)).resolves.toBeUndefined();
  });

  test('nie zwraca Filmu poza aktywną stroną YouTube', async () => {
    const page = createYoutubePage(
      createPlatform({
        getActiveTab: async () => ({
          id: 7,
          url: 'https://example.com/',
        }),
      })
    );

    await expect(page.readActiveVideo()).resolves.toBeNull();
  });
});
