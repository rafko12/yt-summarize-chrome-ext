/* @vitest-environment jsdom */

import { beforeEach, describe, expect, test, vi } from 'vitest';

import createGeistFontStyles, { loadGeistFonts } from './loadGeistFonts';

describe('loadGeistFonts', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

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

  test('builds font declarations directly with default URL resolver without requiring Chrome adapter', () => {
    const styles = createGeistFontStyles();

    expect(styles).toContain("font-family: 'Geist Sans'");
    expect(styles).toContain('font-weight: 400');
    expect(styles).toContain('font-weight: 500');
    expect(styles).toContain('font-weight: 600');
    expect(styles).toContain('font-weight: 700');
    expect(styles).toContain('font-weight: 800');
    expect(styles).toContain("format('woff2')");
    expect(styles).not.toContain('chrome-extension://');
  });

  test('loads font styles directly into extension document head without duplicating', () => {
    const firstCall = loadGeistFonts(document);
    expect(firstCall).toBeInstanceOf(HTMLStyleElement);
    expect(firstCall.getAttribute('data-font')).toBe('geist-sans');
    expect(firstCall.textContent).toContain("font-family: 'Geist Sans'");
    expect(
      document.head.querySelectorAll('style[data-font="geist-sans"]')
    ).toHaveLength(1);

    const secondCall = loadGeistFonts(document);
    expect(secondCall).toBe(firstCall);
    expect(
      document.head.querySelectorAll('style[data-font="geist-sans"]')
    ).toHaveLength(1);
  });
});
