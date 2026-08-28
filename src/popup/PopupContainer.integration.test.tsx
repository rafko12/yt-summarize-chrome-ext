/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import PopupContainer from './PopupContainer';

type RuntimeListener = (message: unknown) => void;
let stored: Record<string, unknown>;
let runtimeListener: RuntimeListener | undefined;

beforeEach(() => {
  stored = {
    gemini_api_key: 'key',
    summarizer_settings: { language: 'Polski', model: 'gemini-3.6-flash' },
    summarizer_history: [],
    ui_theme: 'night',
  };
  runtimeListener = undefined;
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'AI response' }] } }],
    }),
  })) as unknown as typeof fetch;
  window.matchMedia = vi.fn(() => ({
    matches: true,
  })) as unknown as typeof window.matchMedia;
  global.chrome = {
    ...chrome,
    tabs: {
      ...chrome.tabs,
      query: vi.fn(async () => [
        {
          id: 3,
          windowId: 4,
          url: 'https://www.youtube.com/watch?v=movie',
          title: 'Movie from tab',
        },
      ]),
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
      sendMessage: vi.fn(async (message) =>
        message.type === 'PANEL_INIT'
          ? { success: true, isPinnedGlobal: false }
          : { success: true }
      ),
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
    runtimeListener!({
      type: 'YOUTUBE_URL_UPDATED',
      tabId: 3,
      url: 'https://www.youtube.com/watch?v=movie',
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
    runtimeListener!({
      type: 'YOUTUBE_URL_UPDATED',
      tabId: 3,
      url: 'https://www.youtube.com/watch?v=movie',
    });
    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'GET_VIDEO_DATA',
      })
    );
  });
});
