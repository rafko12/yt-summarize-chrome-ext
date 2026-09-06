/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { MarkdownLine, SummaryMarkdown } from './MarkdownWithTimestamps';
import SummaryView from './SummaryView';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('MarkdownWithTimestamps', () => {
  test('renders all Markdown forms and calls onSeek callback from a timestamp', () => {
    const onSeek = vi.fn();

    render(
      <>
        <SummaryView
          summary={
            '## Heading\n### Detail\n- Bullet\n* Star\n1. Number\n\nText **bold** [00:12]'
          }
          onSeek={onSeek}
        />
        <MarkdownLine text='Plain [01:45]' onSeek={onSeek} />
        <SummaryMarkdown markdown='   ' />
      </>
    );

    expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Detail' })).toBeVisible();
    expect(screen.getByText('bold').tagName).toBe('STRONG');

    fireEvent.click(screen.getByRole('button', { name: '00:12' }));
    expect(onSeek).toHaveBeenCalledWith(12);

    fireEvent.click(screen.getByRole('button', { name: '01:45' }));
    expect(onSeek).toHaveBeenCalledWith(105);
  });

  test('handles timestamp click safely when onSeek callback is not provided', () => {
    render(<MarkdownLine text='No callback [00:01]' />);
    const tsButton = screen.getByRole('button', { name: '00:01' });

    expect(() => fireEvent.click(tsButton)).not.toThrow();
  });
});
