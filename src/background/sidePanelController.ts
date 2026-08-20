export interface SidePanelRestoreData {
  storedLocalTabIds: unknown;
  storedPinned: unknown;
  existingTabIds: readonly number[];
}

export type SidePanelEvent =
  | { type: 'installed' }
  | { type: 'startup' }
  | { type: 'tab-created'; tabId: number }
  | { type: 'tab-replaced'; addedTabId: number; removedTabId: number }
  | { type: 'action-clicked'; tabId: number; windowId?: number }
  | { type: 'tab-activated'; tabId: number }
  | { type: 'tab-removed'; tabId: number }
  | { type: 'panel-closed'; tabId?: number; windowId: number }
  | {
      type: 'panel-init';
      reply: (response: { isPinnedGlobal: boolean }) => void;
    }
  | {
      type: 'get-pin-state';
      reply: (response: { isPinnedGlobal: boolean }) => void;
    }
  | {
      type: 'pin-global';
      tabId: number;
      windowId: number;
      reply: (
        response:
          | { success: true }
          | { error: 'Nie udało się przypiąć panelu.' }
      ) => void;
    };

export interface SidePanelPlatform {
  restore(): Promise<SidePanelRestoreData>;
  listen(accept: (event: SidePanelEvent) => void): () => void;
  configureExistingTabs(): Promise<void>;
  configureTab(tabId: number): Promise<void>;
  persistLocalTabs(tabIds: readonly number[]): Promise<void>;
  persistPinned(pinned: boolean): Promise<void>;
  openLocal(tabId: number): Promise<void>;
  closeLocal(tabId: number): Promise<void>;
  openGlobal(windowId: number): Promise<void>;
  closeGlobal(windowId: number): Promise<void>;
  closeEveryPanelInWindow(windowId: number): Promise<void>;
}

export interface SidePanelFailure {
  message: string;
  cause: unknown;
}

export interface InstalledSidePanelController {
  readonly ready: Promise<void>;
  stop(): void;
}

interface InstallSidePanelControllerOptions {
  platform: SidePanelPlatform;
  reportError(failure: SidePanelFailure): void;
}

export function installSidePanelController({
  platform,
  reportError,
}: InstallSidePanelControllerOptions): InstalledSidePanelController {
  let isPinnedGlobal = false;
  let localOpenTabIds = new Set<number>();
  let globalCleanupPromise: Promise<void> | null = null;

  const persistLocalTabs = () =>
    platform.persistLocalTabs([...localOpenTabIds]);

  const removeLocalTab = (tabId: number) => {
    localOpenTabIds.delete(tabId);
    return persistLocalTabs();
  };

  const finishGlobalMode = (windowId: number): Promise<void> => {
    if (globalCleanupPromise) return globalCleanupPromise;

    isPinnedGlobal = false;
    localOpenTabIds.clear();

    globalCleanupPromise = Promise.all([
      platform.persistPinned(false),
      persistLocalTabs(),
      platform.closeEveryPanelInWindow(windowId),
    ])
      .then(() => undefined)
      .finally(() => {
        globalCleanupPromise = null;
      });

    return globalCleanupPromise;
  };

  const ready = platform
    .restore()
    .then(({ storedLocalTabIds, storedPinned, existingTabIds }) => {
      const existingTabs = new Set(existingTabIds);
      const restoredTabs = Array.isArray(storedLocalTabIds)
        ? storedLocalTabIds
        : [];

      localOpenTabIds = new Set(
        restoredTabs.filter(
          (tabId: unknown): tabId is number =>
            typeof tabId === 'number' && existingTabs.has(tabId)
        )
      );
      isPinnedGlobal = storedPinned === true;
      return persistLocalTabs();
    })
    .catch((cause: unknown) => {
      reportError({
        message: 'Failed to restore side panel state:',
        cause,
      });
    });

  const accept = (event: SidePanelEvent): void => {
    switch (event.type) {
      case 'installed':
        platform.configureExistingTabs().catch((cause: unknown) => {
          reportError({
            message: 'Failed to configure existing side panels:',
            cause,
          });
        });
        break;

      case 'startup':
        platform.configureExistingTabs().catch((cause: unknown) => {
          reportError({
            message: 'Failed to restore side panel configuration:',
            cause,
          });
        });
        break;

      case 'tab-created':
        platform.configureTab(event.tabId).catch((cause: unknown) => {
          reportError({
            message: 'Failed to configure a new tab side panel:',
            cause,
          });
        });
        break;

      case 'tab-replaced': {
        const wasOpen = localOpenTabIds.delete(event.removedTabId);
        if (wasOpen) localOpenTabIds.add(event.addedTabId);
        persistLocalTabs().catch(() => undefined);
        platform.configureTab(event.addedTabId).catch((cause: unknown) => {
          reportError({
            message: 'Failed to configure a replaced tab side panel:',
            cause,
          });
        });
        break;
      }

      case 'action-clicked': {
        const { tabId, windowId } = event;
        if (isPinnedGlobal && windowId !== undefined) {
          platform
            .closeGlobal(windowId)
            .then(() => finishGlobalMode(windowId))
            .catch((cause: unknown) => {
              reportError({
                message: 'Failed to close the global side panel:',
                cause,
              });
            });
          break;
        }

        if (localOpenTabIds.has(tabId)) {
          localOpenTabIds.delete(tabId);
          Promise.all([platform.closeLocal(tabId), persistLocalTabs()]).catch(
            (cause: unknown) => {
              localOpenTabIds.add(tabId);
              reportError({
                message: 'Failed to close the local side panel:',
                cause,
              });
            }
          );
          break;
        }

        localOpenTabIds.add(tabId);
        Promise.all([platform.openLocal(tabId), persistLocalTabs()]).catch(
          (cause: unknown) => {
            localOpenTabIds.delete(tabId);
            persistLocalTabs().catch(() => undefined);
            reportError({
              message: 'Failed to open the local side panel:',
              cause,
            });
          }
        );
        break;
      }

      case 'tab-activated':
        ready.then(() => {
          if (isPinnedGlobal) {
            if (localOpenTabIds.has(event.tabId)) {
              removeLocalTab(event.tabId).catch(() => undefined);
            }
            return;
          }

          if (localOpenTabIds.has(event.tabId)) return;
          platform.closeLocal(event.tabId).catch(() => undefined);
        });
        break;

      case 'tab-removed':
        if (localOpenTabIds.delete(event.tabId)) {
          persistLocalTabs().catch(() => undefined);
        }
        break;

      case 'panel-closed':
        ready.then(() => {
          if (isPinnedGlobal) {
            finishGlobalMode(event.windowId).catch((cause: unknown) => {
              reportError({
                message: 'Failed to clean up global side panels:',
                cause,
              });
            });
            return;
          }

          if (
            typeof event.tabId === 'number' &&
            localOpenTabIds.delete(event.tabId)
          ) {
            persistLocalTabs().catch(() => undefined);
          }
        });
        break;

      case 'panel-init':
      case 'get-pin-state':
        ready.then(() => event.reply({ isPinnedGlobal }));
        break;

      case 'pin-global': {
        const { tabId, windowId, reply } = event;
        isPinnedGlobal = true;
        localOpenTabIds.delete(tabId);

        const openGlobalPanel = platform.openGlobal(windowId);
        const persistPinState = platform.persistPinned(true);
        const persistTabs = persistLocalTabs();

        Promise.all([openGlobalPanel, persistPinState, persistTabs])
          .then(() => reply({ success: true }))
          .catch((cause: unknown) => {
            isPinnedGlobal = false;
            localOpenTabIds.add(tabId);
            platform.persistPinned(false).catch(() => undefined);
            persistLocalTabs().catch(() => undefined);
            reportError({
              message: 'Failed to pin the side panel globally:',
              cause,
            });
            reply({ error: 'Nie udało się przypiąć panelu.' });
          });
        break;
      }

      /* v8 ignore next -- TypeScript prevents this branch at the interface. */
      default: {
        const exhaustiveEvent: never = event;
        throw new Error(`Unhandled side panel event: ${exhaustiveEvent}`);
      }
    }
  };

  const stopListening = platform.listen(accept);

  return {
    ready,
    stop: stopListening,
  };
}
