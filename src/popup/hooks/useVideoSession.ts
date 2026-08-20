import { useCallback, useState } from 'react';

import { TranscriptItem } from '../../llm/types';
import {
  isErrorResponse,
  sendMessageToTabWithRetry,
} from '../../shared/messages';
import { VideoSession } from '../../shared/video';
import { getHistory } from '../../utils/storage';

interface UseVideoSessionProps {
  onVideoChanged?: () => void;
}

export default function useVideoSession({
  onVideoChanged,
}: UseVideoSessionProps = {}) {
  const [currentVideo, setCurrentVideo] = useState<VideoSession | null>(null);
  const [isSearchingVideo, setIsSearchingVideo] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<TranscriptItem[] | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const loadActiveVideo = useCallback(async () => {
    setIsSearchingVideo(true);
    setVideoError(null);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (
        !tab ||
        !tab.id ||
        !tab.url ||
        !tab.url.includes('youtube.com/watch')
      ) {
        setCurrentVideo(null);
        setTranscript(null);
        onVideoChanged?.();
        return null;
      }

      const url = new URL(tab.url);
      const videoId = url.searchParams.get('v');
      if (videoId) {
        const savedHistory = await getHistory();
        const existingSession = savedHistory.find(
          (item) => item.videoId === videoId
        );

        if (existingSession) {
          setCurrentVideo({
            videoId: existingSession.videoId,
            title: existingSession.title,
            author: existingSession.author,
            thumbnailUrl: existingSession.thumbnailUrl,
          });
          setTranscript(existingSession.transcript);
          // Don't call onVideoChanged here if we are restoring from history,
          // but wait, if it's a completely new URL, we SHOULD reset analysis state, but then RESTORE the analysis state.
          // Wait, if it's in history, `usePopupState` did: `setSummary(existingSession.summary); setChatMessages(...)`
          // We can't do that here since we don't have those setters.
          // To fix this, `loadActiveVideo` can RETURN the `existingSession` so the caller can restore it.
          // Or we let `PopupContainer` handle the history restoration via `onRestoreSession(existingSession)`.
          // For now, let's return the session if found.
          return existingSession;
        }
      }

      // Not in history
      try {
        const response = await sendMessageToTabWithRetry(tab.id, {
          type: 'GET_VIDEO_DATA',
        });
        if (!isErrorResponse(response)) {
          setCurrentVideo({
            videoId: response.videoId,
            title: response.title,
            author: response.author,
            thumbnailUrl: response.thumbnailUrl,
          });
          setTranscript(null);
          onVideoChanged?.();
        } else {
          // Fallback parsing from Tab details directly
          const fallbackVideoId = url.searchParams.get('v');
          if (fallbackVideoId) {
            setCurrentVideo({
              videoId: fallbackVideoId,
              title: tab.title || 'Film YouTube',
              author: 'YouTube Creator',
              thumbnailUrl: `https://img.youtube.com/vi/${fallbackVideoId}/hqdefault.jpg`,
            });
            setTranscript(null);
            onVideoChanged?.();
          }
        }
      } catch (err) {
        // Content script might not be injected yet
        const fallbackVideoId = url.searchParams.get('v');
        if (fallbackVideoId) {
          setCurrentVideo({
            videoId: fallbackVideoId,
            title: tab.title || 'Film YouTube',
            author: 'YouTube Creator',
            thumbnailUrl: `https://img.youtube.com/vi/${fallbackVideoId}/hqdefault.jpg`,
          });
          setTranscript(null);
          onVideoChanged?.();
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error loading video details:', err);
    } finally {
      setIsSearchingVideo(false);
    }
    return null;
  }, [onVideoChanged]);

  // Sync video and fetch transcript if missing
  const ensureVideoAndTranscript = useCallback(
    async (language: string, onInjecting?: () => void) => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || !tab.id) {
        throw new Error('Nie znaleziono aktywnej karty.');
      }

      const url = new URL(tab.url || '');
      const currentTabVideoId = url.searchParams.get('v');

      let targetVideo = currentVideo!;

      if (currentTabVideoId && currentTabVideoId !== currentVideo?.videoId) {
        try {
          const response = await sendMessageToTabWithRetry(tab.id, {
            type: 'GET_VIDEO_DATA',
          });
          if (!isErrorResponse(response)) {
            targetVideo = {
              videoId: response.videoId,
              title: response.title,
              author: response.author,
              thumbnailUrl: response.thumbnailUrl,
            };
          } else {
            targetVideo = {
              ...currentVideo!,
              videoId: currentTabVideoId,
              title: tab.title || 'Film YouTube',
              thumbnailUrl: `https://img.youtube.com/vi/${currentTabVideoId}/hqdefault.jpg`,
            };
          }
        } catch (e) {
          targetVideo = {
            ...currentVideo!,
            videoId: currentTabVideoId,
            title: tab.title || 'Film YouTube',
            thumbnailUrl: `https://img.youtube.com/vi/${currentTabVideoId}/hqdefault.jpg`,
          };
        }
        setCurrentVideo(targetVideo);
        setTranscript(null);
        onVideoChanged?.();
      }

      // Jeśli transkrypcja z cache i zgadza się videoId
      if (transcript && targetVideo.videoId === currentVideo?.videoId) {
        return { activeTranscript: transcript, targetVideo };
      }

      const response = await sendMessageToTabWithRetry(
        tab.id,
        {
          type: 'GET_TRANSCRIPT',
          videoId: targetVideo.videoId,
          targetLang: language === 'Polski' ? 'pl' : 'en',
        },
        { onInjecting }
      );

      if (isErrorResponse(response) || response.transcript.length === 0) {
        throw new Error(
          isErrorResponse(response)
            ? response.error
            : 'Nie udało się pobrać transkrypcji dla tego filmu.'
        );
      }

      setTranscript(response.transcript);
      return { activeTranscript: response.transcript, targetVideo };
    },
    [currentVideo, onVideoChanged, transcript]
  );

  return {
    currentVideo,
    setCurrentVideo,
    isSearchingVideo,
    transcript,
    setTranscript,
    videoError,
    setVideoError,
    loadActiveVideo,
    ensureVideoAndTranscript,
  };
}
