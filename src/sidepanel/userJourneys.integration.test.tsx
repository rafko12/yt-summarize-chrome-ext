/* @vitest-environment jsdom */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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

beforeEach(() => {
  harness = createSidePanelHarness();
});

afterEach(() => {
  harness?.cleanup();
});

describe('side panel user journeys and integrated end-to-end flows', () => {
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

    // 2. Render initial side panel
    const { unmount } = renderApp();
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

    renderApp();
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

  test('complete user journey: restore saved analysis session from history -> view past chat -> continue conversation', async () => {
    stored.gemini_api_key = 'valid-gemini-key';
    stored.summarizer_settings = {
      language: 'Polski',
      model: 'gemini-3.6-flash',
    };
    stored.summarizer_history = [
      {
        videoId: 'saved-vid',
        title: 'Wcześniej Zapisany Film',
        author: 'Poprzedni Twórca',
        thumbnailUrl: 'https://example.com/hist.jpg',
        summary: 'Zachowane podsumowanie wcześniejszej analizy',
        transcript: [{ start: 0, duration: 4, text: 'Napisy z historii' }],
        chat: [
          { role: 'user', message: 'Wcześniejsze pytanie użytkownika' },
          { role: 'model', message: 'Wcześniejsza odpowiedź asystenta' },
        ],
        createdAt: 1000,
      },
    ];

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Nowa odpowiedź w przywróconej sesji' }],
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    renderApp();

    // Wait for active tab video to initialize
    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Navigate to History tab
    fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
    await waitFor(() =>
      expect(screen.getByText('Wcześniej Zapisany Film')).toBeVisible()
    );

    // Click on the saved history entry to restore it
    fireEvent.click(screen.getByText('Wcześniej Zapisany Film'));

    // Verify atomic transition to Analyze tab with restored data
    await waitFor(() =>
      expect(screen.getByText('Wcześniej Zapisany Film')).toBeVisible()
    );
    expect(
      screen.getByText('Zachowane podsumowanie wcześniejszej analizy')
    ).toBeVisible();
    expect(screen.getByText('Wcześniejsze pytanie użytkownika')).toBeVisible();
    expect(screen.getByText('Wcześniejsza odpowiedź asystenta')).toBeVisible();

    // Continue conversation by asking a follow-up question
    const chatInput = screen.getByPlaceholderText(/Zadaj/);
    fireEvent.change(chatInput, {
      target: { value: 'Kolejne pytanie w sesji' },
    });
    fireEvent.submit(chatInput.closest('form')!);

    await waitFor(() => {
      expect(
        screen.getByText('Nowa odpowiedź w przywróconej sesji')
      ).toBeVisible();
    });

    // Verify history storage was updated with the new chat messages
    const historyEntry = (
      stored.summarizer_history as Array<{
        videoId: string;
        chat: Array<{ role: string; message: string }>;
      }>
    ).find((item) => item.videoId === 'saved-vid');
    expect(historyEntry).toBeDefined();
    expect(historyEntry?.chat).toHaveLength(4);
    expect(historyEntry?.chat[2]).toEqual({
      role: 'user',
      message: 'Kolejne pytanie w sesji',
    });
    expect(historyEntry?.chat[3]).toEqual({
      role: 'model',
      message: 'Nowa odpowiedź w przywróconej sesji',
    });
  });

  test('loads a video, changes user preferences, and reacts to a URL update', async () => {
    renderApp();

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
    expect(harness.runtimeListener).toBeDefined();
    await act(async () => {
      harness.runtimeListener!({
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
    expect(harness.runtimeListener).toBeDefined();
    await act(async () => {
      harness.runtimeListener!({
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

  test('multi-provider flow: configure second key, delete active key, and generate with fallback provider', async () => {
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

    renderApp();
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
    fireEvent.click(screen.getByRole('button', { name: 'Usuń klucz openai' }));

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
