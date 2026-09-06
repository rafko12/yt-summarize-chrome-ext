import { BackgroundMessage, BackgroundResponse } from '../messaging';

export default async function sendMessageToBackground<
  M extends BackgroundMessage,
>(message: M): Promise<BackgroundResponse<M>> {
  return chrome.runtime.sendMessage(message);
}
