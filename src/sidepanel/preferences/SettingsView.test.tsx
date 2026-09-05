/* @vitest-environment jsdom */
// cspell:disable
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import SettingsView from './SettingsView';

const callbacks = {
  clear: vi.fn(),
  delete: vi.fn(),
  input: vi.fn(),
  language: vi.fn(),
  model: vi.fn(),
  provider: vi.fn(),
  save: vi.fn(),
  toggleKey: vi.fn(),
};

const settings = { language: 'Polski', model: 'gemini-3.6-flash' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SettingsView (src/sidepanel/preferences)', () => {
  test('ustawienia obsługują dostawcę, klucz, preferencje i akcje czyszczenia', () => {
    render(
      <SettingsView
        selectedProvider='gemini'
        apiKeys={{ gemini: 'abcdefghijk', openai: 'openai-key', claude: '' }}
        apiKeyInput='  nowy-klucz  '
        showKey={false}
        isCheckingKey={false}
        keyValidationMsg={{ text: 'Zapisano', success: true }}
        settings={settings}
        hasAnyKey
        historyListLength={2}
        onSelectProvider={callbacks.provider}
        onApiKeyInputChange={callbacks.input}
        onToggleShowKey={callbacks.toggleKey}
        onSaveApiKey={callbacks.save}
        onDeleteApiKey={callbacks.delete}
        onModelChange={callbacks.model}
        onLanguageChange={callbacks.language}
        onClearHistory={callbacks.clear}
        onClearApiKeysAndHistory={callbacks.clear}
      />
    );

    fireEvent.change(screen.getByLabelText(/Wybierz/), {
      target: { value: 'openai' },
    });
    fireEvent.change(screen.getByLabelText(/Klucz/), {
      target: { value: 'zmieniony' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Pokaż klucz API/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    fireEvent.change(screen.getByRole('combobox', { name: /Model/ }), {
      target: { value: 'gpt-5.6-luna' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /J/ }), {
      target: { value: 'English' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Usu.*gemini/ }));
    fireEvent.click(screen.getByRole('button', { name: /Wyczy/ }));
    fireEvent.click(screen.getByRole('button', { name: /Usu.*wszystkie/ }));

    expect(callbacks.provider).toHaveBeenCalledWith('openai');
    expect(callbacks.input).toHaveBeenCalledWith('zmieniony');
    expect(callbacks.save).toHaveBeenCalledOnce();
    expect(callbacks.model).toHaveBeenCalledWith('gpt-5.6-luna');
    expect(callbacks.language).toHaveBeenCalledWith('English');
    expect(callbacks.delete).toHaveBeenCalledWith('gemini');
    expect(callbacks.clear).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Zapisano')).toBeVisible();
  });

  test('ekran ustawień udostępnia modele wszystkich skonfigurowanych dostawców', () => {
    render(
      <SettingsView
        selectedProvider='gemini'
        apiKeys={{
          gemini: 'gemini-key',
          openai: 'openai-key',
          claude: 'claude-key',
        }}
        apiKeyInput=''
        showKey={false}
        isCheckingKey={false}
        keyValidationMsg={null}
        settings={settings}
        hasAnyKey
        historyListLength={0}
        onSelectProvider={callbacks.provider}
        onApiKeyInputChange={callbacks.input}
        onToggleShowKey={callbacks.toggleKey}
        onSaveApiKey={callbacks.save}
        onDeleteApiKey={callbacks.delete}
        onModelChange={callbacks.model}
        onLanguageChange={callbacks.language}
        onClearHistory={callbacks.clear}
        onClearApiKeysAndHistory={callbacks.clear}
      />
    );

    const modelSelect = screen.getByRole('combobox', { name: /Model/ });
    expect(
      Array.from(
        (modelSelect as HTMLSelectElement).options,
        (option) => option.value
      )
    ).toEqual([
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro',
      'gpt-5.6-luna',
      'gpt-5.6-terra',
      'claude-sonnet-5',
      'claude-opus-5',
      'claude-haiku-4-5',
    ]);
  });

  test('ekran ustawień blokuje opcje zależne od klucza i pracy w toku', () => {
    render(
      <SettingsView
        selectedProvider='claude'
        apiKeys={{ gemini: '', openai: '', claude: '' }}
        apiKeyInput=''
        showKey
        isCheckingKey
        keyValidationMsg={{ text: 'Błąd', success: false }}
        settings={settings}
        hasAnyKey={false}
        historyListLength={0}
        onSelectProvider={callbacks.provider}
        onApiKeyInputChange={callbacks.input}
        onToggleShowKey={callbacks.toggleKey}
        onSaveApiKey={callbacks.save}
        onDeleteApiKey={callbacks.delete}
        onModelChange={callbacks.model}
        onLanguageChange={callbacks.language}
        onClearHistory={callbacks.clear}
        onClearApiKeysAndHistory={callbacks.clear}
      />
    );

    expect(screen.getByText(/Dodaj/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Wyczy/ })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Usu.*wszystkie/ })
    ).toBeDisabled();
    expect(screen.getByText('Błąd')).toBeVisible();
  });
});
