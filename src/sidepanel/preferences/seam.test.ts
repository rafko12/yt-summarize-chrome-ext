import { describe, expect, it } from 'vitest';

import defaultCreateUserPreferences, {
  createChromePreferencesAdapter,
  createChromePreferencesPlatform,
  createUserPreferences,
  DEFAULT_SETTINGS,
  SettingsView,
  useSettings,
} from './index';

describe('Preferences Module public seam (src/sidepanel/preferences)', () => {
  it('exposes createUserPreferences factory and default export', () => {
    expect(createUserPreferences).toBeDefined();
    expect(typeof createUserPreferences).toBe('function');
    expect(defaultCreateUserPreferences).toBe(createUserPreferences);
  });

  it('exposes Chrome preferences adapter factory and alias', () => {
    expect(createChromePreferencesAdapter).toBeDefined();
    expect(typeof createChromePreferencesAdapter).toBe('function');
    expect(createChromePreferencesPlatform).toBe(
      createChromePreferencesAdapter
    );
  });

  it('exposes useSettings hook', () => {
    expect(useSettings).toBeDefined();
    expect(typeof useSettings).toBe('function');
  });

  it('exposes SettingsView component', () => {
    expect(SettingsView).toBeDefined();
    expect(typeof SettingsView).toBe('function');
  });

  it('exposes DEFAULT_SETTINGS constant', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(DEFAULT_SETTINGS).toEqual({
      language: 'Polski',
      model: 'gemini-3.5-flash',
    });
  });
});
