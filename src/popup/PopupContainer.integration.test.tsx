/* @vitest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import registerYoutubeUrlUpdates from '../background/youtubeUrlUpdates';
import PopupContainer from './PopupContainer';

type RuntimeListener = (message: unknown) => boolean;
type TabUpdatedListener = (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo
) => void;
let stored: Record<string, unknown>;
let runtimeListener: RuntimeListener | undefined;
let tabUpdatedListener: TabUpdatedListener | undefined;
let activeTab: Partial<chrome.tabs.Tab>;

beforeEach(() => {
  stored = {
    gemini_api_key: 'key',
    summarizer_settings: { language: 'Polski', model: 'gemini-3.6-flash' },
    summarizer_history: [],
    ui_theme: 'night',
  };
  runtimeListener = undefined;
  tabUpdatedListener = undefined;
  activeTab = {
    id: 3,
    windowId: 4,
    url: 'https://www.youtube.com/watch?v=movie',
    title: 'Movie from tab',
  };
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'AI response' }] } }],
      content: [{ type: 'text', text: 'AI response' }],
      choices: [{ message: { content: 'AI response' } }],
    }),
  })) as unknown as typeof fetch;
  window.matchMedia = vi.fn(() => ({
    matches: true,
  })) as unknown as typeof window.matchMedia;
  global.chrome = {
    ...chrome,
    tabs: {
      ...chrome.tabs,
      query: vi.fn(async () => [activeTab]),
      get: vi.fn(async (tabId: number) =>
        tabId === 3
          ? {
              id: 3,
              url: 'https://www.youtube.com/watch?v=movie',
            }
          : undefined
      ),
      sendMessage: vi.fn(async (_tabId, message) => {
        if (message.type === 'GET_TRANSCRIPT') {
          return {
            success: true,
            transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
          };
        }
        if (message.type === 'GET_VIDEO_DATA') {
          return {
            success: true,
            videoId: 'movie',
            title: 'Movie',
            author: 'Creator',
            thumbnailUrl: 'thumbnail',
          };
        }
        return { success: true };
      }),
      onUpdated: {
        addListener: vi.fn((listener: TabUpdatedListener) => {
          tabUpdatedListener = listener;
        }),
        removeListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn(
          (
            keys: string[],
            callback: (result: Record<string, unknown>) => void
          ) =>
            callback(Object.fromEntries(keys.map((key) => [key, stored[key]])))
        ),
        set: vi.fn((values: Record<string, unknown>, callback: () => void) => {
          Object.assign(stored, values);
          callback();
        }),
        remove: vi.fn((keys: string[], callback: () => void) => {
          keys.forEach((key) => delete stored[key]);
          callback();
        }),
      },
    },
    runtime: {
      ...chrome.runtime,
      sendMessage: vi.fn(async (message) => {
        if (message.type === 'YOUTUBE_URL_UPDATED') {
          runtimeListener?.(message);
          return undefined;
        }
        return message.type === 'PANEL_INIT'
          ? { isPinnedGlobal: false }
          : { success: true };
      }),
      onMessage: {
        addListener: vi.fn((listener: RuntimeListener) => {
          runtimeListener = listener;
        }),
        removeListener: vi.fn(),
      },
    },
  } as unknown as typeof chrome;
});

describe('popup user flow', () => {
  test('loads a video, changes user preferences, and reacts to a URL update', async () => {
    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));
    await waitFor(() => expect(screen.getByText('AI response')).toBeVisible());
    fireEvent.change(screen.getByPlaceholderText(/Zadaj/), {
      target: { value: 'Question' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Zadaj/).closest('form')!);
    await waitFor(() =>
      expect(screen.getAllByText('AI response')).toHaveLength(2)
    );

    fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
    await waitFor(() => expect(screen.getByText(/Konfiguracja/)).toBeVisible());
    fireEvent.change(screen.getByRole('combobox', { name: /J/ }), {
      target: { value: 'English' },
    });
    await waitFor(() =>
      expect(stored.summarizer_settings).toEqual({
        language: 'English',
        model: 'gemini-3.6-flash',
      })
    );
    fireEvent.change(screen.getByRole('combobox', { name: /Model/ }), {
      target: { value: 'gemini-3.1-pro' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Zmie/ }));

    await waitFor(() => {
      expect(stored.summarizer_settings).toEqual({
        language: 'English',
        model: 'gemini-3.1-pro',
      });
      expect(stored.ui_theme).toBe('nord');
    });

    vi.mocked(chrome.tabs.query).mockClear();
    expect(runtimeListener).toBeDefined();
    await act(async () => {
      runtimeListener!({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 3,
        url: 'https://www.youtube.com/watch?v=movie',
      });
    });
    await waitFor(() =>
      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      })
    );

    vi.mocked(chrome.tabs.sendMessage).mockClear();
    stored.summarizer_history = [];
    expect(runtimeListener).toBeDefined();
    await act(async () => {
      runtimeListener!({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 3,
        url: 'https://www.youtube.com/watch?v=movie',
      });
    });
    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'GET_VIDEO_DATA',
      })
    );
  });

  test('refreshes the visible Film after a YouTube URL update', async () => {
    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    vi.mocked(chrome.tabs.sendMessage).mockClear();
    activeTab = {
      id: 3,
      windowId: 4,
      url: 'https://www.youtube.com/watch?v=next-movie',
      title: 'Next Movie from tab',
    };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce({
      success: true,
      videoId: 'next-movie',
      title: 'Next Movie',
      author: 'Next Creator',
      thumbnailUrl: 'next-thumbnail',
    });

    expect(runtimeListener).toBeDefined();
    await act(async () => {
      expect(
        runtimeListener!({
          type: 'YOUTUBE_URL_UPDATED',
          tabId: 3,
          url: 'https://www.youtube.com/watch?v=next-movie',
        })
      ).toBe(false);
    });

    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'GET_VIDEO_DATA',
      })
    );
    await waitFor(() => expect(screen.getByText('Next Movie')).toBeVisible());
  });

  test('refreshes the visible Film from a YouTube tab update event', async () => {
    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    activeTab = {
      id: 3,
      windowId: 4,
      url: 'https://www.youtube.com/watch?v=next-movie',
      title: 'Next Movie from tab',
    };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce({
      success: true,
      videoId: 'next-movie',
      title: 'Next Movie',
      author: 'Next Creator',
      thumbnailUrl: 'next-thumbnail',
    });

    const unregister = registerYoutubeUrlUpdates(chrome);
    expect(tabUpdatedListener).toBeDefined();
    await act(async () => {
      tabUpdatedListener!(3, {
        url: 'https://www.youtube.com/watch?v=next-movie',
      });
    });

    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'GET_VIDEO_DATA',
      })
    );
    await waitFor(() => expect(screen.getByText('Next Movie')).toBeVisible());
    unregister();
  });

  test('opens popup on a video with saved history and restores summary and chat atomically', async () => {
    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Saved Movie Title',
        author: 'Saved Author',
        thumbnailUrl: 'saved-thumbnail',
        summary: 'Saved analysis summary text',
        transcript: [{ start: 0, duration: 5, text: 'Transcript part' }],
        chat: [{ role: 'user', message: 'Existing chat message' }],
        createdAt: 123456789,
      },
    ];

    render(<PopupContainer />);

    await waitFor(() =>
      expect(screen.getByText('Saved Movie Title')).toBeVisible()
    );
    expect(screen.getByText('Saved analysis summary text')).toBeVisible();
    expect(screen.getByText('Existing chat message')).toBeVisible();
  });

  test('automatically switches active model to remaining available provider when active key is deleted and successfully generates summary', async () => {
    stored.gemini_api_key = 'gemini-key';
    stored.openai_api_key = 'openai-key';
    stored.summarizer_settings = {
      language: 'Polski',
      model: 'gemini-3.6-flash',
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'OpenAI podsumowanie po usunięciu klucza Gemini',
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Switch to settings and delete Gemini key while OpenAI key remains
    fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
    await waitFor(() => expect(screen.getByText(/Konfiguracja/)).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Usuń klucz gemini' }));

    // Verify storage was synchronized to OpenAI default model
    await waitFor(() => {
      expect(stored.gemini_api_key).toBe('');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });
    });

    // Switch back to analyze and generate summary
    fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));

    await waitFor(() => {
      expect(
        screen.getByText('OpenAI podsumowanie po usunięciu klucza Gemini')
      ).toBeVisible();
    });
  });

  test('handles AI error during summary generation gracefully', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: 'Invalid API key' },
      }),
    })) as unknown as typeof fetch;

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));

    await waitFor(() => {
      expect(screen.getByText(/Klucz API został odrzucony/)).toBeVisible();
    });
  });

  test('handles transcript error during summary generation gracefully', async () => {
    vi.mocked(chrome.tabs.sendMessage).mockImplementation(
      async (_tabId, message: unknown) => {
        const msg = message as { type?: string };
        if (msg?.type === 'GET_TRANSCRIPT') {
          return {
            error: 'Brak napisów dla tego filmu.',
          };
        }
        if (msg?.type === 'GET_VIDEO_DATA') {
          return {
            success: true,
            videoId: 'movie',
            title: 'Movie',
            author: 'Creator',
            thumbnailUrl: 'thumbnail',
          };
        }
        return { success: true };
      }
    );

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));

    await waitFor(() => {
      expect(screen.getByText('Brak napisów dla tego filmu.')).toBeVisible();
    });
  });

  test('ignores in-flight summary generation result if video was changed during generation', async () => {
    let resolveAiFetch: (value: unknown) => void;
    const pendingFetchPromise = new Promise((resolve) => {
      resolveAiFetch = resolve;
    });

    global.fetch = vi.fn(() => pendingFetchPromise) as unknown as typeof fetch;

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Start generation for Film A ("movie")
    fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Generowanie podsumowania (może potrwać kilka sekund)...'
        )
      ).toBeVisible()
    );

    // Switch video to Film B ("other-movie") while generation is pending
    activeTab = {
      id: 3,
      windowId: 4,
      url: 'https://www.youtube.com/watch?v=other-movie',
      title: 'Other Movie from tab',
    };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
      success: true,
      videoId: 'other-movie',
      title: 'Other Movie',
      author: 'Other Creator',
      thumbnailUrl: 'other-thumbnail',
    });

    await act(async () => {
      runtimeListener!({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 3,
        url: 'https://www.youtube.com/watch?v=other-movie',
      });
    });

    await waitFor(() => expect(screen.getByText('Other Movie')).toBeVisible());

    // Now Film A AI fetch completes
    await act(async () => {
      resolveAiFetch!({
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: 'Old movie AI summary' }] } },
          ],
        }),
      });
    });

    // Verify that Other Movie does NOT show Film A's summary or error
    expect(screen.queryByText('Old movie AI summary')).not.toBeInTheDocument();
    expect(screen.getByText('Other Movie')).toBeVisible();
    // And storage does not save Film A summary under other-movie
    expect(
      (stored.summarizer_history as unknown[]).some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => r.videoId === 'other-movie'
      )
    ).toBe(false);
  });

  test('resumes a saved session from History tab and continues conversation updating only target record', async () => {
    stored.summarizer_history = [
      {
        videoId: 'history-vid',
        title: 'History Video Title',
        author: 'History Author',
        thumbnailUrl: 'https://example.com/hist.jpg',
        summary: 'Saved summary for history video',
        transcript: [{ start: 0, duration: 3, text: 'Hello history' }],
        chat: [
          { role: 'user', message: 'Prior question' },
          { role: 'model', message: 'Prior answer' },
        ],
        createdAt: 1000,
      },
      {
        videoId: 'other-vid',
        title: 'Other Saved Video',
        author: 'Other Author',
        thumbnailUrl: 'https://example.com/other.jpg',
        summary: 'Other summary',
        transcript: [],
        chat: [],
        createdAt: 900,
      },
    ];

    render(<PopupContainer />);

    // Wait for active tab video to load first
    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Switch to History tab
    fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
    await waitFor(() =>
      expect(screen.getByText('History Video Title')).toBeVisible()
    );

    // Click on the saved history item
    fireEvent.click(screen.getByText('History Video Title'));

    // Verify active tab switched to analyze with restored data
    await waitFor(() =>
      expect(screen.getByText('History Video Title')).toBeVisible()
    );
    expect(screen.getByText('Saved summary for history video')).toBeVisible();
    expect(screen.getByText('Prior question')).toBeVisible();
    expect(screen.getByText('Prior answer')).toBeVisible();

    // Now send a new question in the resumed session
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Fresh AI chat reply' }] } }],
      }),
    })) as unknown as typeof fetch;

    fireEvent.change(screen.getByPlaceholderText(/Zadaj/), {
      target: { value: 'New follow-up question' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Zadaj/).closest('form')!);

    await waitFor(() =>
      expect(screen.getByText('Fresh AI chat reply')).toBeVisible()
    );
    expect(screen.getByText('New follow-up question')).toBeVisible();

    // Verify storage only updated history-vid
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedHistory = stored.summarizer_history as any[];
    const historyVid = updatedHistory.find((r) => r.videoId === 'history-vid');
    const otherVid = updatedHistory.find((r) => r.videoId === 'other-vid');

    expect(historyVid.chat).toHaveLength(4);
    expect(historyVid.chat[2]).toEqual({
      role: 'user',
      message: 'New follow-up question',
    });
    expect(historyVid.chat[3]).toEqual({
      role: 'model',
      message: 'Fresh AI chat reply',
    });
    expect(otherVid.chat).toHaveLength(0);
  });

  test('sends a chat question when transcript is not pre-fetched, retrieving transcript automatically', async () => {
    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: 'Response with auto transcript' }] } },
        ],
      }),
    })) as unknown as typeof fetch;

    fireEvent.change(screen.getByPlaceholderText(/Zadaj/), {
      target: { value: 'Question before summary' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Zadaj/).closest('form')!);

    // Should fetch transcript first and then get chat reply
    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ type: 'GET_TRANSCRIPT' })
      )
    );

    await waitFor(() =>
      expect(screen.getByText('Response with auto transcript')).toBeVisible()
    );
    expect(screen.getByText('Question before summary')).toBeVisible();

    // Verify history record is created
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saved = (stored.summarizer_history as any[]).find(
      (r) => r.videoId === 'movie'
    );
    expect(saved).toBeDefined();
    expect(saved.transcript).toEqual([
      { start: 0, duration: 2, text: 'Transcript' },
    ]);
    expect(saved.chat).toHaveLength(2);
  });

  test('handles AI error during chat while preserving existing chat history', async () => {
    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // First successful message
    fireEvent.change(screen.getByPlaceholderText(/Zadaj/), {
      target: { value: 'Initial question' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Zadaj/).closest('form')!);
    await waitFor(() => expect(screen.getByText('AI response')).toBeVisible());

    // Second message fails
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: 'AI service unavailable' },
      }),
    })) as unknown as typeof fetch;

    fireEvent.change(screen.getByPlaceholderText(/Zadaj/), {
      target: { value: 'Failing question' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Zadaj/).closest('form')!);

    await waitFor(() => expect(screen.getByText(/Błąd czatu/)).toBeVisible());

    // Initial conversation is still preserved!
    expect(screen.getByText('Initial question')).toBeVisible();
    expect(screen.getByText('AI response')).toBeVisible();
    expect(screen.getByText('Failing question')).toBeVisible();
  });

  test('ignores in-flight chat response if video was changed during request', async () => {
    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'thumbnail',
        summary: null,
        transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
        chat: [],
        createdAt: 1000,
      },
    ];

    let resolveChatFetch: (value: unknown) => void;
    const pendingChatPromise = new Promise((resolve) => {
      resolveChatFetch = resolve;
    });

    global.fetch = vi.fn(() => pendingChatPromise) as unknown as typeof fetch;

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Start chat request on Film A ("movie")
    fireEvent.change(screen.getByPlaceholderText(/Zadaj/), {
      target: { value: 'Chat question for Film A' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Zadaj/).closest('form')!);

    await waitFor(() =>
      expect(screen.getByText('Chat question for Film A')).toBeVisible()
    );

    // Switch video to Film B ("other-movie") while chat request is pending
    activeTab = {
      id: 3,
      windowId: 4,
      url: 'https://www.youtube.com/watch?v=other-movie',
      title: 'Other Movie from tab',
    };
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({
      success: true,
      videoId: 'other-movie',
      title: 'Other Movie',
      author: 'Other Creator',
      thumbnailUrl: 'other-thumbnail',
    });

    await act(async () => {
      runtimeListener!({
        type: 'YOUTUBE_URL_UPDATED',
        tabId: 3,
        url: 'https://www.youtube.com/watch?v=other-movie',
      });
    });

    await waitFor(() => expect(screen.getByText('Other Movie')).toBeVisible());

    // Now Film A chat response completes
    await act(async () => {
      resolveChatFetch!({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Film A Chat Reply' }] } }],
        }),
      });
    });

    // Verify Film B does not display Film A's reply or question
    expect(screen.queryByText('Film A Chat Reply')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Chat question for Film A')
    ).not.toBeInTheDocument();
  });

  test('allows user to clear chat and updates stored record', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'thumbnail',
        summary: 'Existing summary',
        transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
        chat: [
          { role: 'user', message: 'Hello' },
          { role: 'model', message: 'Hi there' },
        ],
        createdAt: 1000,
      },
    ];

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    expect(screen.getByText('Hi there')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Wyczyść' }));

    await waitFor(() =>
      expect(screen.queryByText('Hi there')).not.toBeInTheDocument()
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record = (stored.summarizer_history as any[]).find(
      (r) => r.videoId === 'movie'
    );
    expect(record.chat).toEqual([]);
  });

  test('cleans up analysis session when current video history record is deleted', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'thumbnail',
        summary: 'Summary to delete',
        transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
        chat: [],
        createdAt: 1000,
      },
    ];

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    expect(screen.getByText('Summary to delete')).toBeVisible();

    // Switch to History tab and delete the record
    fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'Usuń z historii' }));

    // Switch back to analyze tab
    fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));

    await waitFor(() => {
      expect(screen.queryByText('Summary to delete')).not.toBeInTheDocument();
      // Should show Generate Summary button again
      expect(screen.getByRole('button', { name: /Generuj/ })).toBeVisible();
    });
  });

  test('clears all API keys and history when user confirms in settings', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    stored.gemini_api_key = 'some-key';
    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'thumbnail',
        summary: 'Some summary',
        transcript: [],
        chat: [],
        createdAt: 1000,
      },
    ];

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Switch to settings
    fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
    await waitFor(() => expect(screen.getByText(/Konfiguracja/)).toBeVisible());

    fireEvent.click(
      screen.getByRole('button', {
        name: /Usuń wszystkie klucze API i historię/,
      })
    );

    await waitFor(() => {
      expect(stored.gemini_api_key).toBe('');
      expect(stored.summarizer_history).toEqual([]);
    });

    // Switch back to analyze tab
    fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
    await waitFor(() =>
      expect(screen.getByText('Wymagany klucz API')).toBeVisible()
    );
  });

  test('renders a single vertical scroll container for long summary and chat conversation with interactive timestamps', async () => {
    const longSummary =
      '## Główne wątki\n- Pierwszy punkt [01:15]\n- Drugi punkt z opisem [04:30]\n### Szczegóły\nKolejne rozwinięcie [10:00]';

    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Długi Film z podsumowaniem i czatem',
        author: 'Twórca',
        thumbnailUrl: 'thumb',
        summary: longSummary,
        transcript: [{ start: 0, duration: 10, text: 'Transkrypcja' }],
        chat: [
          { role: 'user', message: 'Pytanie o treść [01:15]' },
          { role: 'model', message: 'Odpowiedź modelu AI' },
        ],
        createdAt: 1000,
      },
    ];

    render(<PopupContainer />);

    await waitFor(() =>
      expect(
        screen.getByText('Długi Film z podsumowaniem i czatem')
      ).toBeVisible()
    );

    // Verify both chat and summary are visible in the document
    expect(screen.getByText('Pytanie o treść')).toBeVisible();
    expect(screen.getByText('Odpowiedź modelu AI')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Główne wątki' })).toBeVisible();
    expect(screen.getByText(/Pierwszy punkt/)).toBeVisible();

    // Verify there is a single main vertical scroll container in AnalyzeView
    const scrollContainers = document.querySelectorAll('.overflow-y-auto');
    expect(scrollContainers).toHaveLength(1);
    const mainScroll = scrollContainers[0];

    // Ensure both chat messages and summary are contained within this single scroll container
    expect(mainScroll).toContainElement(screen.getByText('Pytanie o treść'));
    expect(mainScroll).toContainElement(screen.getByText(/Pierwszy punkt/));

    // Verify timestamps in summary are interactive
    const tsButton = screen.getByRole('button', { name: '04:30' });
    expect(tsButton).toBeVisible();
    fireEvent.click(tsButton);

    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'SEEK_TO',
        seconds: 270,
      })
    );
  });

  test('toggles theme between night and nord maintaining data-theme attribute on extension root', async () => {
    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    const rootElement = document.getElementById('my-ext');
    expect(rootElement).toHaveAttribute('data-theme', 'night');

    // Toggle theme button
    const themeBtn = screen.getByRole('button', { name: 'Zmień motyw' });
    fireEvent.click(themeBtn);

    await waitFor(() => {
      expect(rootElement).toHaveAttribute('data-theme', 'nord');
      expect(stored.ui_theme).toBe('nord');
    });

    fireEvent.click(themeBtn);

    await waitFor(() => {
      expect(rootElement).toHaveAttribute('data-theme', 'night');
      expect(stored.ui_theme).toBe('night');
    });
  });

  test('normalizes active model on initialization when opening with OpenAI key and un-normalized storage state', async () => {
    stored.gemini_api_key = '';
    stored.openai_api_key = 'openai-initial-key';
    stored.summarizer_settings = {
      language: 'Polski',
      model: 'gemini-3.5-flash', // legacy or unavailable model
    };

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'OpenAI podsumowanie filmu',
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    render(<PopupContainer />);

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Storage should be normalized to gpt-5.6-luna
    expect(stored.summarizer_settings).toEqual({
      language: 'Polski',
      model: 'gpt-5.6-luna',
    });

    // Clicking generate should use OpenAI key without error
    fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));

    await waitFor(() => {
      expect(screen.getByText('OpenAI podsumowanie filmu')).toBeVisible();
    });
  });

  describe('model synchronization on API key save and delete (Issue #39)', () => {
    test('saving first OpenAI key synchronizes model to gpt-5.6-luna and displays success message after sync', async () => {
      stored.gemini_api_key = '';
      stored.openai_api_key = '';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      };

      render(<PopupContainer />);
      await waitFor(() =>
        expect(screen.getByText('Wymagany klucz API')).toBeVisible()
      );

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Verify no model selector exists yet (no keys)
      expect(
        screen.getByText('Dodaj klucz API, aby móc wybrać model.')
      ).toBeVisible();

      // Select OpenAI provider and enter API key
      fireEvent.change(screen.getByLabelText(/Wybierz Dostawcę AI/), {
        target: { value: 'openai' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'sk-new-openai-key' },
      });

      // Save key
      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      // Wait for success message which must appear after sync
      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      // Assert storage state is consistent
      expect(stored.openai_api_key).toBe('sk-new-openai-key');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });

      // Assert visible selector reflects the active model
      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('gpt-5.6-luna');
      expect(Array.from(modelSelect.options).map((opt) => opt.value)).toContain(
        'gpt-5.6-luna'
      );
    });

    test('saving first Claude key synchronizes model to claude-sonnet-5', async () => {
      stored.gemini_api_key = '';
      stored.openai_api_key = '';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      };

      render(<PopupContainer />);
      await waitFor(() =>
        expect(screen.getByText('Wymagany klucz API')).toBeVisible()
      );

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Select Claude provider and enter API key
      fireEvent.change(screen.getByLabelText(/Wybierz Dostawcę AI/), {
        target: { value: 'claude' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'sk-ant-claude-key' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      expect(stored.claude_api_key).toBe('sk-ant-claude-key');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'claude-sonnet-5',
      });

      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('claude-sonnet-5');
    });

    test('saving first Gemini key synchronizes model to gemini-3.6-flash', async () => {
      stored.gemini_api_key = '';
      stored.openai_api_key = '';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.5-flash', // hidden legacy model
      };

      render(<PopupContainer />);
      await waitFor(() =>
        expect(screen.getByText('Wymagany klucz API')).toBeVisible()
      );

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Select Gemini provider and enter API key
      fireEvent.change(screen.getByLabelText(/Wybierz Dostawcę AI/), {
        target: { value: 'gemini' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'gemini-new-key' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      expect(stored.gemini_api_key).toBe('gemini-new-key');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gemini-3.6-flash',
      });

      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('gemini-3.6-flash');
    });

    test('adding a second API key preserves user manual model choice without overwriting', async () => {
      stored.gemini_api_key = '';
      stored.openai_api_key = 'sk-existing-openai';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'English',
        model: 'gpt-5.6-terra', // user manually picked terra
      };

      render(<PopupContainer />);
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Add Gemini key as second key
      fireEvent.change(screen.getByLabelText(/Wybierz Dostawcę AI/), {
        target: { value: 'gemini' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'gemini-second-key' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      // Storage keeps gpt-5.6-terra intact
      expect(stored.gemini_api_key).toBe('gemini-second-key');
      expect(stored.openai_api_key).toBe('sk-existing-openai');
      expect(stored.summarizer_settings).toEqual({
        language: 'English',
        model: 'gpt-5.6-terra',
      });

      // Selector still displays gpt-5.6-terra
      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('gpt-5.6-terra');
    });

    test('deleting active provider key switches model to another available provider', async () => {
      stored.gemini_api_key = '';
      stored.openai_api_key = 'sk-openai';
      stored.claude_api_key = 'sk-claude';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gpt-5.6-luna',
      };

      render(<PopupContainer />);
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Delete active OpenAI key
      fireEvent.click(
        screen.getByRole('button', { name: 'Usuń klucz openai' })
      );

      await waitFor(() => {
        expect(stored.openai_api_key).toBe('');
        // Switched to Claude default model
        expect(stored.summarizer_settings).toEqual({
          language: 'Polski',
          model: 'claude-sonnet-5',
        });
      });

      // Selector reflects claude-sonnet-5
      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('claude-sonnet-5');
    });

    test('deleting inactive provider key preserves active model', async () => {
      stored.gemini_api_key = 'sk-gemini';
      stored.openai_api_key = 'sk-openai';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      };

      render(<PopupContainer />);
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Delete inactive OpenAI key
      fireEvent.click(
        screen.getByRole('button', { name: 'Usuń klucz openai' })
      );

      await waitFor(() => {
        expect(stored.openai_api_key).toBe('');
        // Model stays gemini-3.6-flash
        expect(stored.summarizer_settings).toEqual({
          language: 'Polski',
          model: 'gemini-3.6-flash',
        });
      });

      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('gemini-3.6-flash');
    });

    test('deleting the last remaining key leaves generation unavailable without phantom model selector', async () => {
      stored.gemini_api_key = 'only-gemini-key';
      stored.openai_api_key = '';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      };

      render(<PopupContainer />);
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Delete last remaining key
      fireEvent.click(
        screen.getByRole('button', { name: 'Usuń klucz gemini' })
      );

      await waitFor(() => {
        expect(stored.gemini_api_key).toBe('');
        // Model selector is replaced with prompt
        expect(
          screen.getByText('Dodaj klucz API, aby móc wybrać model.')
        ).toBeVisible();
        expect(
          screen.queryByRole('combobox', { name: /Wybór Modelu API/ })
        ).not.toBeInTheDocument();
      });

      // Switch to Analyze tab and verify generation is blocked
      fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
      await waitFor(() => {
        expect(screen.getByText('Wymagany klucz API')).toBeVisible();
        expect(
          screen.queryByRole('button', { name: /Generuj/ })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('integration regression: first API key flow -> summary generation (Issue #40)', () => {
    test('complete user journey: fresh install -> add first OpenAI key -> generate summary -> reload panel', async () => {
      // 1. Fresh installation state
      stored.gemini_api_key = '';
      stored.openai_api_key = '';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      };
      stored.summarizer_history = [];

      global.fetch = vi.fn(async (input) => {
        const url = String(input);
        if (url.includes('api.openai.com')) {
          return {
            ok: true,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: 'Podsumowanie filmu wygenerowane przez OpenAI',
                  },
                },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'AI response' }] } }],
            content: [{ type: 'text', text: 'AI response' }],
            choices: [{ message: { content: 'AI response' } }],
          }),
        };
      }) as unknown as typeof fetch;

      // 2. Render initial popup
      const { unmount } = render(<PopupContainer />);
      await waitFor(() =>
        expect(screen.getByText('Wymagany klucz API')).toBeVisible()
      );

      // Analyze view warns about missing API key and does not allow generation
      expect(
        screen.queryByRole('button', { name: /Generuj/ })
      ).not.toBeInTheDocument();

      // 3. Open settings tab and configure OpenAI key
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      // Model selector is absent before any key is added
      expect(
        screen.getByText('Dodaj klucz API, aby móc wybrać model.')
      ).toBeVisible();
      expect(
        screen.queryByRole('combobox', { name: /Wybór Modelu API/ })
      ).not.toBeInTheDocument();

      // Select OpenAI and enter valid key
      fireEvent.change(screen.getByLabelText(/Wybierz Dostawcę AI/), {
        target: { value: 'openai' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'sk-first-openai-key' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      // Wait for success confirmation
      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      // Storage has key and normalized default model
      expect(stored.openai_api_key).toBe('sk-first-openai-key');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });

      // Model selector displays the registered OpenAI model
      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('gpt-5.6-luna');

      // 4. Return to Analyze view and generate summary
      fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
      await waitFor(() =>
        expect(screen.queryByText('Wymagany klucz API')).not.toBeInTheDocument()
      );

      const generateBtn = screen.getByRole('button', { name: /Generuj/ });
      expect(generateBtn).toBeVisible();
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Podsumowanie filmu wygenerowane przez OpenAI')
        ).toBeVisible();
      });

      // Verify OpenAI endpoint and bearer token were used
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-first-openai-key',
          }),
          body: expect.stringContaining('"model":"gpt-5.6-luna"'),
        })
      );

      // Verify storage recorded history
      expect(stored.summarizer_history).toHaveLength(1);

      // 5. Simulate reopening / reloading the panel
      unmount();

      render(<PopupContainer />);
      await waitFor(() =>
        expect(
          screen.getByText('Podsumowanie filmu wygenerowane przez OpenAI')
        ).toBeVisible()
      );

      // Open settings in reloaded panel: selector still shows gpt-5.6-luna
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      const reloadedModelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(reloadedModelSelect.value).toBe('gpt-5.6-luna');
    });

    test('edge cases: adding second key preserves model choice, deleting active key switches provider and generating works', async () => {
      // Setup with active OpenAI key and custom choice gpt-5.6-terra
      stored.gemini_api_key = '';
      stored.openai_api_key = 'sk-existing-openai';
      stored.claude_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gpt-5.6-terra',
      };
      stored.summarizer_history = [];

      global.fetch = vi.fn(async (input) => {
        const url = String(input);
        if (url.includes('anthropic.com')) {
          return {
            ok: true,
            json: async () => ({
              content: [{ type: 'text', text: 'Podsumowanie z Claude' }],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Podsumowanie z OpenAI' } }],
          }),
        };
      }) as unknown as typeof fetch;

      render(<PopupContainer />);
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open Settings and add Claude as second key
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      fireEvent.change(screen.getByLabelText(/Wybierz Dostawcę AI/), {
        target: { value: 'claude' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'sk-second-claude-key' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      // Storage still preserves user choice gpt-5.6-terra
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gpt-5.6-terra',
      });

      // Delete active OpenAI key
      fireEvent.click(
        screen.getByRole('button', { name: 'Usuń klucz openai' })
      );

      await waitFor(() => {
        expect(stored.openai_api_key).toBe('');
        // Automatically switches to Claude default model
        expect(stored.summarizer_settings).toEqual({
          language: 'Polski',
          model: 'claude-sonnet-5',
        });
      });

      // Return to Analyze tab and generate summary with Claude
      fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /Generuj/ })
        ).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: /Generuj/ }));
      await waitFor(() => {
        expect(screen.getByText('Podsumowanie z Claude')).toBeVisible();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'sk-second-claude-key',
          }),
          body: expect.stringContaining('"model":"claude-sonnet-5"'),
        })
      );
    });
  });
});
