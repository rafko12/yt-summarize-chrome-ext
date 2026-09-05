/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import createGeistFontStyles from '../../assets/geistFonts';
import createShadowRoot from '../../utils/createShadowRoot';
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

describe('rendering helpers', () => {
  test('builds font declarations through the supplied URL resolver', () => {
    const resolveUrl = vi.fn((url: string) =>
      new URL(url, 'chrome-extension://id/').toString()
    );
    const styles = createGeistFontStyles(resolveUrl);

    expect(resolveUrl).toHaveBeenCalledTimes(5);
    expect(styles).toContain("font-family: 'Geist Sans'");
    expect(styles).toContain('font-weight: 800');
    expect(styles).toContain('chrome-extension://id/');
  });

  test('creates an interactive extension mount with style fallback', () => {
    window.history.replaceState({}, '', '/');
    const root = createShadowRoot('.app { color: red; }');
    const host = document.body.lastElementChild as HTMLDivElement;
    const shadow = host.shadowRoot!;
    const mount = shadow.firstElementChild as HTMLDivElement;

    expect(host.style.pointerEvents).toBe('none');
    expect(mount.style.pointerEvents).toBe('none');
    expect(shadow.querySelector('style')?.textContent).toContain('.app');
    expect(shadow.querySelector('style')?.textContent).toContain('@font-face');
    root.unmount();
  });

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
