/* @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from '@testing-library/react';
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

describe('side panel settings and API key management scenarios', () => {
  describe('model synchronization with available API keys', () => {
    test('saving first API key synchronizes model to compatible default and displays success message', async () => {
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

      // Verify no model selector exists yet (no keys configured)
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

      fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

      // Wait for success message after sync
      await waitFor(() => {
        expect(
          screen.getByText('Klucz API jest poprawny i został zapisany!')
        ).toBeVisible();
      });

      // Storage state is synchronized with compatible default model
      expect(stored.openai_api_key).toBe('sk-new-openai-key');
      expect(stored.summarizer_settings).toEqual({
        language: 'Polski',
        model: 'gpt-5.6-luna',
      });

      // Selector in settings reflects active model
      const modelSelect = screen.getByRole('combobox', {
        name: /Wybór Modelu API/,
      }) as HTMLSelectElement;
      expect(modelSelect.value).toBe('gpt-5.6-luna');
      expect(Array.from(modelSelect.options).map((opt) => opt.value)).toContain(
        'gpt-5.6-luna'
      );
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

  describe('settings form interactions and validation', () => {
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

    test('updates summary language preference in storage and settings view', async () => {
      renderApp();
      await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

      fireEvent.click(screen.getByRole('button', { name: 'Opcje' }));
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

      fireEvent.change(screen.getByRole('combobox', { name: /J/ }), {
        target: { value: 'English' },
      });

      await waitFor(() => {
        expect(stored.summarizer_settings).toMatchObject({
          language: 'English',
        });
      });
    });
  });

  describe('danger zone actions and confirmation dialogs', () => {
    test('clears all API keys and history when user confirms in settings danger zone', async () => {
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
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

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
      await waitFor(() =>
        expect(screen.getByText(/Konfiguracja Rozszerzenia/)).toBeVisible()
      );

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
        expect(
          screen.queryByText('Wymagany klucz API')
        ).not.toBeInTheDocument();
      });
    });
  });
});
