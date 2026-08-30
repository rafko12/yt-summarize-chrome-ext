import { useCallback, useMemo, useState } from 'react';

import { TranscriptItem } from '../../llm/types';
import { sendMessageToTabWithRetry } from '../../shared/chromeMessageTransport';
import { isErrorResponse } from '../../shared/messages';
import { VideoSession } from '../../shared/video';
import { getHistory } from '../../utils/storage';
import createChromeYoutubePagePlatform from '../youtubePage/chromeYoutubePagePlatform';
import createYoutubePage from '../youtubePage/youtubePage';

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
  const youtubePage = useMemo(
    () => createYoutubePage(createChromeYoutubePagePlatform()),
    []
  );

  const loadActiveVideo = useCallback(async () => {
    setIsSearchingVideo(true);
    setVideoError(null);
    try {
      const activeVideo = await youtubePage.readActiveVideo();
      if (!activeVideo) {
        setCurrentVideo(null);
        setTranscript(null);
        onVideoChanged?.();
        return null;
      }

      const savedHistory = await getHistory();
      const existingSession = savedHistory.find(
        (item) => item.videoId === activeVideo.videoId
      );

      if (existingSession) {
        setCurrentVideo({
          videoId: existingSession.videoId,
          title: existingSession.title,
          author: existingSession.author,
          thumbnailUrl: existingSession.thumbnailUrl,
        });
        setTranscript(existingSession.transcript);
        return existingSession;
      }

      setCurrentVideo(activeVideo);
      setTranscript(null);
      onVideoChanged?.();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error loading video details:', err);
    } finally {
      setIsSearchingVideo(false);
    }
    return null;
  }, [onVideoChanged, youtubePage]);

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
        const activeVideo = await youtubePage.readActiveVideo();
        if (activeVideo) {
          targetVideo = activeVideo;
        } else {
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
    [currentVideo, onVideoChanged, transcript, youtubePage]
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
