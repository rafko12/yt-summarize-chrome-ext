import { createChromeStorageLocalAdapter } from '../../storage';
import { AnalysisHistoryPlatform } from './types';

export default function createChromeAnalysisHistoryAdapter(
  storageLocal?: typeof chrome.storage.local
): AnalysisHistoryPlatform {
  return createChromeStorageLocalAdapter(storageLocal);
}

export { createChromeAnalysisHistoryAdapter as createChromeAnalysisHistoryPlatform };
