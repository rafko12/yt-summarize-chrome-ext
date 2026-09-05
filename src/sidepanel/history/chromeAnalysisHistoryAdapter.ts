import { AnalysisHistoryPlatform } from './types';

export default function createChromeAnalysisHistoryAdapter(
  storageLocal?: typeof chrome.storage.local
): AnalysisHistoryPlatform {
  const getStorage = () => storageLocal || chrome.storage.local;

  return {
    read(keys: readonly string[]): Promise<Record<string, unknown>> {
      return new Promise((resolve) => {
        getStorage().get([...keys], (result) => {
          resolve(result);
        });
      });
    },
    write(values: Record<string, unknown>): Promise<void> {
      return new Promise((resolve) => {
        getStorage().set(values, () => {
          resolve();
        });
      });
    },
  };
}

export { createChromeAnalysisHistoryAdapter as createChromeAnalysisHistoryPlatform };
