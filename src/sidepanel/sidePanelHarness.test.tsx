/* @vitest-environment jsdom */

import {
  act,
  render,
  RenderResult,
  cleanup as rtlCleanup,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isPanelNotification,
  TranscriptResponse,
  VideoDataResponse,
} from '../messaging';
import { createChromeStorageLocalAdapter } from '../storage';
import { StorageAdapter } from '../storage/types';
import {
  createSidePanelDependencies,
  SidePanelDependencies,
} from './dependencies';
import {
  ControlledPanelRuntime,
  createControlledPanelRuntime,
  PanelRuntime,
  SidePanelContext,
} from './runtime';
import SidePanelApp from './SidePanelApp';
import { YoutubeAdapter } from './youtube/types';

export interface ControlledStorage {
  data: Record<string, unknown>;
  adapter: StorageAdapter;
  get: <T = unknown>(key: string) => T | undefined;
  set: (key: string, value: unknown) => void;
  assign: (values: Record<string, unknown>) => void;
}

export type VideoData = VideoDataResponse | { error: string };

export type TranscriptResult = TranscriptResponse | { error: string };

export interface ControlledYoutube {
  activeTab: Partial<chrome.tabs.Tab>;
  videoData: VideoData;
  transcript: TranscriptResult;
  seekCalls: Array<{ tabId: number; timestampSeconds: number }>;
  adapter: YoutubeAdapter;
  setActiveTab: (tab: Partial<chrome.tabs.Tab>) => void;
  setVideoData: (data: VideoData) => void;
  setTranscript: (transcript: TranscriptResult) => void;
}

export interface ControlledAi {
  fetchMock: ReturnType<typeof vi.fn>;
  setResponse: (response: unknown, status?: number) => void;
  setError: (errorMessage: string, status?: number) => void;
  setPending: () => {
    resolve: (response: unknown) => void;
    reject: (error: unknown) => void;
  };
}

export interface SidePanelHarnessOptions {
  storage?: StorageAdapter;
  youtubeAdapter?: YoutubeAdapter;
  customFetch?: typeof fetch;
  dependencies?: Partial<SidePanelDependencies>;
  initialStorage?: Record<string, unknown>;
  initialTab?: Partial<chrome.tabs.Tab>;
  initialVideoData?: VideoData;
  initialTranscript?: TranscriptResult;
  isPinnedGlobal?: boolean;
  panelContext?: SidePanelContext | null;
  runtime?: ControlledPanelRuntime | PanelRuntime;
}

export interface SidePanelHarness {
  storage: ControlledStorage;
  youtube: ControlledYoutube;
  ai: ControlledAi;
  runtime: ControlledPanelRuntime;
  dependencies: SidePanelDependencies;
  runtimeExtensionPoint: unknown;
  isPinnedGlobal: boolean;
  setPinnedGlobal: (isPinned: boolean) => void;
  render: (customDeps?: Partial<SidePanelDependencies>) => RenderResult;
  emitYoutubeUrlUpdated: (notification?: {
    type?: 'YOUTUBE_URL_UPDATED';
    tabId?: number;
    url?: string;
  }) => Promise<void>;
  emitTabUpdated: (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo
  ) => Promise<void>;
  runtimeListener?: (message: unknown) => boolean | void;
  tabUpdatedListener?: (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo
  ) => void;
  cleanup: () => void;
}

const DEFAULT_INITIAL_STORAGE: Record<string, unknown> = {
  gemini_api_key: 'key',
  summarizer_settings: { language: 'Polski', model: 'gemini-3.6-flash' },
  summarizer_history: [],
  ui_theme: 'night',
};

const DEFAULT_ACTIVE_TAB: Partial<chrome.tabs.Tab> = {
  id: 3,
  windowId: 4,
  url: 'https://www.youtube.com/watch?v=movie',
  title: 'Movie from tab',
};

const DEFAULT_VIDEO_DATA: VideoData = {
  success: true,
  videoId: 'movie',
  title: 'Movie',
  author: 'Creator',
  thumbnailUrl: 'thumbnail',
};

const DEFAULT_TRANSCRIPT: TranscriptResult = {
  success: true,
  transcript: [{ start: 0, duration: 2, text: 'Transcript' }],
};

export function createSidePanelHarness(
  options: SidePanelHarnessOptions = {}
): SidePanelHarness {
  const originalChrome = global.chrome;
  const originalFetch = global.fetch;
  const originalMatchMedia = window.matchMedia;

  // 1. Reset DOM attributes and styles
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.className = '';
  document.body.className = '';

  // 2. Controlled in-memory storage
  const storageData: Record<string, unknown> = {
    ...DEFAULT_INITIAL_STORAGE,
    ...options.initialStorage,
  };

  // 3. Controlled YouTube
  let currentActiveTab: Partial<chrome.tabs.Tab> = {
    ...DEFAULT_ACTIVE_TAB,
    ...options.initialTab,
  };
  let currentVideoData: VideoData =
    options.initialVideoData ?? DEFAULT_VIDEO_DATA;
  let currentTranscript: TranscriptResult =
    options.initialTranscript ?? DEFAULT_TRANSCRIPT;
  const seekCalls: Array<{ tabId: number; timestampSeconds: number }> = [];

  const youtube: ControlledYoutube = {
    get activeTab() {
      return currentActiveTab;
    },
    set activeTab(tab) {
      currentActiveTab = tab;
    },
    get videoData() {
      return currentVideoData;
    },
    set videoData(data) {
      currentVideoData = data;
    },
    get transcript() {
      return currentTranscript;
    },
    set transcript(tr) {
      currentTranscript = tr;
    },
    seekCalls,
    get adapter(): YoutubeAdapter {
      if (options.youtubeAdapter) return options.youtubeAdapter;
      return {
        getActiveTab: async () => {
          const [tab] = await global.chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          return tab;
        },
        getVideoData: async (tabId: number) =>
          global.chrome.tabs.sendMessage(tabId, { type: 'GET_VIDEO_DATA' }),
        getTranscript: async (
          tabId: number,
          videoId: string,
          targetLang: string
        ) =>
          global.chrome.tabs.sendMessage(tabId, {
            type: 'GET_TRANSCRIPT',
            videoId,
            targetLang,
          }),
        seekTo: async (tabId: number, seconds: number) =>
          global.chrome.tabs.sendMessage(tabId, { type: 'SEEK_TO', seconds }),
      };
    },
    setActiveTab: (tab: Partial<chrome.tabs.Tab>) => {
      currentActiveTab = tab;
    },
    setVideoData: (data: VideoData) => {
      currentVideoData = data;
    },
    setTranscript: (tr: TranscriptResult) => {
      currentTranscript = tr;
    },
  };

  // 4. Controlled AI & Fetch
  let fetchResponseProvider = async (): Promise<{
    ok: boolean;
    status?: number;
    json: () => Promise<unknown>;
  }> => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: 'AI response' }] } }],
      content: [{ type: 'text', text: 'AI response' }],
      choices: [{ message: { content: 'AI response' } }],
    }),
  });

  const fetchMock = vi.fn(async (...args: unknown[]) => {
    if (options.customFetch) {
      return (options.customFetch as (...a: unknown[]) => Promise<Response>)(
        ...args
      );
    }
    return fetchResponseProvider();
  });

  global.fetch = fetchMock as unknown as typeof fetch;

  const ai: ControlledAi = {
    fetchMock,
    setResponse: (response: unknown, status = 200) => {
      fetchResponseProvider = async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => response,
      });
    },
    setError: (errorMessage: string, status = 400) => {
      fetchResponseProvider = async () => ({
        ok: false,
        status,
        json: async () => ({
          error: { message: errorMessage },
        }),
      });
    },
    setPending: () => {
      let resolvePromise: (val: unknown) => void;
      let rejectPromise: (err: unknown) => void;
      const promise = new Promise((res, rej) => {
        resolvePromise = res;
        rejectPromise = rej;
      });
      fetchResponseProvider = () =>
        promise as Promise<{
          ok: boolean;
          status?: number;
          json: () => Promise<unknown>;
        }>;
      return {
        resolve: (response: unknown) => {
          resolvePromise!({
            ok: true,
            status: 200,
            json: async () => response,
          });
        },
        reject: (err: unknown) => {
          rejectPromise!(err);
        },
      };
    },
  };

  // 5. MatchMedia mock
  window.matchMedia = vi.fn(() => ({
    matches: true,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  function resolveInitialContext(): SidePanelContext | null {
    if (options.panelContext !== undefined) {
      return options.panelContext;
    }
    if (
      options.initialTab?.id !== undefined &&
      options.initialTab?.windowId !== undefined
    ) {
      return {
        tabId: options.initialTab.id,
        windowId: options.initialTab.windowId,
      };
    }
    return {
      tabId: currentActiveTab.id ?? 3,
      windowId: currentActiveTab.windowId ?? 4,
    };
  }

  // 6. Controlled Runtime
  const controlledRuntime: ControlledPanelRuntime =
    options.runtime && 'setContext' in options.runtime
      ? (options.runtime as ControlledPanelRuntime)
      : createControlledPanelRuntime({
          initialContext: resolveInitialContext(),
          initialPinnedGlobal: options.isPinnedGlobal ?? false,
        });

  // 7. Chrome environment isolation
  type RuntimeListener = (
    message: unknown,
    sender?: chrome.runtime.MessageSender,
    sendResponse?: (response?: unknown) => void
  ) => boolean | void;
  type TabUpdatedListener = (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab?: chrome.tabs.Tab
  ) => void;

  const runtimeListeners = new Set<RuntimeListener>();
  const tabUpdatedListeners = new Set<TabUpdatedListener>();
  let isPinnedGlobalState = options.isPinnedGlobal ?? false;

  global.chrome = {
    ...global.chrome,
    tabs: {
      ...global.chrome?.tabs,
      query: vi.fn(async () => [currentActiveTab]),
      get: vi.fn(async (tabId: number) =>
        tabId === currentActiveTab.id
          ? {
              id: currentActiveTab.id,
              url: currentActiveTab.url,
              title: currentActiveTab.title,
            }
          : undefined
      ),
      sendMessage: vi.fn(async (_tabId, message: { type?: string }) => {
        if (message.type === 'GET_TRANSCRIPT') {
          return currentTranscript;
        }
        if (message.type === 'GET_VIDEO_DATA') {
          return currentVideoData;
        }
        if (
          message.type === 'SEEK_TO' ||
          message.type === 'SEEK_TO_TIMESTAMP'
        ) {
          const timestampSeconds =
            (
              message as unknown as {
                seconds?: number;
                timestampSeconds?: number;
              }
            ).seconds ??
            (
              message as unknown as {
                seconds?: number;
                timestampSeconds?: number;
              }
            ).timestampSeconds ??
            0;
          seekCalls.push({
            tabId: _tabId,
            timestampSeconds,
          });
          return { success: true };
        }
        return { success: true };
      }),
      onUpdated: {
        addListener: vi.fn((listener: TabUpdatedListener) => {
          tabUpdatedListeners.add(listener);
        }),
        removeListener: vi.fn((listener: TabUpdatedListener) => {
          tabUpdatedListeners.delete(listener);
        }),
      },
    },
    storage: {
      ...global.chrome?.storage,
      local: {
        get: vi.fn(
          (
            keys: string[] | string,
            callback: (result: Record<string, unknown>) => void
          ) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            const result = Object.fromEntries(
              keyArray.map((key) => [key, storageData[key]])
            );
            callback(result);
          }
        ),
        set: vi.fn((values: Record<string, unknown>, callback?: () => void) => {
          Object.assign(storageData, values);
          callback?.();
        }),
        remove: vi.fn((keys: string[] | string, callback?: () => void) => {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach((key) => delete storageData[key]);
          callback?.();
        }),
      },
    },
    runtime: {
      ...global.chrome?.runtime,
      sendMessage: vi.fn(async (message: { type?: string }) => {
        if (isPanelNotification(message)) {
          controlledRuntime.emitNotification(message);
          runtimeListeners.forEach((listener) => listener(message));
          return undefined;
        }
        if (message.type === 'PANEL_INIT') {
          return { isPinnedGlobal: isPinnedGlobalState };
        }
        if (message.type === 'PIN_GLOBAL') {
          isPinnedGlobalState = true;
          return { success: true };
        }
        return { success: true };
      }),
      onMessage: {
        addListener: vi.fn((listener: RuntimeListener) => {
          runtimeListeners.add(listener);
        }),
        removeListener: vi.fn((listener: RuntimeListener) => {
          runtimeListeners.delete(listener);
        }),
      },
    },
  } as unknown as typeof chrome;

  // 8. Dependencies creation
  const dependencies: SidePanelDependencies = {
    ...createSidePanelDependencies({
      storage: options.storage,
      youtubeAdapter: options.youtubeAdapter,
      customFetch: options.customFetch,
      runtime:
        options.runtime && 'getContext' in options.runtime
          ? (options.runtime as PanelRuntime)
          : controlledRuntime,
    }),
    ...options.dependencies,
  };

  const storageAdapter =
    options.storage ??
    createChromeStorageLocalAdapter(global.chrome.storage.local);

  const storage: ControlledStorage = {
    data: storageData,
    adapter: storageAdapter,
    get: <T = unknown,>(key: string): T | undefined =>
      storageData[key] as T | undefined,
    set: (key: string, value: unknown) => {
      storageData[key] = value;
    },
    assign: (values: Record<string, unknown>) => {
      Object.assign(storageData, values);
    },
  };

  const harness: SidePanelHarness = {
    storage,
    youtube,
    ai,
    runtime: controlledRuntime,
    dependencies,
    runtimeExtensionPoint: options.runtime ?? controlledRuntime,
    get isPinnedGlobal() {
      return controlledRuntime.isPinnedGlobal;
    },
    setPinnedGlobal: (pinned: boolean) => {
      controlledRuntime.setPinnedGlobal(pinned);
      isPinnedGlobalState = pinned;
    },
    render: (customDeps?: Partial<SidePanelDependencies>) =>
      render(
        <SidePanelApp
          dependencies={{
            ...dependencies,
            ...customDeps,
          }}
        />
      ),
    emitYoutubeUrlUpdated: async (notification) => {
      const message = {
        type: 'YOUTUBE_URL_UPDATED' as const,
        tabId: currentActiveTab.id ?? 3,
        url: currentActiveTab.url ?? 'https://www.youtube.com/watch?v=movie',
        ...notification,
      };
      await act(async () => {
        controlledRuntime.emitNotification(message);
        runtimeListeners.forEach((listener) => {
          listener(message);
        });
      });
    },
    emitTabUpdated: async (tabId, changeInfo) => {
      await act(async () => {
        tabUpdatedListeners.forEach((listener) => {
          listener(tabId, changeInfo);
        });
      });
    },
    get runtimeListener() {
      return (message: unknown) => {
        if (isPanelNotification(message)) {
          controlledRuntime.emitNotification(message);
        }
        let result: boolean | void = false;
        runtimeListeners.forEach((listener) => {
          const res = listener(message);
          if (typeof res === 'boolean') result = res;
        });
        return result;
      };
    },
    get tabUpdatedListener() {
      return Array.from(tabUpdatedListeners)[0];
    },
    cleanup: () => {
      rtlCleanup();
      runtimeListeners.clear();
      tabUpdatedListeners.clear();
      global.chrome = originalChrome;
      global.fetch = originalFetch;
      window.matchMedia = originalMatchMedia;
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.className = '';
      document.body.className = '';
      document.body.innerHTML = '';
    },
  };

  return harness;
}

describe('SidePanel Test Harness (src/sidepanel/sidePanelHarness.test.tsx)', () => {
  let harness: SidePanelHarness;

  afterEach(() => {
    harness?.cleanup();
  });

  it('provides controlled isolated storage, youtube, aiClient, and runtime by default', async () => {
    harness = createSidePanelHarness({
      initialStorage: { custom_test_key: 'custom_value' },
    });

    expect(harness.storage.get('custom_test_key')).toBe('custom_value');
    expect(harness.storage.get('gemini_api_key')).toBe('key');
    expect(harness.youtube.activeTab.url).toBe(
      'https://www.youtube.com/watch?v=movie'
    );
    expect(harness.dependencies).toBeDefined();
    expect(harness.dependencies.preferences).toBeDefined();
    expect(harness.dependencies.history).toBeDefined();
    expect(harness.dependencies.youtube).toBeDefined();
    expect(harness.dependencies.aiClient).toBeDefined();
    expect(harness.dependencies.runtime).toBeDefined();
    expect(harness.runtime).toBeDefined();
    await expect(harness.runtime.getContext()).resolves.toEqual({
      tabId: 3,
      windowId: 4,
    });
  });

  it('allows explicitly passing controlled storage, youtubeAdapter, and customFetch', async () => {
    const customMemory: Record<string, unknown> = {};
    const customStorage: StorageAdapter = {
      read: vi.fn(async (keys: readonly string[]) =>
        Object.fromEntries(keys.map((k) => [k, customMemory[k]]))
      ),
      write: vi.fn(async (vals: Record<string, unknown>) => {
        Object.assign(customMemory, vals);
      }),
    };

    const customYoutubeAdapter: YoutubeAdapter = {
      getActiveTab: vi.fn(async () => ({
        id: 99,
        url: 'https://www.youtube.com/watch?v=custom',
        title: 'Custom Title',
      })),
      getVideoData: vi.fn(async () => ({
        success: true as const,
        videoId: 'custom',
        title: 'Custom Title',
        author: 'Custom Author',
        thumbnailUrl: 'https://example.com/custom.jpg',
      })),
      getTranscript: vi.fn(async () => ({
        success: true as const,
        transcript: [{ start: 0, duration: 1, text: 'Custom Transcript' }],
      })),
      seekTo: vi.fn(async () => ({ success: true as const })),
    };

    const customFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ custom: 'ai response' }),
    })) as unknown as typeof fetch;

    harness = createSidePanelHarness({
      storage: customStorage,
      youtubeAdapter: customYoutubeAdapter,
      customFetch,
    });

    await harness.dependencies.preferences.setApiKey(
      'openai',
      'test-openai-key'
    );
    expect(customStorage.write).toHaveBeenCalled();
    expect(customMemory.openai_api_key).toBe('test-openai-key');

    const film = await harness.dependencies.youtube.readActiveFilm();
    expect(film).not.toBeNull();
    expect(film?.title).toBe('Custom Title');
    expect(customYoutubeAdapter.getActiveTab).toHaveBeenCalled();
  });

  it('isolates state completely between successive harness instances', () => {
    const harnessA = createSidePanelHarness();
    harnessA.storage.set('leaked_key', 'leaked_value');
    expect(harnessA.storage.get('leaked_key')).toBe('leaked_value');
    harnessA.cleanup();

    const harnessB = createSidePanelHarness();
    expect(harnessB.storage.get('leaked_key')).toBeUndefined();
    harnessB.cleanup();
  });

  it('contains prepared extension point for panel runtime and supports custom runtime injection', () => {
    const dummyRuntime = { id: 'mock-runtime-phase-2' };
    harness = createSidePanelHarness({
      runtime: dummyRuntime as unknown as PanelRuntime,
    });

    expect(harness.runtimeExtensionPoint).toBe(dummyRuntime);
  });

  it('provides deterministic control over panel runtime through harness.runtime', async () => {
    harness = createSidePanelHarness({
      panelContext: { tabId: 10, windowId: 20 },
      isPinnedGlobal: true,
    });

    await expect(harness.runtime.getContext()).resolves.toEqual({
      tabId: 10,
      windowId: 20,
    });
    expect(harness.isPinnedGlobal).toBe(true);

    harness.runtime.setContext(null);
    await expect(harness.runtime.getContext()).resolves.toBeNull();

    harness.setPinnedGlobal(false);
    expect(harness.isPinnedGlobal).toBe(false);

    const initResult = await harness.runtime.initialize(10);
    expect(initResult).toEqual({ isPinnedGlobal: false });
    expect(harness.runtime.initCalls).toEqual([10]);
  });

  it('safely cleans up DOM, mock chrome and listeners on cleanup()', async () => {
    harness = createSidePanelHarness();
    harness.render();

    expect(document.querySelector('#my-ext')).not.toBeNull();
    harness.cleanup();
    expect(document.querySelector('#my-ext')).toBeNull();
  });
});
