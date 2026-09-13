import { createChromeStorageLocalAdapter, StorageAdapter } from '../storage';
import { AiClient, createAiClient } from './ai';
import { AnalysisHistory, createAnalysisHistory } from './history';
import { createUserPreferences, UserPreferences } from './preferences';
import { createChromePanelRuntime, PanelRuntime } from './runtime';
import {
  createChromeYoutubeAdapter,
  createYoutube,
  YoutubeAdapter,
  YoutubeIntegration,
} from './youtube';

export interface SidePanelDependencies {
  preferences: UserPreferences;
  history: AnalysisHistory;
  youtube: YoutubeIntegration;
  aiClient: AiClient;
  runtime: PanelRuntime;
}

export interface CreateSidePanelDependenciesOptions {
  storage?: StorageAdapter;
  youtubeAdapter?: YoutubeAdapter;
  customFetch?: typeof fetch;
  runtime?: PanelRuntime;
}

export function createSidePanelDependencies(
  options: CreateSidePanelDependenciesOptions = {}
): SidePanelDependencies {
  const storage = options.storage ?? createChromeStorageLocalAdapter();
  const youtubeAdapter = options.youtubeAdapter ?? createChromeYoutubeAdapter();
  return {
    preferences: createUserPreferences(storage),
    history: createAnalysisHistory(storage),
    youtube: createYoutube(youtubeAdapter),
    aiClient: createAiClient(options.customFetch),
    runtime: options.runtime ?? createChromePanelRuntime(),
  };
}
