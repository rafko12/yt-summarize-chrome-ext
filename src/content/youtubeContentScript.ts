import { YoutubeTranscript } from 'youtube-transcript';

import {
  ContentMessage,
  ExtensionResponse,
  isContentMessage,
} from '../shared/messages';
import {
  extractPlayerResponseFromText,
  PlayerResponse,
} from './playerResponseExtractor';

async function extractPlayerResponse(videoId: string): Promise<PlayerResponse> {
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i += 1) {
    const text = scripts[i].textContent;
    if (text) {
      const playerResponse = extractPlayerResponseFromText(text, videoId);
      if (playerResponse) return playerResponse;
    }
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error(
      'Nie udało się połączyć z YouTube. Sprawdź połączenie i spróbuj ponownie.'
    );
  }

  if (!response.ok) {
    throw new Error(
      'Nie udało się pobrać danych filmu z YouTube. Spróbuj ponownie za chwilę.'
    );
  }
  const html = await response.text();

  const playerResponse = extractPlayerResponseFromText(html, videoId);
  if (playerResponse) return playerResponse;

  throw new Error(
    'Nie udało się odczytać danych tego filmu z YouTube. Odśwież stronę i spróbuj ponownie.'
  );
}

export default function initializeYoutubeContentScript(): void {
  const handleMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response?: ExtensionResponse) => void
  ): boolean => {
    if (!isContentMessage(message)) return false;
    const msg: ContentMessage = message;

    if (msg.type === 'GET_VIDEO_DATA') {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      if (!videoId) {
        sendResponse({ error: 'Nie jesteś na stronie filmu YouTube.' });
        return false;
      }

      extractPlayerResponse(videoId)
        .then((playerResponse) => {
          const title =
            playerResponse?.videoDetails?.title ||
            document.title ||
            'Film YouTube';
          const author = playerResponse?.videoDetails?.author || '';
          const thumbnailUrl =
            playerResponse?.videoDetails?.thumbnail?.thumbnails?.slice(-1)[0]
              ?.url || '';

          sendResponse({
            success: true,
            videoId,
            title,
            author,
            thumbnailUrl,
          });
        })
        .catch((err: Error) => {
          sendResponse({ error: err.message });
        });

      return true; // Keep message channel open for async response
    }

    if (msg.type === 'GET_TRANSCRIPT') {
      const { videoId, targetLang } = msg;
      if (!videoId) {
        sendResponse({ error: 'Brak identyfikatora wideo.' });
        return false;
      }

      YoutubeTranscript.fetchTranscript(videoId, { lang: targetLang })
        // Fallback: If target language transcript is unavailable, try to fetch the default one
        .catch(() => YoutubeTranscript.fetchTranscript(videoId))
        .then((res) => {
          if (!res || res.length === 0) {
            throw new Error(
              'Transkrypcja jest pusta — film może nie mieć napisów z treścią.'
            );
          }
          const transcript = res.map((item) => {
            // youtube-transcript returns offset/duration in ms for srv3, but seconds for legacy XML.
            // We heuristically convert to seconds if values are large (e.g. > 10000 implies ms).
            const isMs = item.offset > 50000 || item.duration > 10000;
            return {
              start: isMs ? item.offset / 1000 : item.offset,
              duration: isMs ? item.duration / 1000 : item.duration,
              text: item.text,
            };
          });
          sendResponse({ success: true, transcript });
        })
        .catch((err: Error) => {
          sendResponse({
            error: err.message || 'Nie udało się pobrać napisów z YouTube.',
          });
        });

      return true; // Keep message channel open for async response
    }

    if (msg.type === 'SEEK_TO') {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = msg.seconds;
        video.play().catch(() => {});
        sendResponse({ success: true });
      } else {
        sendResponse({
          error: 'Nie znaleziono odtwarzacza wideo na tej stronie.',
        });
      }
      return false;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(handleMessage);
}
