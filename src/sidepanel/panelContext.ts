export interface SidePanelContext {
  tabId: number;
  windowId: number;
}

export async function getCurrentPanelContext(): Promise<SidePanelContext | null> {
  try {
    const [currentTab] = await chrome.tabs.query({
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
}
