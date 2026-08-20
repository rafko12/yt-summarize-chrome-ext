import { isBackgroundMessage } from '../shared/messages';
import { STORAGE_KEYS } from '../utils/storage';

const PANEL_PATH = 'src/popup/index.html';
const LOCAL_OPEN_TABS_KEY = 'local_open_panel_tab_ids';
const PIN_STATE_KEY = STORAGE_KEYS.PANEL_PIN_STATE;

let isPinnedGlobal = false;
let localOpenTabIds = new Set<number>();
let globalCleanupPromise: Promise<void> | null = null;

type SidePanelWithClose = typeof chrome.sidePanel & {
  close(options: { tabId?: number; windowId?: number }): Promise<void>;
  onClosed: {
    addListener(
      callback: (info: { tabId?: number; windowId: number }) => void
    ): void;
  };
};

const sidePanel = chrome.sidePanel as SidePanelWithClose;

function configureTab(tabId: number): Promise<void> {
  return chrome.sidePanel.setOptions({
    tabId,
    path: PANEL_PATH,
    enabled: true,
  });
}

async function configureExistingTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs
      .filter(
        (tab): tab is chrome.tabs.Tab & { id: number } => tab.id !== undefined
      )
      .map((tab) => configureTab(tab.id))
  );
}

function persistLocalOpenTabs(): Promise<void> {
  return chrome.storage.session.set({
    [LOCAL_OPEN_TABS_KEY]: [...localOpenTabIds],
  });
}

function setLocalTabOpen(tabId: number, isOpen: boolean): Promise<void> {
  if (isOpen) localOpenTabIds.add(tabId);
  else localOpenTabIds.delete(tabId);
  return persistLocalOpenTabs();
}

function finishGlobalMode(windowId: number): Promise<void> {
  if (globalCleanupPromise) return globalCleanupPromise;

  isPinnedGlobal = false;
  localOpenTabIds.clear();

  globalCleanupPromise = Promise.all([
    chrome.storage.local.set({ [PIN_STATE_KEY]: false }),
    persistLocalOpenTabs(),
    chrome.tabs
      .query({ windowId })
      .then((tabs) =>
        Promise.all(
          tabs.flatMap((tab) =>
            tab.id === undefined
              ? []
              : [sidePanel.close({ tabId: tab.id }).catch(() => undefined)]
          )
        )
      ),
  ])
    .then(() => undefined)
    .finally(() => {
      globalCleanupPromise = null;
    });

  return globalCleanupPromise;
}

async function restoreState(): Promise<void> {
  const [localResult, pinResult, tabs] = await Promise.all([
    chrome.storage.session.get([LOCAL_OPEN_TABS_KEY]),
    chrome.storage.local.get([PIN_STATE_KEY]),
    chrome.tabs.query({}),
  ]);
  const existingTabIds = new Set(
    tabs.flatMap((tab) => (tab.id === undefined ? [] : [tab.id]))
  );
  const storedTabIds = Array.isArray(localResult[LOCAL_OPEN_TABS_KEY])
    ? localResult[LOCAL_OPEN_TABS_KEY]
    : [];

  localOpenTabIds = new Set(
    storedTabIds.filter(
      (tabId: unknown): tabId is number =>
        typeof tabId === 'number' && existingTabIds.has(tabId)
    )
  );
  isPinnedGlobal = pinResult[PIN_STATE_KEY] === true;
  await persistLocalOpenTabs();
}

const stateReady = restoreState().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to restore side panel state:', error);
});

// Chrome's close button and side-panel menu do not trigger an action click.
// Keep the extension state in sync so a later action click opens the panel
// instead of merely clearing a stale state entry.
sidePanel.onClosed.addListener(({ tabId, windowId }) => {
  stateReady.then(() => {
    // Chrome can include tabId for a close observed while global mode is
    // active because every tab has tab-specific options. The mode flag is the
    // authority: any close while pinned ends the mode for the entire window.
    if (isPinnedGlobal) {
      finishGlobalMode(windowId).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to clean up global side panels:', error);
      });
      return;
    }

    if (typeof tabId === 'number') {
      if (!localOpenTabIds.delete(tabId)) return;
      persistLocalOpenTabs().catch(() => undefined);
    }
  });
});

chrome.runtime.onInstalled.addListener(() => {
  configureExistingTabs().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to configure existing side panels:', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  configureExistingTabs().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to restore side panel configuration:', error);
  });
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === undefined) return;
  configureTab(tab.id).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to configure a new tab side panel:', error);
  });
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  const wasOpen = localOpenTabIds.delete(removedTabId);
  if (wasOpen) localOpenTabIds.add(addedTabId);
  persistLocalOpenTabs().catch(() => undefined);
  configureTab(addedTabId).catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to configure a replaced tab side panel:', error);
  });
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;

  if (isPinnedGlobal && tab.windowId !== undefined) {
    const closeGlobalPanel = sidePanel.close({ windowId: tab.windowId });
    closeGlobalPanel
      .then(() => finishGlobalMode(tab.windowId as number))
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to close the global side panel:', error);
      });
    return;
  }

  if (localOpenTabIds.has(tab.id)) {
    localOpenTabIds.delete(tab.id);
    const closeLocalPanel = sidePanel.close({ tabId: tab.id });
    Promise.all([closeLocalPanel, persistLocalOpenTabs()]).catch((error) => {
      localOpenTabIds.add(tab.id as number);
      // eslint-disable-next-line no-console
      console.error('Failed to close the local side panel:', error);
    });
    return;
  }

  localOpenTabIds.add(tab.id);
  const openLocalPanel = chrome.sidePanel.open({ tabId: tab.id });
  Promise.all([openLocalPanel, persistLocalOpenTabs()]).catch((error) => {
    localOpenTabIds.delete(tab.id as number);
    persistLocalOpenTabs().catch(() => undefined);
    // eslint-disable-next-line no-console
    console.error('Failed to open the local side panel:', error);
  });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await stateReady;

  if (isPinnedGlobal) {
    if (localOpenTabIds.has(tabId)) {
      await setLocalTabOpen(tabId, false);
    }
    return;
  }

  if (localOpenTabIds.has(tabId)) return;
  sidePanel.close({ tabId }).catch(() => {
    // The destination panel may already be closed.
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (!localOpenTabIds.delete(tabId)) return;
  persistLocalOpenTabs().catch(() => undefined);
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isBackgroundMessage(message)) return false;
    const msg = message;
    if (msg.type === 'PANEL_INIT') {
      stateReady.then(() => sendResponse({ isPinnedGlobal }));
      return true;
    }

    if (msg.type === 'PIN_GLOBAL') {
      const { tabId, windowId } = msg;
      isPinnedGlobal = true;
      localOpenTabIds.delete(tabId);

      // Opening the global panel must be the first side-panel operation in this
      // gesture. Closing the sender's local instance here unloads the panel before
      // Chrome can replace it and makes pinning look like a plain close.
      const openGlobalPanel = chrome.sidePanel.open({ windowId });
      const persistPinState = chrome.storage.local.set({
        [PIN_STATE_KEY]: true,
      });
      const persistTabs = persistLocalOpenTabs();

      Promise.all([openGlobalPanel, persistPinState, persistTabs])
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          isPinnedGlobal = false;
          localOpenTabIds.add(tabId);
          chrome.storage.local
            .set({ [PIN_STATE_KEY]: false })
            .catch(() => undefined);
          persistLocalOpenTabs().catch(() => undefined);
          // eslint-disable-next-line no-console
          console.error('Failed to pin the side panel globally:', error);
          sendResponse({ error: 'Nie udało się przypiąć panelu.' });
        });
      return true;
    }

    if (msg.type === 'GET_PIN_STATE') {
      stateReady.then(() => sendResponse({ isPinnedGlobal }));
      return true;
    }

    return false;
  }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && changeInfo.url.includes('youtube.com/watch')) {
    chrome.runtime
      .sendMessage({
        type: 'YOUTUBE_URL_UPDATED',
        url: changeInfo.url,
        tabId,
      })
      .catch(() => {
        // Ignore errors when the side panel is not open or listening.
      });
  }
});
