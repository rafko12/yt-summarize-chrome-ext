import { MouseEvent, useEffect, useState } from 'react';

import {
  clearHistory,
  deleteHistoryItem,
  getHistory,
  HistoryItem,
} from '../../utils/storage';

export default function useHistory() {
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  const loadHistory = async () => {
    const savedHistory = await getHistory();
    setHistoryList(savedHistory);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteHistory = async (e: MouseEvent, videoId: string) => {
    e.stopPropagation();
    // eslint-disable-next-line no-alert
    if (window.confirm('Czy chcesz usunąć to podsumowanie z historii?')) {
      const updated = await deleteHistoryItem(videoId);
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
      await clearHistory();
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
