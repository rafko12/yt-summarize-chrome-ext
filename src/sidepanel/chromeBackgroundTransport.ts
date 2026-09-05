import { BackgroundMessage, BackgroundResponse } from '../shared/messages';

export default async function sendMessageToBackground<
  M extends BackgroundMessage,
>(message: M): Promise<BackgroundResponse<M>> {
  return chrome.runtime.sendMessage(message);
}
