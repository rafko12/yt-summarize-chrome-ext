import { sendMessageToTabWithRetry } from '../../shared/chromeMessageTransport';
import { TranscriptResponse, VideoDataResponse } from '../../shared/messages';
import {
  ActiveYoutubeTab,
  TranscriptRequestOptions,
  YoutubePagePlatform,
} from './youtubePage';

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
    getTranscript(
      tabId: number,
      videoId: string,
      targetLang: string,
      options?: TranscriptRequestOptions
    ): Promise<TranscriptResponse | { error: string }> {
      return sendMessageToTabWithRetry(
        tabId,
        { type: 'GET_TRANSCRIPT', videoId, targetLang },
        options
      );
    },
    seekTo(tabId: number, seconds: number) {
      return sendMessageToTabWithRetry(tabId, { type: 'SEEK_TO', seconds });
    },
  };
}
