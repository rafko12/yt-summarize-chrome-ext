/* @vitest-environment jsdom */
/* eslint-disable react/jsx-props-no-spreading */
// cspell:disable

import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AnalyzeView from './AnalyzeView';
import { Header } from './Header';
import HistoryView from './HistoryView';
import SettingsView from './SettingsView';

const callbacks = {
  clear: vi.fn(),
  delete: vi.fn(),
  input: vi.fn(),
  language: vi.fn(),
  load: vi.fn(),
  model: vi.fn(),
  pin: vi.fn(),
  provider: vi.fn(),
  resume: vi.fn(),
  save: vi.fn(),
  selectTab: vi.fn(),
  send: vi.fn((event) => event.preventDefault()),
  setTab: vi.fn(),
  summarize: vi.fn(),
  theme: vi.fn(),
  toggleKey: vi.fn(),
};

const settings = { language: 'Polski', model: 'gemini-3.6-flash' };
const video = {
  videoId: 'abc123',
  title: 'Tytu? filmu',
  author: 'Autor',
  thumbnailUrl: 'https://example.test/thumb.jpg',
};
const historyItem = {
  ...video,
  summary: 'Gotowe',
  transcript: [],
  chat: [],
  createdAt: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chrome.tabs.query).mockResolvedValue([
    { id: 12 } as chrome.tabs.Tab,
  ]);
  vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true });
});

describe('widoki panelu', () => {
  test('nag??wek prze??cza zak?adki oraz udost?pnia przypi?cie i zmian? motywu', () => {
    const { rerender } = render(
      <Header
        activeTab='analyze'
        theme='night'
        isPinned={false}
        onSelectTab={callbacks.selectTab}
        onPin={callbacks.pin}
        onToggleTheme={callbacks.theme}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
    fireEvent.click(screen.getByRole('button', { name: /Przypnij/ }));
    fireEvent.click(screen.getByRole('button', { name: /Zmie/ }));
    expect(callbacks.selectTab).toHaveBeenCalledWith('history');
    expect(callbacks.pin).toHaveBeenCalledOnce();
    expect(callbacks.theme).toHaveBeenCalledOnce();

    rerender(
      <Header
        activeTab='settings'
        theme='nord'
        isPinned
        onSelectTab={callbacks.selectTab}
        onPin={callbacks.pin}
        onToggleTheme={callbacks.theme}
      />
    );
    expect(
      screen.queryByRole('button', { name: /Przypnij/ })
    ).not.toBeInTheDocument();
  });

  test('historia pokazuje pusty stan, a zapis mo?na otworzy? lub usun??', () => {
    const { rerender } = render(
      <HistoryView
        historyList={[]}
        onResumeSession={callbacks.resume}
        onDeleteHistory={callbacks.delete}
      />
    );
    expect(screen.getByText(/Brak/)).toBeVisible();

    rerender(
      <HistoryView
        historyList={[historyItem]}
        onResumeSession={callbacks.resume}
        onDeleteHistory={callbacks.delete}
      />
    );
    const record = screen.getByRole('button', { name: /Thumbnail/ });
    fireEvent.click(record);
    fireEvent.keyDown(record, { key: 'Enter' });
    fireEvent.keyDown(record, { key: ' ' });
    fireEvent.click(screen.getByRole('button', { name: /Usu/ }));
    fireEvent.error(screen.getByAltText('Thumbnail'));

    expect(callbacks.resume).toHaveBeenCalledTimes(4);
    expect(callbacks.resume).toHaveBeenLastCalledWith(historyItem);
    expect(callbacks.delete).toHaveBeenCalledWith(expect.anything(), 'abc123');
    expect(screen.getByAltText('Thumbnail')).toHaveAttribute(
      'src',
      'https://www.youtube.com/img/desktop/yt_1200.png'
    );
  });

  test('ustawienia obs?uguj? dostawc?, klucz, preferencje i akcje czyszczenia', () => {
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

  test('ekran ustawie? blokuje opcje zale?ne od klucza i pracy w toku', () => {
    render(
      <SettingsView
        selectedProvider='claude'
        apiKeys={{ gemini: '', openai: '', claude: '' }}
        apiKeyInput=''
        showKey
        isCheckingKey
        keyValidationMsg={{ text: 'B??d', success: false }}
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
    expect(screen.getAllByText(/B/)[0]).toBeVisible();
  });

  test('analiza udost?pnia stany braku klucza, wyszukiwania, filmu, czatu i podsumowania', () => {
    const props = {
      hasAnyKey: false,
      isSearchingVideo: false,
      currentVideo: null,
      isLoading: false,
      loadingMessage: '',
      summary: null,
      chatMessages: [],
      isSendingChat: false,
      chatInput: '',
      settings,
      chatListRef: createRef<HTMLDivElement>(),
      onLoadActiveVideo: callbacks.load,
      onClearChat: callbacks.clear,
      onSendChatMessage: callbacks.send,
      onChatInputChange: callbacks.input,
      onSummarizeVideo: callbacks.summarize,
      onSetActiveTab: callbacks.setTab,
    };
    const { rerender } = render(<AnalyzeView {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Skonfiguruj teraz/ }));
    expect(callbacks.setTab).toHaveBeenCalledWith('settings');

    rerender(<AnalyzeView {...props} hasAnyKey isSearchingVideo />);
    expect(screen.getByText(/Szukanie aktywnego/)).toBeVisible();

    rerender(<AnalyzeView {...props} hasAnyKey />);
    fireEvent.click(screen.getByRole('button', { name: /Od/ }));
    expect(callbacks.load).toHaveBeenCalledOnce();

    rerender(
      <AnalyzeView
        {...props}
        hasAnyKey
        currentVideo={video}
        chatMessages={[{ role: 'user', message: 'Pytanie [01:30]' }]}
        chatInput='Wiadomo??'
        summary='To jest długie podsumowanie [00:45]'
      />
    );
    fireEvent.error(screen.getByAltText('Thumbnail'));
    fireEvent.click(screen.getByRole('button', { name: /Wyczy??/ }));
    fireEvent.change(screen.getByPlaceholderText(/Zadaj pytanie/), {
      target: { value: 'Inne pytanie' },
    });
    fireEvent.submit(
      screen.getByPlaceholderText(/Zadaj pytanie/).closest('form')!
    );
    fireEvent.click(screen.getByRole('button', { name: '00:45' }));

    expect(callbacks.clear).toHaveBeenCalled();
    expect(callbacks.input).toHaveBeenCalledWith('Inne pytanie');
    expect(callbacks.send).toHaveBeenCalled();

    const scrollContainer = screen
      .getByText(video.title)
      .closest('.overflow-y-auto');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer).toHaveClass('flex', 'flex-col', 'gap-3');

    rerender(
      <AnalyzeView
        {...props}
        hasAnyKey
        currentVideo={video}
        isLoading
        loadingMessage='Generowanie'
      />
    );
    expect(screen.getByText('Generowanie')).toBeVisible();
  });
});
