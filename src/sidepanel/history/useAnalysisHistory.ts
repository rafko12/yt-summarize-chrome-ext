import { useCallback, useEffect, useState } from 'react';

import { AnalysisHistory, AnalysisRecord } from './types';

export interface UseAnalysisHistoryProps {
  history: AnalysisHistory;
}

export default function useAnalysisHistory({
  history,
}: UseAnalysisHistoryProps) {
  const [historyList, setHistoryList] = useState<AnalysisRecord[]>([]);

  const loadHistory = useCallback(async () => {
    const savedHistory = await history.getRecords();
    setHistoryList(savedHistory);
  }, [history]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const deleteRecord = useCallback(
    async (videoId: string): Promise<AnalysisRecord[]> => {
      const updated = await history.deleteRecord(videoId);
      setHistoryList(updated);
      return updated;
    },
    [history]
  );

  const clearRecords = useCallback(async (): Promise<void> => {
    await history.clearRecords();
    setHistoryList([]);
  }, [history]);

  return {
    historyList,
    loadHistory,
    deleteRecord,
    clearRecords,
    handleDeleteHistory: deleteRecord,
    handleClearHistory: clearRecords,
  };
}
