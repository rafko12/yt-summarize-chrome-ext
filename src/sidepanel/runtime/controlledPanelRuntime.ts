import { PanelNotification, PinStateResponse } from '../../messaging';
import { PanelRuntime, PinResult, SidePanelContext } from './types';

export interface ControlledPanelRuntimeOptions {
  initialContext?: SidePanelContext | null;
  initialPinnedGlobal?: boolean;
}

export interface ControlledPanelRuntime extends PanelRuntime {
  context: SidePanelContext | null;
  isPinnedGlobal: boolean;
  pinResult: PinResult | null;
  pinRejection: unknown | null;
  initCalls: number[];
  pinCalls: SidePanelContext[];
  readonly listenerCount: number;
  setContext(context: SidePanelContext | null): void;
  setPinnedGlobal(isPinned: boolean): void;
  setPinResult(result: PinResult | null): void;
  setPinRejection(error: unknown): void;
  emitNotification(notification: PanelNotification): void;
}

const DEFAULT_CONTEXT: SidePanelContext = {
  tabId: 3,
  windowId: 4,
};

export default function createControlledPanelRuntime(
  options: ControlledPanelRuntimeOptions = {}
): ControlledPanelRuntime {
  let currentContext: SidePanelContext | null =
    options.initialContext !== undefined
      ? options.initialContext
      : DEFAULT_CONTEXT;
  let isPinnedGlobalState = options.initialPinnedGlobal ?? false;
  let customPinResult: PinResult | null = null;
  let customPinRejection: unknown | null = null;

  const initCalls: number[] = [];
  const pinCalls: SidePanelContext[] = [];
  const notificationListeners = new Set<
    (notification: PanelNotification) => void
  >();

  const runtime: ControlledPanelRuntime = {
    get context() {
      return currentContext;
    },
    set context(ctx: SidePanelContext | null) {
      currentContext = ctx;
    },
    get isPinnedGlobal() {
      return isPinnedGlobalState;
    },
    set isPinnedGlobal(pinned: boolean) {
      isPinnedGlobalState = pinned;
    },
    get pinResult() {
      return customPinResult;
    },
    set pinResult(result: PinResult | null) {
      customPinResult = result;
    },
    get pinRejection() {
      return customPinRejection;
    },
    set pinRejection(error: unknown) {
      customPinRejection = error;
    },
    initCalls,
    pinCalls,
    get listenerCount() {
      return notificationListeners.size;
    },

    setContext(ctx: SidePanelContext | null) {
      currentContext = ctx;
    },
    setPinnedGlobal(pinned: boolean) {
      isPinnedGlobalState = pinned;
    },
    setPinResult(result: PinResult | null) {
      customPinResult = result;
    },
    setPinRejection(error: unknown) {
      customPinRejection = error;
    },

    async getContext(): Promise<SidePanelContext | null> {
      return currentContext;
    },

    async initialize(tabId: number): Promise<PinStateResponse> {
      initCalls.push(tabId);
      return { isPinnedGlobal: isPinnedGlobalState };
    },

    async requestGlobalPin(context: SidePanelContext): Promise<PinResult> {
      pinCalls.push(context);

      if (customPinRejection !== null) {
        return Promise.reject(customPinRejection);
      }

      if (customPinResult !== null) {
        return customPinResult;
      }

      isPinnedGlobalState = true;
      return { success: true };
    },

    subscribeNotifications(
      onNotification: (notification: PanelNotification) => void
    ): () => void {
      notificationListeners.add(onNotification);
      return () => {
        notificationListeners.delete(onNotification);
      };
    },

    emitNotification(notification: PanelNotification) {
      notificationListeners.forEach((listener) => {
        listener(notification);
      });
    },
  };

  return runtime;
}
