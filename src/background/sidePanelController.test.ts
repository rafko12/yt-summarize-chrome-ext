import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  installSidePanelController,
  SidePanelEvent,
  SidePanelFailure,
  SidePanelPlatform,
  SidePanelRestoreData,
} from './sidePanelController';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

const DEFAULT_RESTORE: SidePanelRestoreData = {
  storedLocalTabIds: [],
  storedPinned: false,
  existingTabIds: [1, 2, 3],
};

function createPlatform(restoreData = DEFAULT_RESTORE) {
  let acceptEvent: ((event: SidePanelEvent) => void) | undefined;
  const stop = vi.fn();
  const platform = {
    restore: vi.fn(async () => restoreData),
    listen: vi.fn((accept: (event: SidePanelEvent) => void) => {
      acceptEvent = accept;
      return stop;
    }),
    configureExistingTabs: vi.fn(async () => undefined),
    configureTab: vi.fn(async () => undefined),
    persistLocalTabs: vi.fn<SidePanelPlatform['persistLocalTabs']>(
      async () => undefined
    ),
    persistPinned: vi.fn(async () => undefined),
    persistPinnedWindow: vi.fn(async () => undefined),
    openLocal: vi.fn(async () => undefined),
    closeLocal: vi.fn(async () => undefined),
    openGlobal: vi.fn(async () => undefined),
    closeGlobal: vi.fn(async () => undefined),
    closeEveryPanelInWindow: vi.fn(async () => undefined),
  } satisfies SidePanelPlatform;

  return {
    platform,
    stop,
    emit(event: SidePanelEvent) {
      if (!acceptEvent) throw new Error('Controller is not installed');
      acceptEvent(event);
    },
  };
}

async function settlePromises(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function install(restoreData = DEFAULT_RESTORE) {
  const fake = createPlatform(restoreData);
  const reportError = vi.fn<(failure: SidePanelFailure) => void>();
  const installed = installSidePanelController({
    platform: fake.platform,
    reportError,
  });
  return { ...fake, installed, reportError };
}

describe('side panel controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('restores only numeric ids of existing tabs', async () => {
    const fake = install({
      storedLocalTabIds: [1, '2', 3, 99],
      storedPinned: true,
      existingTabIds: [1, 3],
    });

    await fake.installed.ready;
    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([1, 3]);

    const reply = vi.fn();
    fake.emit({ type: 'get-pin-state', reply });
    await settlePromises();
    expect(reply).toHaveBeenCalledWith({ isPinnedGlobal: true });
  });

  test('uses empty unpinned state for invalid persisted values', async () => {
    const fake = install({
      storedLocalTabIds: 'invalid',
      storedPinned: 'true',
      existingTabIds: [1],
    });

    await fake.installed.ready;
    const reply = vi.fn();
    fake.emit({ type: 'panel-init', reply });
    await settlePromises();
    expect(fake.platform.persistLocalTabs).toHaveBeenCalledWith([]);
    expect(reply).toHaveBeenCalledWith({ isPinnedGlobal: false });
  });

  test('reports restoration failure and remains usable', async () => {
    const fake = install();
    const failure = new Error('restore failed');
    fake.platform.restore.mockRejectedValueOnce(failure);

    const reinstalled = installSidePanelController({
      platform: fake.platform,
      reportError: fake.reportError,
    });
    await reinstalled.ready;

    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to restore side panel state:',
      cause: failure,
    });
  });

  test('processes an action click received during restoration after the restored state', async () => {
    const restoring = deferred<SidePanelRestoreData>();
    const fake = createPlatform();
    fake.platform.restore.mockReturnValueOnce(restoring.promise);
    const reportError = vi.fn<(failure: SidePanelFailure) => void>();
    const installed = installSidePanelController({
      platform: fake.platform,
      reportError,
    });

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    expect(fake.platform.openLocal).toHaveBeenCalledWith(1);
    expect(fake.platform.closeLocal).not.toHaveBeenCalled();

    restoring.resolve({
      storedLocalTabIds: [1],
      storedPinned: false,
      existingTabIds: [1],
    });
    await installed.ready;
    await settlePromises();

    expect(fake.platform.closeLocal).toHaveBeenCalledWith(1);
    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([]);
  });
  test('does not persist a panel for a tab removed after a click during restoration', async () => {
    const restoring = deferred<SidePanelRestoreData>();
    const fake = createPlatform();
    fake.platform.restore.mockReturnValueOnce(restoring.promise);
    const reportError = vi.fn<(failure: SidePanelFailure) => void>();
    const installed = installSidePanelController({
      platform: fake.platform,
      reportError,
    });

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await Promise.resolve();
    fake.emit({ type: 'tab-removed', tabId: 1 });
    restoring.resolve({
      storedLocalTabIds: [],
      storedPinned: false,
      existingTabIds: [1],
    });
    await installed.ready;
    await settlePromises();

    expect(fake.platform.openLocal).toHaveBeenCalledWith(1);
    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([]);
  });
  test('waits for a local panel persistence before removing the same tab', async () => {
    const fake = install();
    const pendingOpenPersistence = deferred<void>();
    let persistedTabIds: readonly number[] = [];
    fake.platform.persistLocalTabs.mockImplementation((tabIds) => {
      if (tabIds.length === 1) {
        return pendingOpenPersistence.promise.then(() => {
          persistedTabIds = [...tabIds];
          return undefined;
        });
      }

      persistedTabIds = [...tabIds];
      return Promise.resolve(undefined);
    });
    await fake.installed.ready;

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await Promise.resolve();
    fake.emit({ type: 'tab-removed', tabId: 1 });
    pendingOpenPersistence.resolve(undefined);
    await settlePromises();

    expect(persistedTabIds).toEqual([]);
  });
  test.each([
    {
      event: { type: 'installed' } as const,
      message: 'Failed to configure existing side panels:',
    },
    {
      event: { type: 'startup' } as const,
      message: 'Failed to restore side panel configuration:',
    },
  ])(
    'reports configuration failure for $event.type',
    async ({ event, message }) => {
      const fake = install();
      await fake.installed.ready;
      const failure = new Error(event.type);
      fake.platform.configureExistingTabs.mockRejectedValueOnce(failure);

      fake.emit(event);
      await settlePromises();

      expect(fake.reportError).toHaveBeenCalledWith({
        message,
        cause: failure,
      });
    }
  );

  test('configures new and replaced tabs while moving open local state', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: false,
      existingTabIds: [1, 2, 3],
    });
    await fake.installed.ready;

    fake.emit({ type: 'tab-created', tabId: 2 });
    fake.emit({ type: 'tab-replaced', removedTabId: 1, addedTabId: 3 });
    await settlePromises();

    expect(fake.platform.configureTab).toHaveBeenCalledWith(2);
    expect(fake.platform.configureTab).toHaveBeenCalledWith(3);
    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([3]);
  });

  test('keeps the local set unchanged when replacing a closed tab', async () => {
    const fake = install();
    await fake.installed.ready;

    fake.emit({ type: 'tab-replaced', removedTabId: 1, addedTabId: 3 });
    await settlePromises();

    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([]);
  });

  test.each([
    {
      event: { type: 'tab-created', tabId: 2 } as const,
      message: 'Failed to configure a new tab side panel:',
    },
    {
      event: {
        type: 'tab-replaced',
        removedTabId: 1,
        addedTabId: 2,
      } as const,
      message: 'Failed to configure a replaced tab side panel:',
    },
  ])(
    'reports tab configuration failure for $event.type',
    async ({ event, message }) => {
      const fake = install();
      await fake.installed.ready;
      const failure = new Error(event.type);
      fake.platform.configureTab.mockRejectedValueOnce(failure);

      fake.emit(event);
      await settlePromises();

      expect(fake.reportError).toHaveBeenCalledWith({
        message,
        cause: failure,
      });
    }
  );

  test('rolls back a failed local open so the next click opens again', async () => {
    const fake = install();
    await fake.installed.ready;
    const failure = new Error('open failed');
    fake.platform.openLocal.mockRejectedValueOnce(failure);

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();
    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.platform.openLocal).toHaveBeenCalledTimes(2);
    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to open the local side panel:',
      cause: failure,
    });
  });

  test('rolls back a failed local close in memory', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: false,
      existingTabIds: [1],
    });
    await fake.installed.ready;
    const failure = new Error('close failed');
    fake.platform.closeLocal.mockRejectedValueOnce(failure);

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();
    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.platform.closeLocal).toHaveBeenCalledTimes(2);
    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to close the local side panel:',
      cause: failure,
    });
  });

  test('treats a pinned click without window id as a local toggle', async () => {
    const fake = install({
      storedLocalTabIds: [],
      storedPinned: true,
      existingTabIds: [1],
    });
    await fake.installed.ready;

    fake.emit({ type: 'action-clicked', tabId: 1 });
    await settlePromises();

    expect(fake.platform.openLocal).toHaveBeenCalledWith(1);
    expect(fake.platform.closeGlobal).not.toHaveBeenCalled();
  });

  test('closes global mode and clears state after a pinned action click', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: true,
      existingTabIds: [1],
    });
    await fake.installed.ready;

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.platform.closeGlobal).toHaveBeenCalledWith(10);
    expect(fake.platform.persistPinned).toHaveBeenCalledWith(false);
    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([]);
    expect(fake.platform.closeEveryPanelInWindow).toHaveBeenCalledWith(10);
  });

  test('closes the pinned panel in its source window after a click in another window', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: true,
      storedPinnedWindowId: 10,
      existingTabIds: [1, 2],
    });
    await fake.installed.ready;

    fake.emit({ type: 'action-clicked', tabId: 2, windowId: 20 });
    await settlePromises();

    expect(fake.platform.closeGlobal).toHaveBeenCalledWith(10);
    expect(fake.platform.closeGlobal).not.toHaveBeenCalledWith(20);
    expect(fake.platform.closeEveryPanelInWindow).toHaveBeenCalledWith(10);
  });

  test('reports failure without cleanup when closing the global panel fails', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: true,
      existingTabIds: [1],
    });
    await fake.installed.ready;
    const failure = new Error('global close failed');
    fake.platform.closeGlobal.mockRejectedValueOnce(failure);

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.platform.persistPinned).not.toHaveBeenCalled();
    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to close the global side panel:',
      cause: failure,
    });
  });

  test('handles activated tabs in local and pinned modes', async () => {
    const local = install({
      storedLocalTabIds: [1],
      storedPinned: false,
      existingTabIds: [1, 2],
    });
    await local.installed.ready;
    local.emit({ type: 'tab-activated', tabId: 1 });
    local.emit({ type: 'tab-activated', tabId: 2 });
    await settlePromises();
    expect(local.platform.closeLocal).toHaveBeenCalledTimes(1);
    expect(local.platform.closeLocal).toHaveBeenCalledWith(2);

    const pinned = install({
      storedLocalTabIds: [1],
      storedPinned: true,
      existingTabIds: [1, 2],
    });
    await pinned.installed.ready;
    pinned.emit({ type: 'tab-activated', tabId: 1 });
    pinned.emit({ type: 'tab-activated', tabId: 2 });
    await settlePromises();
    expect(pinned.platform.persistLocalTabs).toHaveBeenLastCalledWith([]);
    expect(pinned.platform.closeLocal).not.toHaveBeenCalled();
  });

  test('persists removal only for a tracked tab', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: false,
      existingTabIds: [1, 2],
    });
    await fake.installed.ready;
    fake.platform.persistLocalTabs.mockClear();

    fake.emit({ type: 'tab-removed', tabId: 2 });
    fake.emit({ type: 'tab-removed', tabId: 1 });
    await settlePromises();

    expect(fake.platform.persistLocalTabs).toHaveBeenCalledTimes(1);
    expect(fake.platform.persistLocalTabs).toHaveBeenCalledWith([]);
  });

  test('closes global mode only once for concurrent close notifications', async () => {
    const cleanup = deferred<undefined>();
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: true,
      existingTabIds: [1],
    });
    await fake.installed.ready;
    fake.platform.closeEveryPanelInWindow.mockReturnValueOnce(cleanup.promise);

    fake.emit({ type: 'panel-closed', tabId: 1, windowId: 10 });
    fake.emit({ type: 'panel-closed', tabId: 1, windowId: 10 });
    await settlePromises();
    expect(fake.platform.closeEveryPanelInWindow).toHaveBeenCalledTimes(1);

    cleanup.resolve(undefined);
    await settlePromises();
  });

  test('shares cleanup started by onClosed with an action close completion', async () => {
    const closeGlobal = deferred<undefined>();
    const cleanup = deferred<undefined>();
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: true,
      existingTabIds: [1],
    });
    await fake.installed.ready;
    fake.platform.closeGlobal.mockReturnValueOnce(closeGlobal.promise);
    fake.platform.closeEveryPanelInWindow.mockReturnValueOnce(cleanup.promise);

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    fake.emit({ type: 'panel-closed', tabId: 1, windowId: 10 });
    await settlePromises();

    closeGlobal.resolve(undefined);
    await settlePromises();
    expect(fake.platform.closeEveryPanelInWindow).toHaveBeenCalledTimes(1);

    cleanup.resolve(undefined);
    await settlePromises();
  });

  test('reports global cleanup failure from a close notification', async () => {
    const fake = install({
      storedLocalTabIds: [],
      storedPinned: true,
      existingTabIds: [1],
    });
    await fake.installed.ready;
    const failure = new Error('cleanup failed');
    fake.platform.closeEveryPanelInWindow.mockRejectedValueOnce(failure);

    fake.emit({ type: 'panel-closed', windowId: 10 });
    await settlePromises();

    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to clean up global side panels:',
      cause: failure,
    });
  });

  test('does not exit global mode when a panel closes in another window', async () => {
    const fake = install({
      storedLocalTabIds: [],
      storedPinned: true,
      storedPinnedWindowId: 10,
      existingTabIds: [1, 2],
    });
    await fake.installed.ready;

    fake.emit({ type: 'panel-closed', tabId: 2, windowId: 20 });
    await settlePromises();

    const reply = vi.fn();
    fake.emit({ type: 'get-pin-state', reply });
    await settlePromises();
    expect(reply).toHaveBeenCalledWith({ isPinnedGlobal: true });
    expect(fake.platform.closeEveryPanelInWindow).not.toHaveBeenCalled();
  });
  test('removes local state only for a tracked numeric close notification', async () => {
    const fake = install({
      storedLocalTabIds: [1],
      storedPinned: false,
      existingTabIds: [1, 2],
    });
    await fake.installed.ready;
    fake.platform.persistLocalTabs.mockClear();

    fake.emit({ type: 'panel-closed', windowId: 10 });
    fake.emit({ type: 'panel-closed', tabId: 2, windowId: 10 });
    fake.emit({ type: 'panel-closed', tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.platform.persistLocalTabs).toHaveBeenCalledTimes(1);
    expect(fake.platform.persistLocalTabs).toHaveBeenCalledWith([]);
  });

  test('pins globally and rolls back after a failed pin', async () => {
    const fake = install({
      storedLocalTabIds: [1, 2],
      storedPinned: false,
      existingTabIds: [1, 2],
    });
    await fake.installed.ready;
    const successReply = vi.fn();

    fake.emit({
      type: 'pin-global',
      tabId: 1,
      windowId: 10,
      reply: successReply,
    });
    await settlePromises();
    expect(successReply).toHaveBeenCalledWith({ success: true });

    const failure = new Error('pin failed');
    fake.platform.persistPinnedWindow.mockRejectedValueOnce(failure);
    const failureReply = vi.fn();
    fake.emit({
      type: 'pin-global',
      tabId: 2,
      windowId: 10,
      reply: failureReply,
    });
    await settlePromises();

    expect(failureReply).toHaveBeenCalledWith({
      error: 'Nie udało się przypiąć panelu.',
    });
    expect(fake.platform.persistPinned).toHaveBeenLastCalledWith(false);
    expect(fake.platform.closeGlobal).toHaveBeenCalledWith(10);
    expect(fake.platform.persistLocalTabs).toHaveBeenLastCalledWith([2]);
    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to pin the side panel globally:',
      cause: failure,
    });
  });
  test('clears stale global pin state restored for a closed window', async () => {
    const fake = install({
      storedLocalTabIds: [],
      storedPinned: true,
      storedPinnedWindowId: 10,
      existingTabIds: [1],
      existingWindowIds: [20],
    });
    await fake.installed.ready;

    const reply = vi.fn();
    fake.emit({ type: 'get-pin-state', reply });
    await settlePromises();
    expect(reply).toHaveBeenCalledWith({ isPinnedGlobal: false });
    expect(fake.platform.persistPinned).toHaveBeenCalledWith(false);
    expect(fake.platform.persistPinnedWindow).toHaveBeenCalledWith(undefined);
  });
  test('continues processing events after a reply callback fails', async () => {
    const fake = install();
    await fake.installed.ready;
    const failure = new Error('reply failed');
    fake.emit({
      type: 'panel-init',
      reply: () => {
        throw failure;
      },
    });
    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    await settlePromises();

    expect(fake.platform.openLocal).toHaveBeenCalledWith(1);
    expect(fake.reportError).toHaveBeenCalledWith({
      message: 'Failed to process side panel event:',
      cause: failure,
    });
  });

  test('stops listening through the installed interface', () => {
    const fake = install();
    fake.installed.stop();
    expect(fake.stop).toHaveBeenCalledTimes(1);
  });
});
describe('side panel user gesture', () => {
  test('opens a local panel before the action-click gesture expires', async () => {
    const fake = install();
    await fake.installed.ready;
    let isUserGestureActive = true;
    const userGestureFailure = new Error(
      '`sidePanel.open()` may only be called in response to a user gesture.'
    );
    fake.platform.openLocal.mockImplementation(() =>
      isUserGestureActive
        ? Promise.resolve(undefined)
        : Promise.reject(userGestureFailure)
    );

    fake.emit({ type: 'action-clicked', tabId: 1, windowId: 10 });
    isUserGestureActive = false;
    await settlePromises();

    expect(fake.platform.openLocal).toHaveBeenCalledWith(1);
    expect(fake.reportError).not.toHaveBeenCalledWith({
      message: 'Failed to open the local side panel:',
      cause: userGestureFailure,
    });
  });
});

describe('global side panel user gesture', () => {
  test('opens a global panel before the pin-click gesture expires', async () => {
    const fake = install();
    await fake.installed.ready;
    let isUserGestureActive = true;
    const userGestureFailure = new Error(
      '`sidePanel.open()` may only be called in response to a user gesture.'
    );
    fake.platform.openGlobal.mockImplementation(() =>
      isUserGestureActive
        ? Promise.resolve(undefined)
        : Promise.reject(userGestureFailure)
    );
    const reply = vi.fn();

    fake.emit({
      type: 'pin-global',
      tabId: 1,
      windowId: 10,
      reply,
    });
    isUserGestureActive = false;
    await settlePromises();

    expect(reply).toHaveBeenCalledWith({ success: true });
    expect(fake.reportError).not.toHaveBeenCalledWith({
      message: 'Failed to pin the side panel globally:',
      cause: userGestureFailure,
    });
  });
});
