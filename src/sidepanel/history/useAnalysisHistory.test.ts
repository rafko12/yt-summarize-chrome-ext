/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisRecord } from '../../domain/analysis';
import { AnalysisHistory } from './types';
import useAnalysisHistory from './useAnalysisHistory';

function createMockHistory(
  initialRecords: AnalysisRecord[] = []
): AnalysisHistory {
  let records = [...initialRecords];
  return {
    getRecords: vi.fn(async () => [...records]),
    saveRecord: vi.fn(async () => [...records]),
    updateRecordChat: vi.fn(async () => undefined),
    saveChat: vi.fn(async () => [...records]),
    deleteRecord: vi.fn(async (videoId: string) => {
      records = records.filter((r) => r.videoId !== videoId);
      return [...records];
    }),
    clearRecords: vi.fn(async () => {
      records = [];
    }),
  };
}

const sampleRecord: AnalysisRecord = {
  videoId: 'vid-1',
  title: 'Tytuł 1',
  author: 'Autor 1',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  summary: 'Podsumowanie',
  transcript: [],
  chat: [],
  createdAt: 1000,
};

describe('useAnalysisHistory (src/sidepanel/history)', () => {
  it('loads history records on mount and provides pure application operations', async () => {
    const history = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useAnalysisHistory({ history }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.historyList).toEqual([sampleRecord]);
    expect(history.getRecords).toHaveBeenCalledTimes(1);
  });

  it('deletes record without DOM event and without window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const history = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useAnalysisHistory({ history }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.historyList).toHaveLength(1);

    await act(async () => {
      await result.current.deleteRecord('vid-1');
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(history.deleteRecord).toHaveBeenCalledWith('vid-1');
    expect(result.current.historyList).toEqual([]);
    confirmSpy.mockRestore();
  });

  it('clears all records without window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const history = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useAnalysisHistory({ history }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.historyList).toHaveLength(1);

    await act(async () => {
      await result.current.clearRecords();
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(history.clearRecords).toHaveBeenCalledTimes(1);
    expect(result.current.historyList).toEqual([]);
    confirmSpy.mockRestore();
  });
});
