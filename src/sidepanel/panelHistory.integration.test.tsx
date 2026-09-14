/* @vitest-environment jsdom */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

describe('side panel analysis history scenarios', () => {
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

  describe('single history record deletion and confirmations', () => {
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
  });

  describe('clearing entire analysis history from settings and confirmations', () => {
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
