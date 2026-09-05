import { createChromeStorageLocalAdapter } from '../../storage';
import { PreferencesPlatform } from './types';

export default function createChromePreferencesAdapter(
  storageLocal?: typeof chrome.storage.local
): PreferencesPlatform {
  return createChromeStorageLocalAdapter(storageLocal);
}

export { createChromePreferencesAdapter as createChromePreferencesPlatform };
