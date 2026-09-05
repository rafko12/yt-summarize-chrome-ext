import { YoutubeUrlUpdatedNotification } from '../shared/messages';

export default function registerYoutubeNavigationEvents(
  chromeApi: typeof chrome
): () => void {
  const onTabUpdated = (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo
  ) => {
    if (!changeInfo.url?.includes('youtube.com/watch')) return;

    const notification: YoutubeUrlUpdatedNotification = {
      type: 'YOUTUBE_URL_UPDATED',
      url: changeInfo.url,
      tabId,
    };

    chromeApi.runtime.sendMessage(notification).catch(() => {
      // The side panel may not be open or listening.
    });
  };

  chromeApi.tabs.onUpdated.addListener(onTabUpdated);
  return () => chromeApi.tabs.onUpdated.removeListener(onTabUpdated);
}
