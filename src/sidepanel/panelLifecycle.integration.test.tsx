/* @vitest-environment jsdom */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import registerYoutubeNavigationEvents from '../background/youtubeNavigationEvents';
import { SidePanelDependencies } from './compositionRoot';
import {
  createSidePanelHarness,
  SidePanelHarness,
} from './sidePanelHarness.test';

let harness: SidePanelHarness;

function renderApp(customDeps?: Partial<SidePanelDependencies>) {
  return harness.render(customDeps);
}

const stored = new Proxy({} as Record<string, unknown>, {
  get: (_target, prop: string) => harness?.storage?.data?.[prop],
  set: (_target, prop: string, value: unknown) => {
    if (harness?.storage) {
      harness.storage.data[prop] = value;
    }
    return true;
  },
  deleteProperty: (_target, prop: string) => {
    if (harness?.storage) {
      delete harness.storage.data[prop];
    }
    return true;
  },
});

let activeTab: Partial<chrome.tabs.Tab>;

beforeEach(() => {
  harness = createSidePanelHarness();
  activeTab = harness.youtube.activeTab;
});

afterEach(() => {
  harness?.cleanup();
});

describe('side panel lifecycle and platform runtime integration', () => {
  test('refreshes the visible Film after a YouTube URL update', async () => {
    renderApp();

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    vi.mocked(chrome.tabs.sendMessage).mockClear();
    activeTab = {
      id: 3,
      windowId: 4,
      url: 'https://www.youtube.com/watch?v=next-movie',
      title: 'Next Movie from tab',
    };
    harness.youtube.activeTab = activeTab;
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce({
      success: true,
      videoId: 'next-movie',
      title: 'Next Movie',
      author: 'Next Creator',
      thumbnailUrl: 'next-thumbnail',
    });

    expect(harness.runtimeListener).toBeDefined();
    await act(async () => {
      expect(
        harness.runtimeListener!({
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
    renderApp();

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
    activeTab = {
      id: 3,
      windowId: 4,
      url: 'https://www.youtube.com/watch?v=next-movie',
      title: 'Next Movie from tab',
    };
    harness.youtube.activeTab = activeTab;
    vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce({
      success: true,
      videoId: 'next-movie',
      title: 'Next Movie',
      author: 'Next Creator',
      thumbnailUrl: 'next-thumbnail',
    });

    const unregister = registerYoutubeNavigationEvents(chrome);
    expect(harness.tabUpdatedListener).toBeDefined();
    await act(async () => {
      harness.tabUpdatedListener!(3, {
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

    renderApp();

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

  test('initializes panel, reads active film, preferences, and analysis history using explicitly injected controlled adapters', async () => {
    const memory: Record<string, unknown> = {};
    const controlledStorageAdapter = {
      read: vi.fn(async (keys: readonly string[]) =>
        Object.fromEntries(keys.map((k) => [k, memory[k]]))
      ),
      write: vi.fn(async (values: Record<string, unknown>) => {
        Object.assign(memory, values);
      }),
    };

    const controlledYoutubeAdapter = {
      getActiveTab: vi.fn(async () => ({
        id: 42,
        url: 'https://www.youtube.com/watch?v=controlled-vid',
        title: 'Controlled Video Title',
      })),
      getVideoData: vi.fn(async () => ({
        success: true as const,
        videoId: 'controlled-vid',
        title: 'Controlled Video Title',
        author: 'Controlled Author',
        thumbnailUrl: 'https://example.com/controlled.jpg',
      })),
      getTranscript: vi.fn(async () => ({
        success: true as const,
        transcript: [{ start: 0, duration: 3, text: 'Controlled transcript' }],
      })),
      seekTo: vi.fn(async () => ({ success: true as const })),
    };

    const customFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: 'Controlled AI response' }] } },
        ],
      }),
    })) as unknown as typeof fetch;

    const controlledHarness = createSidePanelHarness({
      storage: controlledStorageAdapter,
      youtubeAdapter: controlledYoutubeAdapter,
      customFetch,
    });

    // Seed settings and history through the controlled modules
    await controlledHarness.dependencies.settings.setApiKey(
      'gemini',
      'controlled-gemini-key'
    );
    await controlledHarness.dependencies.settings.setSettings({
      language: 'Polski',
      model: 'gemini-3.6-flash',
    });
    await controlledHarness.dependencies.history.saveRecord({
      videoId: 'controlled-vid',
      title: 'Controlled Video Title',
      author: 'Controlled Author',
      thumbnailUrl: 'https://example.com/controlled.jpg',
      summary: 'Controlled Summary',
      transcript: [{ start: 0, duration: 3, text: 'Controlled transcript' }],
      chat: [],
    });

    // Render with explicitly injected dependencies through harness
    controlledHarness.render();

    // Assert active film and restored saved session
    await waitFor(() =>
      expect(screen.getByText('Controlled Video Title')).toBeVisible()
    );
    await waitFor(() =>
      expect(screen.getByText('Controlled Summary')).toBeVisible()
    );

    // Verify history tab access through the controlled adapter
    fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
    await waitFor(() => {
      expect(screen.getByText('Zapisane Sesje (1)')).toBeVisible();
    });

    // Verify settings tab access through the controlled adapter
    fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
    await waitFor(() => {
      expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible();
    });
    controlledHarness.cleanup();
  });

  describe('panel runtime integration through harness (Issue #85)', () => {
    test('lifecycle: queries panel context, initializes background panel state, and reflects pinned state', async () => {
      harness = createSidePanelHarness({
        panelContext: { tabId: 42, windowId: 7 },
        isPinnedGlobal: true,
      });

      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
      expect(harness.runtime.initCalls).toContain(42);
      expect(harness.runtime.isPinnedGlobal).toBe(true);
      // Pinned panel hides the "Przypnij" button in the header
      expect(
        screen.queryByRole('button', { name: /Przypnij/ })
      ).not.toBeInTheDocument();
    });

    test('lifecycle: handles missing panel context gracefully without calling initialize', async () => {
      harness = createSidePanelHarness({
        panelContext: null,
      });

      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
      expect(harness.runtime.initCalls).toEqual([]);
      // Since context is null, "Przypnij" remains visible
      expect(screen.getByRole('button', { name: /Przypnij/ })).toBeVisible();
    });

    test('subscription cleanup: removes notification listener when unmounted', async () => {
      harness = createSidePanelHarness();
      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
      expect(harness.runtime.listenerCount).toBe(1);

      harness.cleanup();
      expect(harness.runtime.listenerCount).toBe(0);
    });

    test('film update: refreshes active film when runtime notification is emitted', async () => {
      harness = createSidePanelHarness();
      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Change active tab and video data in harness
      harness.youtube.activeTab = {
        id: 3,
        windowId: 4,
        url: 'https://www.youtube.com/watch?v=runtime-notification-video',
        title: 'Notification Video from tab',
      };
      harness.youtube.videoData = {
        success: true,
        videoId: 'runtime-notification-video',
        title: 'Runtime Notification Video',
        author: 'Notification Creator',
        thumbnailUrl: 'https://example.com/notification.jpg',
      };

      // Emit notification directly through controlled runtime
      await act(async () => {
        harness.runtime.emitNotification({
          type: 'YOUTUBE_URL_UPDATED',
          tabId: 3,
          url: 'https://www.youtube.com/watch?v=runtime-notification-video',
        });
      });

      await waitFor(() =>
        expect(screen.getByText('Runtime Notification Video')).toBeVisible()
      );
    });

    test('pinning success: clicking pin requests global pin, updates state, and hides pin button', async () => {
      harness = createSidePanelHarness({
        panelContext: { tabId: 3, windowId: 4 },
        isPinnedGlobal: false,
      });
      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
      const pinButton = screen.getByRole('button', { name: /Przypnij/ });
      expect(pinButton).toBeVisible();

      fireEvent.click(pinButton);

      await waitFor(() => {
        expect(harness.runtime.pinCalls).toEqual([{ tabId: 3, windowId: 4 }]);
        expect(harness.runtime.isPinnedGlobal).toBe(true);
        expect(
          screen.queryByRole('button', { name: /Przypnij/ })
        ).not.toBeInTheDocument();
      });
    });

    test('pinning error response: keeps pin button visible and does not set pinned state', async () => {
      harness = createSidePanelHarness({
        panelContext: { tabId: 3, windowId: 4 },
        isPinnedGlobal: false,
      });
      harness.runtime.setPinResult({ error: 'Błąd przypinania panelu.' });
      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
      const pinButton = screen.getByRole('button', { name: /Przypnij/ });
      expect(pinButton).toBeVisible();

      fireEvent.click(pinButton);

      await waitFor(() => {
        expect(harness.runtime.pinCalls).toEqual([{ tabId: 3, windowId: 4 }]);
      });

      expect(harness.runtime.isPinnedGlobal).toBe(false);
      expect(screen.getByRole('button', { name: /Przypnij/ })).toBeVisible();
    });

    test('pinning rejection: logs error to console and keeps pin button visible', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      harness = createSidePanelHarness({
        panelContext: { tabId: 3, windowId: 4 },
        isPinnedGlobal: false,
      });
      harness.runtime.setPinRejection(new Error('Chrome IPC error'));
      renderApp();

      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());
      const pinButton = screen.getByRole('button', { name: /Przypnij/ });
      expect(pinButton).toBeVisible();

      fireEvent.click(pinButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to pin the side panel:',
          expect.any(Error)
        );
      });

      expect(harness.runtime.isPinnedGlobal).toBe(false);
      expect(screen.getByRole('button', { name: /Przypnij/ })).toBeVisible();

      consoleErrorSpy.mockRestore();
    });
  });
});
