import { describe, expect, test, vi } from 'vitest';

import {
  ActiveYoutubeTab,
  TranscriptRequestOptions,
  YoutubeAdapter,
} from './types';
import createYoutube from './youtube';

function createAdapter(
  overrides: Partial<YoutubeAdapter> = {}
): YoutubeAdapter {
  return {
    getActiveTab: async (): Promise<ActiveYoutubeTab | undefined> => ({
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

describe('moduł YouTube panelu bocznego (src/sidepanel/youtube)', () => {
  test('odczytuje aktywny Film bez ujawniania panelowi karty ani wiadomości Chrome', async () => {
    const youtube = createYoutube(createAdapter());

    await expect(youtube.readActiveVideo()).resolves.toEqual({
      videoId: 'film',
      title: 'Tytuł Filmu',
      author: 'Autor',
      thumbnailUrl: 'miniatura',
    });
  });

  test('zachowuje awaryjne dane Filmu, gdy content script zwróci błąd', async () => {
    const youtube = createYoutube(
      createAdapter({ getVideoData: async () => ({ error: 'Brak danych' }) })
    );

    await expect(youtube.readActiveVideo()).resolves.toEqual({
      videoId: 'film',
      title: 'Tytuł karty',
      author: 'YouTube Creator',
      thumbnailUrl: 'https://img.youtube.com/vi/film/hqdefault.jpg',
    });
  });

  test('zachowuje poprzedniego autora w danych awaryjnych', async () => {
    const youtube = createYoutube(
      createAdapter({ getVideoData: async () => ({ error: 'No data' }) })
    );

    await expect(
      youtube.readActiveVideo({
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

  test('pobiera transkrypcję aktywnego Filmu bez ujawniania karty ani wiadomości Chrome', async () => {
    const onInjecting = vi.fn();
    const getTranscript = async (
      _tabId: number,
      _videoId: string,
      _targetLang: string,
      options?: TranscriptRequestOptions
    ) => {
      options?.onInjecting?.();
      return {
        success: true as const,
        transcript: [{ start: 0, duration: 1, text: 'Text' }],
      };
    };
    const youtube = createYoutube(createAdapter({ getTranscript }));

    const result = await youtube.fetchActiveTranscript('film', 'pl', {
      onInjecting,
    });
    expect(result).toEqual({
      success: true,
      transcript: [{ start: 0, duration: 1, text: 'Text' }],
    });
    expect(onInjecting).toHaveBeenCalledOnce();
  });

  test('rzuca błąd przy braku aktywnej karty podczas pobierania transkrypcji', async () => {
    const youtube = createYoutube(
      createAdapter({ getActiveTab: async () => undefined })
    );

    await expect(youtube.fetchActiveTranscript('film', 'pl')).rejects.toThrow(
      'Nie znaleziono aktywnej karty.'
    );
  });

  test('przesuwa odtwarzacz do wskazanego znacznika czasu', async () => {
    const seekTo = vi.fn(async () => ({ success: true as const }));
    const youtube = createYoutube(createAdapter({ seekTo }));

    await expect(youtube.seekToTimestamp(42)).resolves.toBeUndefined();
    expect(seekTo).toHaveBeenCalledWith(7, 42);
  });

  test('nie wykonuje seekTo jeśli brak aktywnej karty', async () => {
    const seekTo = vi.fn(async () => ({ success: true as const }));
    const youtube = createYoutube(
      createAdapter({ getActiveTab: async () => undefined, seekTo })
    );

    await expect(youtube.seekToTimestamp(42)).resolves.toBeUndefined();
    expect(seekTo).not.toHaveBeenCalled();
  });

  test('rzuca błąd jeśli seekTo zwróci błąd odpowiedzi', async () => {
    const youtube = createYoutube(
      createAdapter({ seekTo: async () => ({ error: 'Seek failed' }) })
    );

    await expect(youtube.seekToTimestamp(42)).rejects.toThrow('Seek failed');
  });

  test('nie zwraca Filmu poza aktywną stroną YouTube', async () => {
    const youtube = createYoutube(
      createAdapter({
        getActiveTab: async () => ({
          id: 7,
          url: 'https://example.com/',
        }),
      })
    );

    await expect(youtube.readActiveVideo()).resolves.toBeNull();
  });

  test('zwraca null jeśli tab nie zawiera parametru v', async () => {
    const youtube = createYoutube(
      createAdapter({
        getActiveTab: async () => ({
          id: 7,
          url: 'https://www.youtube.com/feed/subscriptions',
        }),
      })
    );

    await expect(youtube.readActiveVideo()).resolves.toBeNull();
  });

  test('zwraca null jeśli getActiveTab rzuci błąd', async () => {
    const youtube = createYoutube(
      createAdapter({
        getActiveTab: async () => {
          throw new Error('Chrome tabs error');
        },
      })
    );

    await expect(youtube.readActiveVideo()).resolves.toBeNull();
  });

  test('używa domyślnego adaptera Chrome gdy wywołano createYoutube bez argumentów', async () => {
    global.chrome = {
      ...chrome,
      tabs: {
        ...chrome.tabs,
        query: vi.fn(async () => [
          { id: 10, url: 'https://www.youtube.com/watch?v=def', title: 'Def' },
        ]),
        sendMessage: vi.fn(async () => ({
          success: true,
          videoId: 'def',
          title: 'Def Title',
          author: 'Def Author',
          thumbnailUrl: 'def.jpg',
        })),
      },
    } as unknown as typeof chrome;

    const youtube = createYoutube();
    const video = await youtube.readActiveVideo();
    expect(video).toEqual({
      videoId: 'def',
      title: 'Def Title',
      author: 'Def Author',
      thumbnailUrl: 'def.jpg',
    });
  });
});
