export const PANEL_THEMES = ['night', 'nord'] as const;

export type PanelTheme = (typeof PANEL_THEMES)[number];
