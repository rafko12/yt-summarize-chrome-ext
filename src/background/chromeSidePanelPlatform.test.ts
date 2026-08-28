import { describe, expect, test, vi } from 'vitest';

import createChromeSidePanelPlatform from './chromeSidePanelPlatform';

function event<T extends (...args: never[]) => unknown>() {
  const listeners: T[] = [];
  return {
    addListener: vi.fn((listener: T) => listeners.push(listener)),
    removeListener: vi.fn((listener: T) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    }),
    emit: (...args: Parameters<T>) =>
      listeners.map((listener) => listener(...args)),
  };
}

function platformFixture() {
  const installed = event<() => void>();
  const startup = event<() => void>();
  const created = event<(tab: chrome.tabs.Tab) => void>();
  const replaced = event<(added: number, removed: number) => void>();
  const clicked = event<(tab: chrome.tabs.Tab) => void>();
  const activated = event<(info: chrome.tabs.TabActiveInfo) => void>();
  const removed = event<(id: number) => void>();
  const closed = event<(info: { tabId?: number; windowId: number }) => void>();
  const message =
    event<
      (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        reply: (response?: unknown) => void
      ) => boolean | void
    >();
  const tabs = [
    { id: 1, windowId: 4 },
    { id: undefined, windowId: 4 },
    { id: 2, windowId: 5 },
  ] as chrome.tabs.Tab[];
  const chromeApi = {
    action: { onClicked: clicked },
    runtime: { onInstalled: installed, onStartup: startup, onMessage: message },
    sidePanel: {
      setOptions: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      onClosed: closed,
    },
    storage: {
      session: {
        get: vi.fn(async () => ({ localTabs: [1, 'wrong'] })),
        set: vi.fn(async () => undefined),
      },
      local: {
        get: vi.fn(async () => ({ pinned: true })),
        set: vi.fn(async () => undefined),
      },
    },
    tabs: {
      query: vi.fn(async (query: chrome.tabs.QueryInfo) =>
        query.windowId === undefined
          ? tabs
          : tabs.filter((tab) => tab.windowId === query.windowId)
      ),
      onCreated: created,
      onReplaced: replaced,
      onActivated: activated,
      onRemoved: removed,
    },
  } as unknown as unknown as typeof chrome;

  return {
    chromeApi,
    events: {
      installed,
      startup,
      created,
      replaced,
      clicked,
      activated,
      removed,
      closed,
      message,
    },
  };
}

describe('Chrome side panel platform', () => {
  test('restores persistent state and configures existing tabs', async () => {
    const fake = platformFixture();
    const platform = createChromeSidePanelPlatform(fake.chromeApi, {
      panelPath: 'popup.html',
      localOpenTabsKey: 'localTabs',
      pinStateKey: 'pinned',
    });

    await expect(platform.restore()).resolves.toEqual({
      storedLocalTabIds: [1, 'wrong'],
      storedPinned: true,
      existingTabIds: [1, 2],
    });
    await platform.configureExistingTabs();
    await platform.configureTab(9);
    expect(fake.chromeApi.sidePanel.setOptions).toHaveBeenNthCalledWith(1, {
      tabId: 1,
      path: 'popup.html',
      enabled: true,
    });
    expect(fake.chromeApi.sidePanel.setOptions).toHaveBeenNthCalledWith(3, {
      tabId: 9,
      path: 'popup.html',
      enabled: true,
    });
  });

  test('translates Chrome events, messages, persistence and close operations', async () => {
    const fake = platformFixture();
    const platform = createChromeSidePanelPlatform(fake.chromeApi, {
      panelPath: 'popup.html',
      localOpenTabsKey: 'localTabs',
      pinStateKey: 'pinned',
    });
    const accepted: unknown[] = [];
    const stop = platform.listen((entry) => accepted.push(entry));

    fake.events.installed.emit();
    fake.events.startup.emit();
    fake.events.created.emit({ id: 3 } as chrome.tabs.Tab);
    fake.events.created.emit({} as chrome.tabs.Tab);
    fake.events.replaced.emit(4, 3);
    fake.events.clicked.emit({ id: 3, windowId: 4 } as chrome.tabs.Tab);
    fake.events.clicked.emit({} as chrome.tabs.Tab);
    fake.events.activated.emit({ tabId: 3, windowId: 4 });
    fake.events.removed.emit(3);
    fake.events.closed.emit({ tabId: 3, windowId: 4 });

    const reply = vi.fn();
    expect(
      fake.events.message.emit(
        { type: 'PANEL_INIT', tabId: 3 },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toEqual([true]);
    expect(
      fake.events.message.emit(
        { type: 'PIN_GLOBAL', tabId: 3, windowId: 4 },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toEqual([true]);
    expect(
      fake.events.message.emit(
        { type: 'GET_PIN_STATE' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toEqual([true]);
    expect(
      fake.events.message.emit(
        { type: 'GET_VIDEO_DATA' },
        {} as chrome.runtime.MessageSender,
        reply
      )
    ).toEqual([false]);

    expect(accepted).toEqual(
      expect.arrayContaining([
        { type: 'installed' },
        { type: 'startup' },
        { type: 'tab-created', tabId: 3 },
        { type: 'tab-replaced', addedTabId: 4, removedTabId: 3 },
        { type: 'action-clicked', tabId: 3, windowId: 4 },
        { type: 'tab-activated', tabId: 3 },
        { type: 'tab-removed', tabId: 3 },
        { type: 'panel-closed', tabId: 3, windowId: 4 },
        { type: 'panel-init', reply },
        { type: 'pin-global', tabId: 3, windowId: 4, reply },
        { type: 'get-pin-state', reply },
      ])
    );

    await platform.persistLocalTabs([3]);
    await platform.persistPinned(false);
    await platform.openLocal(3);
    await platform.closeLocal(3);
    await platform.openGlobal(4);
    await platform.closeGlobal(4);
    vi.mocked(
      (fake.chromeApi.sidePanel as unknown as { close: () => Promise<void> })
        .close
    ).mockRejectedValueOnce(new Error('closed'));
    await platform.closeEveryPanelInWindow(4);

    expect(fake.chromeApi.storage.session.set).toHaveBeenCalledWith({
      localTabs: [3],
    });
    expect(fake.chromeApi.storage.local.set).toHaveBeenCalledWith({
      pinned: false,
    });
    expect(fake.chromeApi.sidePanel.open).toHaveBeenCalledWith({ tabId: 3 });
    expect(fake.chromeApi.sidePanel.open).toHaveBeenCalledWith({ windowId: 4 });
    expect(
      (fake.chromeApi.sidePanel as unknown as { close: () => Promise<void> })
        .close
    ).toHaveBeenCalledWith({
      windowId: 4,
    });
    stop();
    expect(fake.events.message.removeListener).toHaveBeenCalledOnce();
    expect(fake.events.closed.removeListener).toHaveBeenCalledOnce();
  });
});
