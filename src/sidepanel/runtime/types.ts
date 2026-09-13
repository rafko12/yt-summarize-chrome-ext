import {
  ErrorResponse,
  PanelNotification,
  PinStateResponse,
  SuccessResponse,
} from '../../messaging';

export interface SidePanelContext {
  tabId: number;
  windowId: number;
}

export type PinResult = SuccessResponse | ErrorResponse;

export interface PanelRuntime {
  getContext(): Promise<SidePanelContext | null>;
  initialize(tabId: number): Promise<PinStateResponse>;
  requestGlobalPin(context: SidePanelContext): Promise<PinResult>;
  subscribeNotifications(
    onNotification: (notification: PanelNotification) => void
  ): () => void;
}
