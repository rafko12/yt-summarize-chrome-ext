import { isBackgroundMessage } from '../shared/messages';
import { SidePanelPlatform, SidePanelRestoreData } from './sidePanelController';

type SidePanelWithClose = typeof chrome.sidePanel & {
  close(options: { tabId?: number; windowId?: number }): Promise<void>;
  onClosed: {
    addListener(
      callback: (info: { tabId?: number; windowId: number }) => void
    ): void;
    removeListener(
      callback: (info: { tabId?: number; windowId: number }) => void
    ): void;
  };
};

interface ChromeSidePanelPlatformOptions {
  panelPath: string;
  localOpenTabsKey: string;
  pinStateKey: string;
  pinnedWindowKey: string;
}

export default function createChromeSidePanelPlatform(
  chromeApi: typeof chrome,
  {
    panelPath,
    localOpenTabsKey,
    pinStateKey,
    pinnedWindowKey,
  }: ChromeSidePanelPlatformOptions
): SidePanelPlatform {
  const sidePanel = chromeApi.sidePanel as SidePanelWithClose;

  const configureTab = (tabId: number) =>
    chromeApi.sidePanel.setOptions({
      tabId,
      path: panelPath,
      enabled: true,
    });

  return {
    async restore(): Promise<SidePanelRestoreData> {
      const [localResult, pinResult, tabs] = await Promise.all([
        chromeApi.storage.session.get([localOpenTabsKey, pinnedWindowKey]),
        chromeApi.storage.local.get([pinStateKey]),
        chromeApi.tabs.query({}),
      ]);
      return {
        storedLocalTabIds: localResult[localOpenTabsKey],
        storedPinned: pinResult[pinStateKey],
        storedPinnedWindowId: localResult[pinnedWindowKey],
        existingWindowIds: [...new Set(tabs.map((tab) => tab.windowId))],
        existingTabIds: tabs.flatMap((tab) =>
          tab.id === undefined ? [] : [tab.id]
        ),
      };
    },

    listen(accept) {
      const onInstalled = () => accept({ type: 'installed' });
      const onStartup = () => accept({ type: 'startup' });
      const onTabCreated = (tab: chrome.tabs.Tab) => {
        if (tab.id !== undefined) {
          accept({ type: 'tab-created', tabId: tab.id });
        }
      };
      const onTabReplaced = (addedTabId: number, removedTabId: number) => {
        accept({ type: 'tab-replaced', addedTabId, removedTabId });
      };
      const onActionClicked = (tab: chrome.tabs.Tab) => {
        if (tab.id !== undefined) {
          accept({
            type: 'action-clicked',
            tabId: tab.id,
            windowId: tab.windowId,
          });
        }
      };
      const onTabActivated = ({ tabId }: chrome.tabs.TabActiveInfo) => {
        accept({ type: 'tab-activated', tabId });
      };
      const onTabRemoved = (tabId: number) => {
        accept({ type: 'tab-removed', tabId });
      };
      const onPanelClosed = (info: { tabId?: number; windowId: number }) => {
        accept({ type: 'panel-closed', ...info });
      };
      const onMessage = (
        message: unknown,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => {
        if (!isBackgroundMessage(message)) return false;

        switch (message.type) {
          case 'PANEL_INIT':
            accept({ type: 'panel-init', reply: sendResponse });
            return true;
          case 'PIN_GLOBAL':
            accept({
              type: 'pin-global',
              tabId: message.tabId,
              windowId: message.windowId,
              reply: sendResponse,
            });
            return true;
          case 'GET_PIN_STATE':
            accept({ type: 'get-pin-state', reply: sendResponse });
            return true;
          default:
            return false;
        }
      };

      chromeApi.runtime.onInstalled.addListener(onInstalled);
      chromeApi.runtime.onStartup.addListener(onStartup);
      chromeApi.tabs.onCreated.addListener(onTabCreated);
      chromeApi.tabs.onReplaced.addListener(onTabReplaced);
      chromeApi.action.onClicked.addListener(onActionClicked);
      chromeApi.tabs.onActivated.addListener(onTabActivated);
      chromeApi.tabs.onRemoved.addListener(onTabRemoved);
      sidePanel.onClosed.addListener(onPanelClosed);
      chromeApi.runtime.onMessage.addListener(onMessage);

      return () => {
        chromeApi.runtime.onInstalled.removeListener(onInstalled);
        chromeApi.runtime.onStartup.removeListener(onStartup);
        chromeApi.tabs.onCreated.removeListener(onTabCreated);
        chromeApi.tabs.onReplaced.removeListener(onTabReplaced);
        chromeApi.action.onClicked.removeListener(onActionClicked);
        chromeApi.tabs.onActivated.removeListener(onTabActivated);
        chromeApi.tabs.onRemoved.removeListener(onTabRemoved);
        sidePanel.onClosed.removeListener(onPanelClosed);
        chromeApi.runtime.onMessage.removeListener(onMessage);
      };
    },

    async configureExistingTabs() {
      const tabs = await chromeApi.tabs.query({});
      await Promise.all(
        tabs.flatMap((tab) =>
          tab.id === undefined ? [] : [configureTab(tab.id)]
        )
      );
    },

    configureTab,

    persistLocalTabs(tabIds) {
      return chromeApi.storage.session.set({
        [localOpenTabsKey]: [...tabIds],
      });
    },

    persistPinned(pinned) {
      return chromeApi.storage.local.set({ [pinStateKey]: pinned });
    },

    async persistPinnedWindow(windowId) {
      if (windowId === undefined) {
        await chromeApi.storage.session.remove(pinnedWindowKey);
        return;
      }

      await chromeApi.storage.session.set({
        [pinnedWindowKey]: windowId,
      });
    },

    openLocal(tabId) {
      return chromeApi.sidePanel.open({ tabId });
    },

    closeLocal(tabId) {
      return sidePanel.close({ tabId });
    },

    openGlobal(windowId) {
      return chromeApi.sidePanel.open({ windowId });
    },

    closeGlobal(windowId) {
      return sidePanel.close({ windowId });
    },

    async closeEveryPanelInWindow(windowId) {
      const tabs = await chromeApi.tabs.query({ windowId });
      await Promise.all(
        tabs.flatMap((tab) =>
          tab.id === undefined
            ? []
            : [sidePanel.close({ tabId: tab.id }).catch(() => undefined)]
        )
      );
    },
  };
}
