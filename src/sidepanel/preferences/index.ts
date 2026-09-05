import createChromePreferencesAdapter, {
  createChromePreferencesPlatform,
} from './chromePreferencesAdapter';
import createUserPreferences, { DEFAULT_SETTINGS } from './userPreferences';

export * from './types';
export { default as SettingsView } from './SettingsView';
export { default as useSettings } from './useSettings';
export {
  createChromePreferencesAdapter,
  createChromePreferencesPlatform,
  createUserPreferences,
  DEFAULT_SETTINGS,
};
export default createUserPreferences;
