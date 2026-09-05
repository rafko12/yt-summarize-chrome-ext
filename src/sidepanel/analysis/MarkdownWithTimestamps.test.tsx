/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MarkdownLine, SummaryMarkdown } from './MarkdownWithTimestamps';
import SummaryView from './SummaryView';

const consoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.mocked(chrome.tabs.query).mockResolvedValue([
    { id: 8 } as chrome.tabs.Tab,
  ]);
  vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ success: true });
});

afterEach(() => {
  consoleError.mockClear();
});

describe('MarkdownWithTimestamps', () => {
  test('renders all Markdown forms and seeks active video from a timestamp', async () => {
    render(
      <>
        <SummaryView
          summary={
            '## Heading\n### Detail\n- Bullet\n* Star\n1. Number\n\nText **bold** [00:12]'
          }
        />
        <MarkdownLine text='Plain [99:99]' />
        <SummaryMarkdown markdown='   ' />
      </>
    );

    expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Detail' })).toBeVisible();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    fireEvent.click(screen.getByRole('button', { name: '00:12' }));

    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(8, {
        type: 'SEEK_TO',
        seconds: 12,
      })
    );
  });

  test('does not send a timestamp when there is no active tab and reports send errors', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([]);
    render(<MarkdownLine text='No tab [00:01]' />);
    fireEvent.click(screen.getByRole('button', { name: '00:01' }));
    await Promise.resolve();
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();

    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 8 } as chrome.tabs.Tab,
    ]);
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(
      new Error('send failed')
    );
    fireEvent.click(screen.getByRole('button', { name: '00:01' }));
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
  });
});
