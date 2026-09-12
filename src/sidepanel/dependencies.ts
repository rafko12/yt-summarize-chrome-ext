import { createChromeStorageLocalAdapter, StorageAdapter } from '../storage';
import { AiClient, createAiClient } from './ai';
import { AnalysisHistory, createAnalysisHistory } from './history';
import { createUserPreferences, UserPreferences } from './preferences';
import { createYoutube, YoutubeAdapter, YoutubeIntegration } from './youtube';

export interface SidePanelDependencies {
  preferences: UserPreferences;
  history: AnalysisHistory;
  youtube: YoutubeIntegration;
  aiClient: AiClient;
}

export interface CreateSidePanelDependenciesOptions {
  storage?: StorageAdapter;
  youtubeAdapter?: YoutubeAdapter;
  customFetch?: typeof fetch;
}

export function createSidePanelDependencies(
  options: CreateSidePanelDependenciesOptions = {}
): SidePanelDependencies {
  const storage = options.storage ?? createChromeStorageLocalAdapter();
  return {
    preferences: createUserPreferences(storage),
    history: createAnalysisHistory(storage),
    youtube: createYoutube(options.youtubeAdapter),
    aiClient: createAiClient(options.customFetch),
  };
}
