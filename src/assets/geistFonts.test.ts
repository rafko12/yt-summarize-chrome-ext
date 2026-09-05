import { describe, expect, test, vi } from 'vitest';

import createGeistFontStyles from './geistFonts';

describe('geistFonts', () => {
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
});
