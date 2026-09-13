import { isPanelNotification, PanelNotification } from '../../messaging';
import { PanelRuntime, PinResult, SidePanelContext } from './types';

export default function createChromePanelRuntime(
  chromeInstance: typeof chrome = chrome
): PanelRuntime {
  return {
    async getContext(): Promise<SidePanelContext | null> {
      try {
        const [currentTab] = await chromeInstance.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (
          typeof currentTab?.id === 'number' &&
          typeof currentTab?.windowId === 'number'
        ) {
          return {
            tabId: currentTab.id,
            windowId: currentTab.windowId,
          };
        }

        return null;
      } catch {
        return null;
      }
    },

    async initialize(tabId: number) {
      return chromeInstance.runtime.sendMessage({
        type: 'PANEL_INIT',
        tabId,
      });
    },

    async requestGlobalPin(context: SidePanelContext): Promise<PinResult> {
      return chromeInstance.runtime.sendMessage({
        type: 'PIN_GLOBAL',
        tabId: context.tabId,
        windowId: context.windowId,
      });
    },

    subscribeNotifications(
      onNotification: (notification: PanelNotification) => void
    ): () => void {
      const handleRuntimeMessage = (message: unknown): false => {
        if (isPanelNotification(message)) {
          onNotification(message);
        }
        return false;
      };

      chromeInstance.runtime.onMessage.addListener(handleRuntimeMessage);
      return () => {
        chromeInstance.runtime.onMessage.removeListener(handleRuntimeMessage);
      };
    },
  };
}
