/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalysisRecord, HistoryView } from './index';

const sampleRecord: AnalysisRecord = {
  videoId: 'v123',
  title: 'Testowy tytuł filmu',
  author: 'Twórca testowy',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  summary: 'Podsumowanie',
  transcript: [{ text: 'napisy', start: 0, duration: 5 }],
  chat: [{ role: 'user', message: 'cześć' }],
  createdAt: 1700000000000,
};

describe('HistoryView (src/sidepanel/history)', () => {
  const onResumeSession = vi.fn();
  const onDeleteHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when history list is empty', () => {
    render(
      <HistoryView
        historyList={[]}
        onResumeSession={onResumeSession}
        onDeleteHistory={onDeleteHistory}
      />
    );

    expect(screen.getByText(/Zapisane Sesje \(0\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/Brak wcześniejszych podsumowań/)
    ).toBeInTheDocument();
  });

  it('renders history records and allows resuming and deleting', () => {
    render(
      <HistoryView
        historyList={[sampleRecord]}
        onResumeSession={onResumeSession}
        onDeleteHistory={onDeleteHistory}
      />
    );

    expect(screen.getByText(/Zapisane Sesje \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Testowy tytuł filmu')).toBeInTheDocument();
    expect(screen.getByText('Twórca testowy')).toBeInTheDocument();

    const recordButton = screen.getByRole('button', { name: /Thumbnail/ });
    fireEvent.click(recordButton);
    expect(onResumeSession).toHaveBeenCalledWith(sampleRecord);

    fireEvent.keyDown(recordButton, { key: 'Enter' });
    expect(onResumeSession).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(recordButton, { key: ' ' });
    expect(onResumeSession).toHaveBeenCalledTimes(3);

    const deleteButton = screen.getByRole('button', { name: /Usuń/ });
    fireEvent.click(deleteButton);
    expect(onDeleteHistory).toHaveBeenCalledWith(expect.anything(), 'v123');

    const thumbnail = screen.getByAltText('Thumbnail');
    fireEvent.error(thumbnail);
    expect((thumbnail as HTMLImageElement).src).toContain(
      'https://www.youtube.com/img/desktop/yt_1200.png'
    );
  });
});
