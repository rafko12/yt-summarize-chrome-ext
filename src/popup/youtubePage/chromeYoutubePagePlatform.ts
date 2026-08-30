import { sendMessageToTabWithRetry } from '../../shared/chromeMessageTransport';
import { VideoDataResponse } from '../../shared/messages';
import { ActiveYoutubeTab, YoutubePagePlatform } from './youtubePage';

export default function createChromeYoutubePagePlatform(): YoutubePagePlatform {
  return {
    async getActiveTab(): Promise<ActiveYoutubeTab | undefined> {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tab;
    },
    getVideoData(
      tabId: number
    ): Promise<VideoDataResponse | { error: string }> {
      return sendMessageToTabWithRetry(tabId, { type: 'GET_VIDEO_DATA' });
    },
  };
}
