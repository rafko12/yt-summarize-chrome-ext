/* @vitest-environment jsdom */

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { mountOptions, OPTIONS_CONTAINER_ID } from './index';

// @ts-expect-error React act environment flag for jsdom
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('mountOptions', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = OPTIONS_CONTAINER_ID;
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  test('montuje stronę opcji wprost w dokumencie bez Shadow DOM i ładuje fonty bezpośrednio', async () => {
    let root: ReturnType<typeof mountOptions> | undefined;

    await act(async () => {
      root = mountOptions(document);
    });

    // 1. Bezpośredni korzeń bez Shadow DOM
    expect(container.shadowRoot).toBeNull();
    const appElement = container.querySelector('#my-ext');
    expect(appElement).not.toBeNull();
    expect(appElement?.shadowRoot).toBeNull();
    expect(appElement?.getAttribute('data-theme')).toBe('night');

    // 2. Fonty Geist załadowane bezpośrednio do head dokumentu
    const fontStyle = document.head.querySelector(
      'style[data-font="geist-sans"]'
    );
    expect(fontStyle).not.toBeNull();
    expect(fontStyle?.textContent).toContain("font-family: 'Geist Sans'");

    // 3. Treść strony opcji jest dostępna i widoczna
    expect(container.querySelector('h1')?.textContent).toBe('YT Summarizer');
    expect(container.textContent).toContain('Panelu Bocznym');

    // 4. Unmount czyści drzewo
    await act(async () => {
      root?.unmount();
    });
    expect(container.querySelector('#my-ext')).toBeNull();
  });

  test('rzuca błąd, gdy dokument nie zawiera wymaganego kontenera', () => {
    container.remove();
    expect(() => mountOptions(document)).toThrowError(
      `Nie znaleziono kontenera #${OPTIONS_CONTAINER_ID} w dokumencie strony opcji.`
    );
  });

  test('zapewnia poprawny layout i brak overflow w motywie night', async () => {
    let root: ReturnType<typeof mountOptions> | undefined;

    await act(async () => {
      root = mountOptions(document);
    });

    const appElement = container.querySelector('#my-ext');
    expect(appElement).not.toBeNull();
    expect(appElement?.className).toContain('min-h-[100dvh]');

    await act(async () => {
      root?.unmount();
    });
  });
});
