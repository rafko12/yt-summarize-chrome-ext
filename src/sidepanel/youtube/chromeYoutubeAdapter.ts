import {
  ContentMessage,
  ContentResponse,
  TranscriptResponse,
  VideoDataResponse,
} from '../../shared/messages';
import {
  ActiveYoutubeTab,
  TranscriptRequestOptions,
  YoutubeAdapter,
} from './types';

function isMissingContentScriptError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('Could not establish connection') ||
    message.includes('Receiving end does not exist')
  );
}

async function sendContentMessage<M extends ContentMessage>(
  tabId: number,
  message: M
): Promise<ContentResponse<M>> {
  return chrome.tabs.sendMessage(tabId, message);
}

export async function sendMessageToTabWithRetry<M extends ContentMessage>(
  tabId: number,
  message: M,
  options?: TranscriptRequestOptions
): Promise<ContentResponse<M>> {
  try {
    return await sendContentMessage(tabId, message);
  } catch (error: unknown) {
    if (!isMissingContentScriptError(error)) throw error;

    options?.onInjecting?.();
    try {
      const contentScriptFiles =
        chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
      if (contentScriptFiles.length === 0) {
        throw new Error('No content script files found in manifest');
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        files: contentScriptFiles,
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });
      return await sendContentMessage(tabId, message);
    } catch {
      throw new Error(
        'Aby rozszerzenie zadziałało po instalacji lub aktualizacji, odśwież kartę YouTube (F5) i spróbuj ponownie.'
      );
    }
  }
}

export default function createChromeYoutubeAdapter(): YoutubeAdapter {
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
    seekTo(
      tabId: number,
      seconds: number
    ): Promise<{ error: string } | { success: true }> {
      return sendMessageToTabWithRetry(tabId, { type: 'SEEK_TO', seconds });
    },
  };
}
