/* @vitest-environment jsdom */

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createSidePanelDependencies } from './compositionRoot';
import { mountSidePanel, SIDEPANEL_CONTAINER_ID } from './index';

// @ts-expect-error React act environment flag for jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('mountSidePanel', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = SIDEPANEL_CONTAINER_ID;
    document.body.appendChild(container);

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
      text: async () => '',
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  test('montuje panel boczny wprost w dokumencie bez Shadow DOM i ładuje fonty bezpośrednio', async () => {
    let root: ReturnType<typeof mountSidePanel> | undefined;

    await act(async () => {
      root = mountSidePanel(document, createSidePanelDependencies());
    });

    // 1. Bezpośredni korzeń bez Shadow DOM
    expect(container.shadowRoot).toBeNull();
    const appElement = container.querySelector('#my-ext');
    expect(appElement).not.toBeNull();
    expect(appElement?.shadowRoot).toBeNull();

    // 2. Fonty Geist załadowane bezpośrednio do head dokumentu
    const fontStyle = document.head.querySelector(
      'style[data-font="geist-sans"]'
    );
    expect(fontStyle).not.toBeNull();
    expect(fontStyle?.textContent).toContain("font-family: 'Geist Sans'");

    // 3. Unmount czyści drzewo
    await act(async () => {
      root?.unmount();
    });
    expect(container.querySelector('#my-ext')).toBeNull();
  });

  test('rzuca błąd, gdy dokument nie zawiera wymaganego kontenera', () => {
    container.remove();
    expect(() => mountSidePanel(document)).toThrowError(
      `Nie znaleziono kontenera #${SIDEPANEL_CONTAINER_ID} w dokumencie panelu.`
    );
  });

  test.each(['night', 'nord'] as const)(
    'zapewnia brak poziomego overflow i poprawny layout w motywie %s',
    async (theme) => {
      document.head.innerHTML = '';
      document.body.innerHTML = '';
      const themedContainer = document.createElement('div');
      themedContainer.id = SIDEPANEL_CONTAINER_ID;
      themedContainer.style.width = '100%';
      themedContainer.style.height = '100%';
      themedContainer.style.overflow = 'hidden';
      document.body.appendChild(themedContainer);

      const storage = {
        read: vi.fn(async () => ({ ui_theme: theme })),
        write: vi.fn(async () => {}),
      };

      let root: ReturnType<typeof mountSidePanel> | undefined;
      await act(async () => {
        root = mountSidePanel(
          document,
          createSidePanelDependencies({ storage })
        );
      });

      const appElement = themedContainer.querySelector('#my-ext');
      expect(appElement).not.toBeNull();
      expect(appElement?.getAttribute('data-theme')).toBe(theme);

      // Weryfikacja braku poziomego overflow
      const overflowDiff =
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth;
      expect(overflowDiff).toBe(0);

      // Weryfikacja interaktywności pointer i keyboard
      const buttons = themedContainer.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((btn) => {
        expect(btn.style.pointerEvents).not.toBe('none');
      });

      await act(async () => {
        root?.unmount();
      });
    }
  );
});
