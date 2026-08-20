export interface ErrorResponse {
  error: string;
}

export interface SuccessResponse {
  success: true;
}

export interface VideoDataResponse extends SuccessResponse {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
}

export interface TranscriptItemResponse {
  start: number;
  duration: number;
  text: string;
}

export interface TranscriptResponse extends SuccessResponse {
  transcript: TranscriptItemResponse[];
}

export interface PinStateResponse extends SuccessResponse {
  isPinnedGlobal: boolean;
}

export type ExtensionResponse =
  | VideoDataResponse
  | TranscriptResponse
  | PinStateResponse
  | SuccessResponse
  | ErrorResponse;

export interface GetVideoDataMessage {
  type: 'GET_VIDEO_DATA';
}

export interface GetTranscriptMessage {
  type: 'GET_TRANSCRIPT';
  videoId: string;
  targetLang: string;
}

export interface SeekToMessage {
  type: 'SEEK_TO';
  seconds: number;
}

export interface PanelInitMessage {
  type: 'PANEL_INIT';
  tabId: number;
}

export interface PinGlobalMessage {
  type: 'PIN_GLOBAL';
  tabId: number;
  windowId: number;
}

export interface YoutubeUrlUpdatedMessage {
  type: 'YOUTUBE_URL_UPDATED';
  url: string;
  tabId: number;
}

export interface GetPinStateMessage {
  type: 'GET_PIN_STATE';
}

export type ContentMessage =
  | GetVideoDataMessage
  | GetTranscriptMessage
  | SeekToMessage;
export type BackgroundMessage =
  | PanelInitMessage
  | PinGlobalMessage
  | YoutubeUrlUpdatedMessage
  | GetPinStateMessage;

export type ExtensionMessage = ContentMessage | BackgroundMessage;

type ContentResponseMap = {
  GET_VIDEO_DATA: VideoDataResponse | ErrorResponse;
  GET_TRANSCRIPT: TranscriptResponse | ErrorResponse;
  SEEK_TO: SuccessResponse | ErrorResponse;
};

type BackgroundResponseMap = {
  PANEL_INIT: PinStateResponse;
  PIN_GLOBAL: SuccessResponse | ErrorResponse;
  YOUTUBE_URL_UPDATED: undefined;
  GET_PIN_STATE: PinStateResponse;
};

export type ContentResponse<M extends ContentMessage> =
  ContentResponseMap[M['type']];
export type BackgroundResponse<M extends BackgroundMessage> =
  BackgroundResponseMap[M['type']];

export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    response !== null &&
    typeof response === 'object' &&
    'error' in response &&
    typeof response.error === 'string'
  );
}

export function isContentMessage(message: unknown): message is ContentMessage {
  if (message === null || typeof message !== 'object' || !('type' in message)) {
    return false;
  }

  switch (message.type) {
    case 'GET_VIDEO_DATA':
      return true;
    case 'GET_TRANSCRIPT':
      return (
        'videoId' in message &&
        typeof message.videoId === 'string' &&
        'targetLang' in message &&
        typeof message.targetLang === 'string'
      );
    case 'SEEK_TO':
      return 'seconds' in message && typeof message.seconds === 'number';
    default:
      return false;
  }
}

export function isBackgroundMessage(
  message: unknown
): message is BackgroundMessage {
  if (message === null || typeof message !== 'object' || !('type' in message)) {
    return false;
  }

  switch (message.type) {
    case 'PANEL_INIT':
      return 'tabId' in message && typeof message.tabId === 'number';
    case 'PIN_GLOBAL':
      return (
        'tabId' in message &&
        typeof message.tabId === 'number' &&
        'windowId' in message &&
        typeof message.windowId === 'number'
      );
    case 'YOUTUBE_URL_UPDATED':
      return (
        'tabId' in message &&
        typeof message.tabId === 'number' &&
        'url' in message &&
        typeof message.url === 'string'
      );
    case 'GET_PIN_STATE':
      return true;
    default:
      return false;
  }
}

export interface SendMessageOptions {
  onInjecting?: () => void;
}

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
  options?: SendMessageOptions
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

export async function sendMessageToBackground<M extends BackgroundMessage>(
  message: M
): Promise<BackgroundResponse<M>> {
  return chrome.runtime.sendMessage(message);
}
