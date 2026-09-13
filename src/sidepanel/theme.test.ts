import { describe, expect, it } from 'vitest';

import { PANEL_THEMES, PanelTheme } from './theme';

describe('PanelTheme contract (src/sidepanel/theme)', () => {
  it('defines the canonical panel themes night and nord', () => {
    expect(PANEL_THEMES).toEqual(['night', 'nord']);
    const nightTheme: PanelTheme = 'night';
    const nordTheme: PanelTheme = 'nord';
    expect(PANEL_THEMES).toContain(nightTheme);
    expect(PANEL_THEMES).toContain(nordTheme);
  });
});
