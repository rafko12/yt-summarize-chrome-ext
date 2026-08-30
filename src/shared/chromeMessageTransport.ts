import {
  BackgroundMessage,
  BackgroundResponse,
  ContentMessage,
  ContentResponse,
} from './messages';

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
