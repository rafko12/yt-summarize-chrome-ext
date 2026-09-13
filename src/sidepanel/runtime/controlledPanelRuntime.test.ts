import { describe, expect, test, vi } from 'vitest';

import { PanelNotification } from '../../messaging';
import createControlledPanelRuntime from './controlledPanelRuntime';

describe('controlledPanelRuntime', () => {
  test('simulates context presence and absence deterministically', async () => {
    const runtime = createControlledPanelRuntime({
      initialContext: { tabId: 42, windowId: 99 },
    });

    await expect(runtime.getContext()).resolves.toEqual({
      tabId: 42,
      windowId: 99,
    });

    runtime.setContext(null);
    await expect(runtime.getContext()).resolves.toBeNull();

    runtime.setContext({ tabId: 101, windowId: 202 });
    await expect(runtime.getContext()).resolves.toEqual({
      tabId: 101,
      windowId: 202,
    });
  });

  test('simulates panel initialization and records init calls', async () => {
    const runtime = createControlledPanelRuntime({
      initialPinnedGlobal: false,
    });

    expect(runtime.initCalls).toEqual([]);

    const response = await runtime.initialize(55);
    expect(response).toEqual({ isPinnedGlobal: false });
    expect(runtime.initCalls).toEqual([55]);

    runtime.setPinnedGlobal(true);
    const responsePinned = await runtime.initialize(56);
    expect(responsePinned).toEqual({ isPinnedGlobal: true });
    expect(runtime.initCalls).toEqual([55, 56]);
  });

  test('simulates successful global pinning and updates pinned state', async () => {
    const runtime = createControlledPanelRuntime({
      initialPinnedGlobal: false,
    });

    expect(runtime.isPinnedGlobal).toBe(false);
    expect(runtime.pinCalls).toEqual([]);

    const result = await runtime.requestGlobalPin({ tabId: 10, windowId: 20 });
    expect(result).toEqual({ success: true });
    expect(runtime.isPinnedGlobal).toBe(true);
    expect(runtime.pinCalls).toEqual([{ tabId: 10, windowId: 20 }]);
  });

  test('simulates typed error response on global pinning', async () => {
    const runtime = createControlledPanelRuntime();
    runtime.setPinResult({ error: 'Nie udało się przypiąć panelu.' });

    const result = await runtime.requestGlobalPin({ tabId: 10, windowId: 20 });
    expect(result).toEqual({ error: 'Nie udało się przypiąć panelu.' });
    expect(runtime.isPinnedGlobal).toBe(false);
  });

  test('simulates promise rejection on global pinning', async () => {
    const runtime = createControlledPanelRuntime();
    runtime.setPinRejection(new Error('Extension host disconnected'));

    await expect(
      runtime.requestGlobalPin({ tabId: 10, windowId: 20 })
    ).rejects.toThrow('Extension host disconnected');
  });

  test('simulates notification emission and unsubscribe cleanup', () => {
    const runtime = createControlledPanelRuntime();
    const subscriber1 = vi.fn();
    const subscriber2 = vi.fn();

    expect(runtime.listenerCount).toBe(0);

    const unsubscribe1 = runtime.subscribeNotifications(subscriber1);
    const unsubscribe2 = runtime.subscribeNotifications(subscriber2);

    expect(runtime.listenerCount).toBe(2);

    const notification: PanelNotification = {
      type: 'YOUTUBE_URL_UPDATED',
      tabId: 3,
      url: 'https://www.youtube.com/watch?v=movie',
    };

    runtime.emitNotification(notification);

    expect(subscriber1).toHaveBeenCalledWith(notification);
    expect(subscriber2).toHaveBeenCalledWith(notification);

    unsubscribe1();
    expect(runtime.listenerCount).toBe(1);

    runtime.emitNotification(notification);
    expect(subscriber1).toHaveBeenCalledTimes(1);
    expect(subscriber2).toHaveBeenCalledTimes(2);

    unsubscribe2();
    expect(runtime.listenerCount).toBe(0);
  });
});
