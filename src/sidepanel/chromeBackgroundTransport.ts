import {
  BackgroundMessage,
  BackgroundResponse,
  isPanelNotification,
  PanelNotification,
} from '../messaging';

export default async function sendMessageToBackground<
  M extends BackgroundMessage,
>(message: M): Promise<BackgroundResponse<M>> {
  return chrome.runtime.sendMessage(message);
}

export function listenToPanelNotifications(
  onNotification: (notification: PanelNotification) => void
): () => void {
  const handleRuntimeMessage = (message: unknown): false => {
    if (isPanelNotification(message)) {
      onNotification(message);
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  return () => {
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  };
}
