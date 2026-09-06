/* @vitest-environment jsdom */
/* eslint-disable react/jsx-props-no-spreading */
// cspell:disable

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AnalyzeView from './AnalyzeView';

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
  seek: vi.fn(),
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
  title: 'Tytuł filmu',
  author: 'Autor',
  thumbnailUrl: 'https://example.test/thumb.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnalyzeView', () => {
  test('analiza udostępnia stany braku klucza, wyszukiwania, filmu, czatu i podsumowania', () => {
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
      onLoadActiveVideo: callbacks.load,
      onClearChat: callbacks.clear,
      onSendChatMessage: callbacks.send,
      onChatInputChange: callbacks.input,
      onSummarizeVideo: callbacks.summarize,
      onSetActiveTab: callbacks.setTab,
      onSeekTimestamp: callbacks.seek,
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
        chatInput='Wiadomość'
        summary='To jest długie podsumowanie [00:45]'
      />
    );
    fireEvent.error(screen.getByAltText('Thumbnail'));
    fireEvent.click(screen.getByRole('button', { name: /Wyczyść/ }));
    fireEvent.change(screen.getByPlaceholderText(/Zadaj pytanie/), {
      target: { value: 'Inne pytanie' },
    });
    fireEvent.submit(
      screen.getByPlaceholderText(/Zadaj pytanie/).closest('form')!
    );
    fireEvent.click(screen.getByRole('button', { name: '00:45' }));
    expect(callbacks.seek).toHaveBeenCalledWith(45);

    fireEvent.click(screen.getByRole('button', { name: '01:30' }));
    expect(callbacks.seek).toHaveBeenCalledWith(90);

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
