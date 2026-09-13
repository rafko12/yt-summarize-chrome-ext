/* @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

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

describe('side panel layout and styling scenarios', () => {
  test('renders a single vertical scroll container for long summary and chat conversation with interactive timestamps', async () => {
    const longSummary =
      '## Główne wątki\n- Pierwszy punkt [01:15]\n- Drugi punkt z opisem [04:30]\n### Szczegóły\nKolejne rozwinięcie [10:00]';

    stored.summarizer_history = [
      {
        videoId: 'movie',
        title: 'Długi Film z podsumowaniem i czatem',
        author: 'Twórca',
        thumbnailUrl: 'thumb',
        summary: longSummary,
        transcript: [{ start: 0, duration: 10, text: 'Transkrypcja' }],
        chat: [
          { role: 'user', message: 'Pytanie o treść [01:15]' },
          { role: 'model', message: 'Odpowiedź modelu AI' },
        ],
        createdAt: 1000,
      },
    ];

    renderApp();

    await waitFor(() =>
      expect(
        screen.getByText('Długi Film z podsumowaniem i czatem')
      ).toBeVisible()
    );

    // Verify both chat and summary are visible in the document
    expect(screen.getByText('Pytanie o treść')).toBeVisible();
    expect(screen.getByText('Odpowiedź modelu AI')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Główne wątki' })).toBeVisible();
    expect(screen.getByText(/Pierwszy punkt/)).toBeVisible();

    // Verify there is a single main vertical scroll container in AnalyzeView
    const scrollContainers = document.querySelectorAll('.overflow-y-auto');
    expect(scrollContainers).toHaveLength(1);
    const mainScroll = scrollContainers[0];

    // Ensure both chat messages and summary are contained within this single scroll container
    expect(mainScroll).toContainElement(screen.getByText('Pytanie o treść'));
    expect(mainScroll).toContainElement(screen.getByText(/Pierwszy punkt/));

    // Verify timestamps in summary are interactive
    const tsButton = screen.getByRole('button', { name: '04:30' });
    expect(tsButton).toBeVisible();
    fireEvent.click(tsButton);

    await waitFor(() =>
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
        type: 'SEEK_TO',
        seconds: 270,
      })
    );
  });

  test('toggles theme between night and nord maintaining data-theme attribute and utility classes on document and extension root', async () => {
    renderApp();

    await waitFor(() => expect(screen.getByText('Movie')).toBeVisible());

    const rootElement = document.getElementById('my-ext');
    expect(rootElement).toHaveAttribute('data-theme', 'night');
    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
    expect(document.documentElement.classList.contains('bg-base-100')).toBe(
      true
    );
    expect(
      document.documentElement.classList.contains('text-base-content')
    ).toBe(true);
    expect(document.body.classList.contains('bg-base-100')).toBe(true);
    expect(document.body.classList.contains('text-base-content')).toBe(true);

    // Toggle theme button
    const themeBtn = screen.getByRole('button', { name: 'Zmień motyw' });
    fireEvent.click(themeBtn);

    await waitFor(() => {
      expect(rootElement).toHaveAttribute('data-theme', 'nord');
      expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
      expect(stored.ui_theme).toBe('nord');
    });

    fireEvent.click(themeBtn);

    await waitFor(() => {
      expect(rootElement).toHaveAttribute('data-theme', 'night');
      expect(document.documentElement.getAttribute('data-theme')).toBe('night');
      expect(stored.ui_theme).toBe('night');
    });
  });
});
