import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

import createAnalysisHistory from './analysisHistory';
import createChromeAnalysisHistoryAdapter from './chromeAnalysisHistoryAdapter';
import { AnalysisHistory, AnalysisRecord } from './types';

export default function useHistory(historyOverride?: AnalysisHistory) {
  const history = useMemo(
    () =>
      historyOverride ||
      createAnalysisHistory(createChromeAnalysisHistoryAdapter()),
    [historyOverride]
  );
  const [historyList, setHistoryList] = useState<AnalysisRecord[]>([]);

  const loadHistory = useCallback(async () => {
    const savedHistory = await history.getRecords();
    setHistoryList(savedHistory);
  }, [history]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleDeleteHistory = async (e: MouseEvent, videoId: string) => {
    e.stopPropagation();
    // eslint-disable-next-line no-alert
    if (window.confirm('Czy chcesz usunąć to podsumowanie z historii?')) {
      const updated = await history.deleteRecord(videoId);
      setHistoryList(updated);
      return true; // Indicate it was deleted
    }
    return false;
  };

  const handleClearHistory = async () => {
    if (
      // eslint-disable-next-line no-alert -- intentional user confirmation
      window.confirm('Czy na pewno chcesz usunąć całą historię podsumowań?')
    ) {
      await history.clearRecords();
      setHistoryList([]);
    }
  };

  return {
    historyList,
    loadHistory,
    handleDeleteHistory,
    handleClearHistory,
  };
}
