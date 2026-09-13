/* @vitest-environment jsdom */

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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

describe('side panel user journeys and integrated flows', () => {
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

    renderApp();

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

  test('cancels clearing all API keys and history in danger zone when user rejects confirmation in window.confirm', async () => {
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementation(() => false);

    stored.gemini_api_key = 'preserved-gemini-key';
    stored.theme = 'night';
    stored.user_settings = { language: 'English', model: 'gpt-5.6-terra' };
    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Movie',
        author: 'Creator',
        thumbnailUrl: 'thumbnail',
        summary: 'Preserved summary',
        transcript: [],
        chat: [],
        createdAt: 1000,
      },
    ];

    renderApp();

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    // Switch to settings
    fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
    await waitFor(() => expect(screen.getByText(/Konfiguracja/)).toBeVisible());

    fireEvent.click(
      screen.getByRole('button', {
        name: /Usuń wszystkie klucze API i historię/,
      })
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      'Czy na pewno chcesz usunąć wszystkie klucze API oraz całą historię? Tej operacji nie można cofnąć.'
    );

    // Verify data in storage was not changed
    expect(stored.gemini_api_key).toBe('preserved-gemini-key');
    expect(stored.summarizer_history).toHaveLength(1);
    expect(stored.theme).toBe('night');
    expect(stored.user_settings).toEqual({
      language: 'English',
      model: 'gpt-5.6-terra',
    });

    // Switch back to analyze tab - session still preserved and no API key error
    fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
    await waitFor(() => {
      expect(screen.getByText('Preserved summary')).toBeVisible();
      expect(screen.queryByText('Wymagany klucz API')).not.toBeInTheDocument();
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

      renderApp();
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

      renderApp();
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

      renderApp();
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

      renderApp();
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

      renderApp();
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

      renderApp();
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

      renderApp();
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

    test('switches active AI provider in settings and updates API key input accordingly', async () => {
      stored.gemini_api_key = 'gemini-saved-key';
      stored.openai_api_key = 'openai-saved-key';
      stored.claude_api_key = '';

      renderApp();
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      const providerSelect = screen.getByLabelText(
        /Wybierz Dostawcę AI/
      ) as HTMLSelectElement;
      const keyInput = screen.getByPlaceholderText(
        /Wklej swój klucz API/
      ) as HTMLInputElement;

      expect(providerSelect.value).toBe('gemini');
      expect(keyInput.value).toBe('gemini-saved-key');

      fireEvent.change(providerSelect, { target: { value: 'openai' } });
      expect(providerSelect.value).toBe('openai');
      expect(keyInput.value).toBe('openai-saved-key');

      fireEvent.change(providerSelect, { target: { value: 'claude' } });
      expect(providerSelect.value).toBe('claude');
      expect(keyInput.value).toBe('');
    });

    test('toggles API key input visibility between password and text', async () => {
      renderApp();
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      const keyInput = screen.getByPlaceholderText(
        /Wklej swój klucz API/
      ) as HTMLInputElement;
      expect(keyInput.type).toBe('password');

      const toggleBtn = screen.getByRole('button', { name: 'Pokaż klucz API' });
      fireEvent.click(toggleBtn);

      expect(keyInput.type).toBe('text');
      expect(
        screen.getByRole('button', { name: 'Ukryj klucz API' })
      ).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'Ukryj klucz API' }));
      expect(keyInput.type).toBe('password');
      expect(
        screen.getByRole('button', { name: 'Pokaż klucz API' })
      ).toBeVisible();
    });

    test('displays error message when saving invalid API key and does not persist key or change model', async () => {
      stored.gemini_api_key = '';
      stored.summarizer_settings = {
        language: 'Polski',
        model: 'gemini-3.6-flash',
      };

      global.fetch = vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid token' },
        }),
      })) as unknown as typeof fetch;

      renderApp();
      await waitFor(() =>
        expect(screen.getByText('Wymagany klucz API')).toBeVisible()
      );

      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'invalid-key' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Klucz API został odrzucony. Sprawdź jego poprawność.'
          )
        ).toBeVisible();
      });

      expect(stored.gemini_api_key).toBe('');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gemini-3.6-flash',
      });
    });

    test('disables save button when API key input is empty or whitespace', async () => {
      stored.gemini_api_key = '';

      renderApp();
      await waitFor(() =>
        expect(screen.getByText('Wymagany klucz API')).toBeVisible()
      );

      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      const saveBtn = screen.getByRole('button', { name: 'Zapisz' });
      expect(saveBtn).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: '   ' },
      });
      expect(saveBtn).toBeDisabled();

      fireEvent.change(screen.getByPlaceholderText(/Wklej swój klucz API/), {
        target: { value: 'some-key' },
      });
      expect(saveBtn).not.toBeDisabled();
    });
  });

  describe('analysis history user flows through panel behavior (Issue #61)', () => {
    test('loads analysis history on mount and displays stored sessions in History tab', async () => {
      stored.summarizer_history = [
        {
          videoId: 'movie',
          title: 'Movie Title 1',
          author: 'Creator 1',
          thumbnailUrl: 'https://example.com/1.jpg',
          summary: 'Summary 1',
          transcript: [{ start: 0, duration: 2, text: 'T1' }],
          chat: [],
          createdAt: 1000,
        },
        {
          videoId: 'other-movie',
          title: 'Movie Title 2',
          author: 'Creator 2',
          thumbnailUrl: 'https://example.com/2.jpg',
          summary: 'Summary 2',
          transcript: [],
          chat: [],
          createdAt: 2000,
        },
      ];

      renderApp();
      await waitFor(() =>
        expect(screen.getByText('Movie Title 1')).toBeVisible()
      );

      fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
      await waitFor(() => {
        expect(screen.getByText('Zapisane Sesje (2)')).toBeVisible();
        expect(screen.getByText('Movie Title 1')).toBeVisible();
        expect(screen.getByText('Movie Title 2')).toBeVisible();
      });
    });

    test('deletes current video record from history, cleans up active analysis session, and preserves other records', async () => {
      vi.spyOn(window, 'confirm').mockImplementation(() => true);

      stored.summarizer_history = [
        {
          videoId: 'movie',
          title: 'Active Movie',
          author: 'Creator Active',
          thumbnailUrl: 'thumb-active',
          summary: 'Summary of active movie',
          transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
          chat: [],
          createdAt: 1000,
        },
        {
          videoId: 'other-movie',
          title: 'Other Movie',
          author: 'Creator Other',
          thumbnailUrl: 'thumb-other',
          summary: 'Summary of other movie',
          transcript: [],
          chat: [],
          createdAt: 2000,
        },
      ];

      renderApp();
      await waitFor(() =>
        expect(screen.getByText('Active Movie')).toBeVisible()
      );
      expect(screen.getByText('Summary of active movie')).toBeVisible();

      // Switch to History tab
      fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
      await waitFor(() =>
        expect(screen.getByText('Zapisane Sesje (2)')).toBeVisible()
      );

      // Find delete button specifically within the Active Movie card
      const activeCard = screen
        .getByText('Active Movie')
        .closest('[role="button"]')!;
      const deleteActiveBtn = within(activeCard as HTMLElement).getByRole(
        'button',
        {
          name: 'Usuń z historii',
        }
      );
      fireEvent.click(deleteActiveBtn);

      await waitFor(() => {
        expect(screen.queryByText('Active Movie')).not.toBeInTheDocument();
        expect(screen.getByText('Other Movie')).toBeVisible();
        expect(screen.getByText('Zapisane Sesje (1)')).toBeVisible();
      });

      expect(stored.summarizer_history).toEqual([
        expect.objectContaining({ videoId: 'other-movie' }),
      ]);

      // Switch back to analyze tab - active session must be cleared
      fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
      await waitFor(() => {
        expect(
          screen.queryByText('Summary of active movie')
        ).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generuj/ })).toBeVisible();
      });
    });

    test('deletes non-current video record from history without altering active video analysis session', async () => {
      vi.spyOn(window, 'confirm').mockImplementation(() => true);

      stored.summarizer_history = [
        {
          videoId: 'movie',
          title: 'Active Movie',
          author: 'Creator Active',
          thumbnailUrl: 'thumb-active',
          summary: 'Summary of active movie',
          transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
          chat: [],
          createdAt: 1000,
        },
        {
          videoId: 'other-movie',
          title: 'Other Movie',
          author: 'Creator Other',
          thumbnailUrl: 'thumb-other',
          summary: 'Summary of other movie',
          transcript: [],
          chat: [],
          createdAt: 2000,
        },
      ];

      renderApp();
      await waitFor(() =>
        expect(screen.getByText('Active Movie')).toBeVisible()
      );
      expect(screen.getByText('Summary of active movie')).toBeVisible();

      // Switch to History tab
      fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
      await waitFor(() =>
        expect(screen.getByText('Zapisane Sesje (2)')).toBeVisible()
      );

      // Find delete button specifically within the Other Movie card
      const otherCard = screen
        .getByText('Other Movie')
        .closest('[role="button"]')!;
      const deleteOtherBtn = within(otherCard as HTMLElement).getByRole(
        'button',
        {
          name: 'Usuń z historii',
        }
      );
      fireEvent.click(deleteOtherBtn);

      await waitFor(() => {
        expect(screen.queryByText('Other Movie')).not.toBeInTheDocument();
        expect(screen.getByText('Active Movie')).toBeVisible();
        expect(screen.getByText('Zapisane Sesje (1)')).toBeVisible();
      });

      expect(stored.summarizer_history).toEqual([
        expect.objectContaining({ videoId: 'movie' }),
      ]);

      // Switch back to analyze tab - active session remains intact
      fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
      await waitFor(() => {
        expect(screen.getByText('Summary of active movie')).toBeVisible();
      });
    });

    test('cancels single record deletion when user rejects confirmation in window.confirm', async () => {
      vi.spyOn(window, 'confirm').mockImplementation(() => false);

      stored.summarizer_history = [
        {
          videoId: 'movie',
          title: 'Movie To Keep',
          author: 'Creator',
          thumbnailUrl: 'thumb',
          summary: 'Preserved summary',
          transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
          chat: [],
          createdAt: 1000,
        },
      ];

      renderApp();
      await waitFor(() =>
        expect(screen.getByText('Movie To Keep')).toBeVisible()
      );

      fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
      await waitFor(() =>
        expect(screen.getByText('Zapisane Sesje (1)')).toBeVisible()
      );

      const card = screen
        .getByText('Movie To Keep')
        .closest('[role="button"]')!;
      const deleteBtn = within(card as HTMLElement).getByRole('button', {
        name: 'Usuń z historii',
      });
      fireEvent.click(deleteBtn);

      // Verify record is preserved
      expect(screen.getByText('Movie To Keep')).toBeVisible();
      expect(screen.getByText('Zapisane Sesje (1)')).toBeVisible();
      expect(stored.summarizer_history).toHaveLength(1);

      // Switch back to analyze tab - session still preserved
      fireEvent.click(screen.getByRole('button', { name: 'Analizuj' }));
      await waitFor(() => {
        expect(screen.getByText('Preserved summary')).toBeVisible();
      });
    });

    test('clears entire analysis history from settings tab when confirmed and updates history view to empty state', async () => {
      vi.spyOn(window, 'confirm').mockImplementation(() => true);

      stored.summarizer_history = [
        {
          videoId: 'movie-1',
          title: 'Movie 1',
          author: 'Creator 1',
          thumbnailUrl: 'thumb-1',
          summary: 'Summary 1',
          transcript: [],
          chat: [],
          createdAt: 1000,
        },
        {
          videoId: 'movie-2',
          title: 'Movie 2',
          author: 'Creator 2',
          thumbnailUrl: 'thumb-2',
          summary: 'Summary 2',
          transcript: [],
          chat: [],
          createdAt: 2000,
        },
      ];

      renderApp();
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open Settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      const clearHistoryBtn = screen.getByRole('button', {
        name: 'Wyczyść całą historię',
      });
      expect(clearHistoryBtn).not.toBeDisabled();

      fireEvent.click(clearHistoryBtn);

      await waitFor(() => {
        expect(stored.summarizer_history).toEqual([]);
        expect(clearHistoryBtn).toBeDisabled();
      });

      // Switch to History tab and assert empty state is rendered
      fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
      await waitFor(() => {
        expect(screen.getByText('Zapisane Sesje (0)')).toBeVisible();
        expect(
          screen.getByText(/Brak wcześniejszych podsumowań/)
        ).toBeVisible();
      });
    });

    test('cancels clearing entire analysis history from settings tab when user rejects confirmation', async () => {
      vi.spyOn(window, 'confirm').mockImplementation(() => false);

      stored.summarizer_history = [
        {
          videoId: 'movie-1',
          title: 'Movie 1',
          author: 'Creator 1',
          thumbnailUrl: 'thumb-1',
          summary: 'Summary 1',
          transcript: [],
          chat: [],
          createdAt: 1000,
        },
        {
          videoId: 'movie-2',
          title: 'Movie 2',
          author: 'Creator 2',
          thumbnailUrl: 'thumb-2',
          summary: 'Summary 2',
          transcript: [],
          chat: [],
          createdAt: 2000,
        },
      ];

      renderApp();
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      // Open Settings tab
      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      const clearHistoryBtn = screen.getByRole('button', {
        name: 'Wyczyść całą historię',
      });
      expect(clearHistoryBtn).not.toBeDisabled();

      fireEvent.click(clearHistoryBtn);

      // Verify records are unchanged and button remains enabled
      expect(stored.summarizer_history).toHaveLength(2);
      expect(clearHistoryBtn).not.toBeDisabled();

      // Switch to History tab and assert records are still visible
      fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
      await waitFor(() => {
        expect(screen.getByText('Zapisane Sesje (2)')).toBeVisible();
      });
    });
  });
});
