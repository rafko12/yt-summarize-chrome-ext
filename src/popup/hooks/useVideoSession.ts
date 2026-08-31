import { useCallback, useMemo, useState } from 'react';

import createAnalysisHistory, {
  AnalysisHistory,
} from '../../analysisHistory/analysisHistory';
import createChromeAnalysisHistoryPlatform from '../../analysisHistory/chromeAnalysisHistoryPlatform';
import { TranscriptItem } from '../../llm/types';
import { isErrorResponse } from '../../shared/messages';
import { VideoSession } from '../../shared/video';
import createChromeYoutubePagePlatform from '../youtubePage/chromeYoutubePagePlatform';
import createYoutubePage from '../youtubePage/youtubePage';

interface UseVideoSessionProps {
  onVideoChanged?: () => void;
  historyOverride?: AnalysisHistory;
}

export default function useVideoSession({
  onVideoChanged,
  historyOverride,
}: UseVideoSessionProps = {}) {
  const [currentVideo, setCurrentVideo] = useState<VideoSession | null>(null);
  const [isSearchingVideo, setIsSearchingVideo] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<TranscriptItem[] | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const youtubePage = useMemo(
    () => createYoutubePage(createChromeYoutubePagePlatform()),
    []
  );
  const history = useMemo(
    () =>
      historyOverride ||
      createAnalysisHistory(createChromeAnalysisHistoryPlatform()),
    [historyOverride]
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

      const savedHistory = await history.getRecords();
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
  }, [history, onVideoChanged, youtubePage]);

  // Sync video and fetch transcript if missing
  const ensureVideoAndTranscript = useCallback(
    async (language: string, onInjecting?: () => void) => {
      let targetVideo = currentVideo!;
      const activeVideo = await youtubePage.readActiveVideo(currentVideo!);

      if (activeVideo && activeVideo.videoId !== currentVideo?.videoId) {
        targetVideo = activeVideo;
        setCurrentVideo(targetVideo);
        setTranscript(null);
        onVideoChanged?.();
      }

      // Jeśli transkrypcja z cache i zgadza się videoId
      if (transcript && targetVideo.videoId === currentVideo?.videoId) {
        return { activeTranscript: transcript, targetVideo };
      }

      const response = await youtubePage.fetchActiveTranscript(
        targetVideo.videoId,
        language === 'Polski' ? 'pl' : 'en',
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
