import { PinStateResponse } from '../shared/messages';

export interface SidePanelRestoreData {
  storedLocalTabIds: unknown;
  storedPinned: unknown;
  storedPinnedWindowId?: unknown;
  existingTabIds: readonly number[];
  existingWindowIds?: readonly number[];
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
      reply: (response: PinStateResponse) => void;
    }
  | {
      type: 'get-pin-state';
      reply: (response: PinStateResponse) => void;
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

export interface SidePanelAdapter {
  restore(): Promise<SidePanelRestoreData>;
  listen(accept: (event: SidePanelEvent) => void): () => void;
  configureExistingTabs(): Promise<void>;
  configureTab(tabId: number): Promise<void>;
  persistLocalTabs(tabIds: readonly number[]): Promise<void>;
  persistPinned(pinned: boolean): Promise<void>;
  persistPinnedWindow(windowId: number | undefined): Promise<void>;
  openLocal(tabId: number): Promise<void>;
  closeLocal(tabId: number): Promise<void>;
  openGlobal(windowId: number): Promise<void>;
  closeGlobal(windowId: number): Promise<void>;
  closeEveryPanelInWindow(windowId: number): Promise<void>;
}

export type SidePanelPlatform = SidePanelAdapter;

export interface SidePanelFailure {
  message: string;
  cause: unknown;
}

export interface InstalledSidePanelController {
  readonly ready: Promise<void>;
  stop(): void;
}

interface InstallSidePanelControllerOptions {
  platform: SidePanelAdapter;
  reportError(failure: SidePanelFailure): void;
}

type PanelOpenResult = { success: true } | { success: false; cause: unknown };

interface StartedPanelOpen {
  result: Promise<PanelOpenResult>;
}

function startPanelOpen(open: () => Promise<void>): StartedPanelOpen {
  try {
    const openResult = open();
    return {
      result: openResult.then(
        () => ({ success: true }),
        (cause: unknown) => ({ success: false, cause })
      ),
    };
  } catch (cause: unknown) {
    return { result: Promise.resolve({ success: false, cause }) };
  }
}

function continuePanelOpen(
  startedPanelOpen: StartedPanelOpen | undefined,
  fallback: () => Promise<void>
): Promise<void> {
  if (startedPanelOpen === undefined) return fallback();
  return startedPanelOpen.result.then((result) => {
    if (!result.success) throw result.cause;
  });
}

export function installSidePanelController({
  platform,
  reportError,
}: InstallSidePanelControllerOptions): InstalledSidePanelController {
  let isPinnedGlobal = false;
  let localOpenTabIds = new Set<number>();
  let pinnedWindowId: number | undefined;

  const persistLocalTabs = () =>
    platform.persistLocalTabs([...localOpenTabIds]);

  const removeLocalTab = (tabId: number) => {
    localOpenTabIds.delete(tabId);
    return persistLocalTabs();
  };

  const finishGlobalMode = (windowId: number): Promise<void> => {
    isPinnedGlobal = false;
    localOpenTabIds.clear();
    pinnedWindowId = undefined;

    return Promise.all([
      platform.persistPinned(false),
      platform.persistPinnedWindow(undefined),
      persistLocalTabs(),
      platform.closeEveryPanelInWindow(windowId),
    ])
      .catch(async (cause: unknown) => {
        await Promise.all([
          platform.persistPinned(false).catch(() => undefined),
          platform.persistPinnedWindow(undefined).catch(() => undefined),
          persistLocalTabs().catch(() => undefined),
        ]);
        throw cause;
      })
      .then(() => undefined);
  };

  const ready = platform
    .restore()
    .then(
      ({
        storedLocalTabIds,
        storedPinned,
        storedPinnedWindowId,
        existingTabIds,
        existingWindowIds,
      }) => {
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
        const restoredPinnedWindowId =
          typeof storedPinnedWindowId === 'number'
            ? storedPinnedWindowId
            : undefined;
        const isRestoredPinnedWindowAvailable =
          restoredPinnedWindowId === undefined ||
          existingWindowIds === undefined ||
          existingWindowIds.includes(restoredPinnedWindowId);
        isPinnedGlobal =
          storedPinned === true && isRestoredPinnedWindowAvailable;
        pinnedWindowId = isPinnedGlobal ? restoredPinnedWindowId : undefined;

        if (storedPinned === true && !isPinnedGlobal) {
          return Promise.all([
            platform.persistPinned(false),
            platform.persistPinnedWindow(undefined),
            persistLocalTabs(),
          ]).then(() => undefined);
        }

        return persistLocalTabs();
      }
    )
    .catch((cause: unknown) => {
      reportError({
        message: 'Failed to restore side panel state:',
        cause,
      });
    });

  const processEvent = async (
    event: SidePanelEvent,
    startedPanelOpen?: StartedPanelOpen
  ): Promise<void> => {
    switch (event.type) {
      case 'installed':
        try {
          await platform.configureExistingTabs();
        } catch (cause: unknown) {
          reportError({
            message: 'Failed to configure existing side panels:',
            cause,
          });
        }
        break;

      case 'startup':
        try {
          await platform.configureExistingTabs();
        } catch (cause: unknown) {
          reportError({
            message: 'Failed to restore side panel configuration:',
            cause,
          });
        }
        break;

      case 'tab-created':
        try {
          await platform.configureTab(event.tabId);
        } catch (cause: unknown) {
          reportError({
            message: 'Failed to configure a new tab side panel:',
            cause,
          });
        }
        break;

      case 'tab-replaced': {
        const wasOpen = localOpenTabIds.delete(event.removedTabId);
        if (wasOpen) localOpenTabIds.add(event.addedTabId);
        await Promise.all([
          persistLocalTabs().catch(() => undefined),
          platform.configureTab(event.addedTabId).catch((cause: unknown) => {
            reportError({
              message: 'Failed to configure a replaced tab side panel:',
              cause,
            });
          }),
        ]);
        break;
      }

      case 'action-clicked': {
        const { tabId, windowId } = event;
        if (isPinnedGlobal && windowId !== undefined) {
          try {
            const globalWindowId = pinnedWindowId ?? windowId;
            await platform.closeGlobal(globalWindowId);
            await finishGlobalMode(globalWindowId);
          } catch (cause: unknown) {
            reportError({
              message: 'Failed to close the global side panel:',
              cause,
            });
          }
          break;
        }

        if (localOpenTabIds.has(tabId)) {
          localOpenTabIds.delete(tabId);
          try {
            await Promise.all([platform.closeLocal(tabId), persistLocalTabs()]);
          } catch (cause: unknown) {
            localOpenTabIds.add(tabId);
            reportError({
              message: 'Failed to close the local side panel:',
              cause,
            });
          }
          break;
        }

        localOpenTabIds.add(tabId);
        try {
          await Promise.all([
            continuePanelOpen(startedPanelOpen, () =>
              platform.openLocal(tabId)
            ),
            persistLocalTabs(),
          ]);
        } catch (cause: unknown) {
          localOpenTabIds.delete(tabId);
          await persistLocalTabs().catch(() => undefined);
          reportError({
            message: 'Failed to open the local side panel:',
            cause,
          });
        }
        break;
      }

      case 'tab-activated':
        if (isPinnedGlobal) {
          if (localOpenTabIds.has(event.tabId)) {
            await removeLocalTab(event.tabId).catch(() => undefined);
          }
          break;
        }

        if (localOpenTabIds.has(event.tabId)) break;
        await platform.closeLocal(event.tabId).catch(() => undefined);
        break;

      case 'tab-removed':
        if (localOpenTabIds.delete(event.tabId)) {
          await persistLocalTabs().catch(() => undefined);
        }
        break;

      case 'panel-closed':
        if (isPinnedGlobal) {
          if (pinnedWindowId !== undefined && event.windowId !== pinnedWindowId)
            break;
          try {
            await finishGlobalMode(event.windowId);
          } catch (cause: unknown) {
            reportError({
              message: 'Failed to clean up global side panels:',
              cause,
            });
          }
          break;
        }

        if (
          typeof event.tabId === 'number' &&
          localOpenTabIds.delete(event.tabId)
        ) {
          await persistLocalTabs().catch(() => undefined);
        }
        break;

      case 'panel-init':
      case 'get-pin-state':
        event.reply({ isPinnedGlobal });
        break;

      case 'pin-global': {
        const { tabId, windowId, reply } = event;
        isPinnedGlobal = true;
        localOpenTabIds.delete(tabId);
        pinnedWindowId = windowId;

        try {
          await Promise.all([
            continuePanelOpen(startedPanelOpen, () =>
              platform.openGlobal(windowId)
            ),
            platform.persistPinned(true),
            persistLocalTabs(),
            platform.persistPinnedWindow(windowId),
          ]);
          reply({ success: true });
        } catch (cause: unknown) {
          isPinnedGlobal = false;
          pinnedWindowId = undefined;
          localOpenTabIds.add(tabId);
          await Promise.all([
            platform.persistPinnedWindow(undefined).catch(() => undefined),
            platform.closeGlobal(windowId).catch(() => undefined),
            platform.persistPinned(false).catch(() => undefined),
            persistLocalTabs().catch(() => undefined),
          ]);
          reportError({
            message: 'Failed to pin the side panel globally:',
            cause,
          });
          reply({ error: 'Nie udało się przypiąć panelu.' });
        }
        break;
      }

      /* v8 ignore next -- TypeScript prevents this branch at the interface. */
      default: {
        const exhaustiveEvent: never = event;
        throw new Error(`Unhandled side panel event: ${exhaustiveEvent}`);
      }
    }
  };

  let eventQueue = ready;

  const accept = (event: SidePanelEvent): void => {
    let startedPanelOpen: StartedPanelOpen | undefined;
    if (
      event.type === 'action-clicked' &&
      !isPinnedGlobal &&
      !localOpenTabIds.has(event.tabId)
    ) {
      startedPanelOpen = startPanelOpen(() => platform.openLocal(event.tabId));
    } else if (event.type === 'pin-global') {
      startedPanelOpen = startPanelOpen(() =>
        platform.openGlobal(event.windowId)
      );
    }
    eventQueue = eventQueue
      .then(() => processEvent(event, startedPanelOpen))
      .catch((cause: unknown) => {
        reportError({ message: 'Failed to process side panel event:', cause });
      });
  };

  const stopListening = platform.listen(accept);

  return {
    ready,
    stop: stopListening,
  };
}
