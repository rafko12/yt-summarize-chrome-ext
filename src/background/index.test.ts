import { beforeEach, describe, expect, test, vi } from 'vitest';

import { STORAGE_KEYS } from '../utils/storage';

type Listener = (...args: never[]) => unknown;

class FakeChromeEvent<T extends Listener> {
  private readonly listeners = new Set<T>();

  addListener = vi.fn((listener: T) => {
    this.listeners.add(listener);
  });

  removeListener = vi.fn((listener: T) => {
    this.listeners.delete(listener);
  });

  emit(...args: Parameters<T>): ReturnType<T>[] {
    return [...this.listeners].map((listener) =>
      listener(...args)
    ) as ReturnType<T>[];
  }
}

type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

type SidePanelClosedListener = (info: {
  tabId?: number;
  windowId: number;
}) => void;

interface FakeChromeOptions {
  local?: Record<string, unknown>;
  session?: Record<string, unknown>;
  tabs?: chrome.tabs.Tab[];
}

function createTab(id: number, windowId: number): chrome.tabs.Tab {
  return {
    active: true,
    autoDiscardable: true,
    discarded: false,
    groupId: -1,
    highlighted: true,
    id,
    incognito: false,
    index: 0,
    pinned: false,
    selected: true,
    windowId,
  };
}

function pickStorageValues(
  data: Record<string, unknown>,
  keys?: string | string[] | Record<string, unknown> | null
): Record<string, unknown> {
  if (keys === undefined || keys === null) return { ...data };
  if (typeof keys === 'string') return { [keys]: data[keys] };
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, data[key]]));
  }
  return Object.fromEntries(
    Object.entries(keys).map(([key, fallback]) => [key, data[key] ?? fallback])
  );
}

function createStorageArea(data: Record<string, unknown>) {
  return {
    get: vi.fn(
      async (keys?: string | string[] | Record<string, unknown> | null) =>
        pickStorageValues(data, keys)
    ),
    set: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(data, values);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      keysToRemove.forEach((key) => Reflect.deleteProperty(data, key));
    }),
  };
}

function createFakeChrome(options: FakeChromeOptions = {}) {
  const localData = { ...options.local };
  const sessionData = { ...options.session };
  const tabs = options.tabs ?? [
    createTab(1, 10),
    createTab(2, 10),
    createTab(3, 20),
  ];

  const events = {
    actionClicked: new FakeChromeEvent<(tab: chrome.tabs.Tab) => void>(),
    installed: new FakeChromeEvent<() => void>(),
    message: new FakeChromeEvent<RuntimeMessageListener>(),
    panelClosed: new FakeChromeEvent<SidePanelClosedListener>(),
    startup: new FakeChromeEvent<() => void>(),
    tabActivated: new FakeChromeEvent<
      (activeInfo: chrome.tabs.TabActiveInfo) => void
    >(),
    tabCreated: new FakeChromeEvent<(tab: chrome.tabs.Tab) => void>(),
    tabRemoved: new FakeChromeEvent<
      (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void
    >(),
    tabReplaced: new FakeChromeEvent<
      (addedTabId: number, removedTabId: number) => void
    >(),
    tabUpdated: new FakeChromeEvent<
      (
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
        tab: chrome.tabs.Tab
      ) => void
    >(),
  };

  const local = createStorageArea(localData);
  const session = createStorageArea(sessionData);
  const sidePanel = {
    setOptions: vi.fn(async () => undefined),
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    onClosed: events.panelClosed,
  };

  const fakeChrome = {
    action: { onClicked: events.actionClicked },
    runtime: {
      onInstalled: events.installed,
      onStartup: events.startup,
      onMessage: events.message,
      sendMessage: vi.fn(async () => undefined),
    },
    sidePanel,
    storage: { local, session },
    tabs: {
      query: vi.fn(async (queryInfo: chrome.tabs.QueryInfo) =>
        queryInfo.windowId === undefined
          ? tabs
          : tabs.filter((tab) => tab.windowId === queryInfo.windowId)
      ),
      onActivated: events.tabActivated,
      onCreated: events.tabCreated,
      onRemoved: events.tabRemoved,
      onReplaced: events.tabReplaced,
      onUpdated: events.tabUpdated,
    },
  } as unknown as typeof chrome;

  async function sendMessage(message: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const results = events.message.emit(
        message,
        {} as chrome.runtime.MessageSender,
        resolve
      );
      if (!results.includes(true)) {
        reject(new Error('Message was not handled asynchronously'));
      }
    });
  }

  return {
    chrome: fakeChrome,
    events,
    localData,
    sessionData,
    sidePanel,
    sendMessage,
  };
}

async function settlePromises(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function loadBackground(fake: ReturnType<typeof createFakeChrome>) {
  global.chrome = fake.chrome;
  await import('./index');
  await settlePromises();
}

describe('background side panel behavior', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('restores only existing local tabs and the persisted pin state', async () => {
    const fake = createFakeChrome({
      local: { [STORAGE_KEYS.PANEL_PIN_STATE]: true },
      session: { local_open_panel_tab_ids: [1, 999, 'invalid'] },
    });

    await loadBackground(fake);

    await expect(
      fake.sendMessage({ type: 'PANEL_INIT', tabId: 1 })
    ).resolves.toEqual({ isPinnedGlobal: true });
    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([1]);
  });

  test('toggles a local panel and persists its tab id', async () => {
    const fake = createFakeChrome();
    await loadBackground(fake);

    fake.events.actionClicked.emit(createTab(1, 10));
    await settlePromises();

    expect(fake.sidePanel.open).toHaveBeenCalledWith({ tabId: 1 });
    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([1]);

    fake.events.actionClicked.emit(createTab(1, 10));
    await settlePromises();

    expect(fake.sidePanel.close).toHaveBeenCalledWith({ tabId: 1 });
    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([]);
  });

  test('pins globally while preserving local state from other tabs', async () => {
    const fake = createFakeChrome();
    await loadBackground(fake);

    fake.events.actionClicked.emit(createTab(1, 10));
    fake.events.actionClicked.emit(createTab(2, 10));
    await settlePromises();

    await expect(
      fake.sendMessage({ type: 'PIN_GLOBAL', tabId: 1, windowId: 10 })
    ).resolves.toEqual({ success: true });

    expect(fake.sidePanel.open).toHaveBeenCalledWith({ windowId: 10 });
    expect(fake.localData[STORAGE_KEYS.PANEL_PIN_STATE]).toBe(true);
    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([2]);
  });

  test('removes the visited tab local state while globally pinned', async () => {
    const fake = createFakeChrome();
    await loadBackground(fake);

    fake.events.actionClicked.emit(createTab(1, 10));
    fake.events.actionClicked.emit(createTab(2, 10));
    await settlePromises();
    await fake.sendMessage({ type: 'PIN_GLOBAL', tabId: 1, windowId: 10 });

    fake.events.tabActivated.emit({ tabId: 2, windowId: 10 });
    await settlePromises();

    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([]);
  });

  test('closing a global panel clears local state and closes the window panels', async () => {
    const fake = createFakeChrome();
    await loadBackground(fake);

    fake.events.actionClicked.emit(createTab(1, 10));
    fake.events.actionClicked.emit(createTab(3, 20));
    await settlePromises();
    await fake.sendMessage({ type: 'PIN_GLOBAL', tabId: 1, windowId: 10 });

    fake.events.panelClosed.emit({ tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.localData[STORAGE_KEYS.PANEL_PIN_STATE]).toBe(false);
    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([]);
    expect(fake.sidePanel.close).toHaveBeenCalledWith({ tabId: 1 });
    expect(fake.sidePanel.close).toHaveBeenCalledWith({ tabId: 2 });
    expect(fake.sidePanel.close).not.toHaveBeenCalledWith({ tabId: 3 });
  });

  test('rolls back the in-memory and persisted state when global pinning fails', async () => {
    const fake = createFakeChrome();
    await loadBackground(fake);

    fake.events.actionClicked.emit(createTab(1, 10));
    await settlePromises();
    vi.mocked(fake.sidePanel.open).mockRejectedValueOnce(
      new Error('open failed')
    );

    await expect(
      fake.sendMessage({ type: 'PIN_GLOBAL', tabId: 1, windowId: 10 })
    ).resolves.toEqual({ error: 'Nie udało się przypiąć panelu.' });
    await settlePromises();

    expect(fake.localData[STORAGE_KEYS.PANEL_PIN_STATE]).toBe(false);
    expect(fake.sessionData.local_open_panel_tab_ids).toEqual([1]);
    await expect(fake.sendMessage({ type: 'GET_PIN_STATE' })).resolves.toEqual({
      isPinnedGlobal: false,
    });
  });
});
