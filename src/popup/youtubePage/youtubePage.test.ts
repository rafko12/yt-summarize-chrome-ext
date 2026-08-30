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
