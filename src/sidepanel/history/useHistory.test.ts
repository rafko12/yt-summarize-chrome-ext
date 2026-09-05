/* @vitest-environment jsdom */

import { MouseEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalysisHistory, AnalysisRecord, useHistory } from './index';

function createMockHistory(
  initialRecords: AnalysisRecord[] = []
): AnalysisHistory {
  let records = [...initialRecords];
  return {
    getRecords: vi.fn(async () => [...records]),
    saveRecord: vi.fn(async (item) => {
      const newRec: AnalysisRecord = { ...item, createdAt: Date.now() };
      records = [newRec, ...records.filter((r) => r.videoId !== item.videoId)];
      return records;
    }),
    updateRecordChat: vi.fn(async (videoId, chat) => {
      records = records.map((r) =>
        r.videoId === videoId ? { ...r, chat } : r
      );
    }),
    deleteRecord: vi.fn(async (videoId) => {
      records = records.filter((r) => r.videoId !== videoId);
      return records;
    }),
    clearRecords: vi.fn(async () => {
      records = [];
    }),
  };
}

const sampleRecord: AnalysisRecord = {
  videoId: 'v1',
  title: 'Tytuł 1',
  author: 'Autor 1',
  thumbnailUrl: 'https://example.com/1.jpg',
  summary: 'Podsumowanie 1',
  transcript: [],
  chat: [],
  createdAt: 1000,
};

describe('useHistory (src/sidepanel/history)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads history on mount', async () => {
    const mockHistory = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useHistory(mockHistory));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.historyList).toEqual([sampleRecord]);
    expect(mockHistory.getRecords).toHaveBeenCalled();
  });

  it('deletes record when confirmed in window.confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockHistory = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useHistory(mockHistory));

    await act(async () => {
      await Promise.resolve();
    });

    const mockEvent = {
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent;

    let deleted = false;
    await act(async () => {
      deleted = await result.current.handleDeleteHistory(mockEvent, 'v1');
    });

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(deleted).toBe(true);
    expect(mockHistory.deleteRecord).toHaveBeenCalledWith('v1');
    expect(result.current.historyList).toEqual([]);
  });

  it('cancels record deletion when rejected in window.confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mockHistory = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useHistory(mockHistory));

    await act(async () => {
      await Promise.resolve();
    });

    const mockEvent = {
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent;

    let deleted = true;
    await act(async () => {
      deleted = await result.current.handleDeleteHistory(mockEvent, 'v1');
    });

    expect(deleted).toBe(false);
    expect(mockHistory.deleteRecord).not.toHaveBeenCalled();
    expect(result.current.historyList).toEqual([sampleRecord]);
  });

  it('clears all history when confirmed in window.confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockHistory = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useHistory(mockHistory));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleClearHistory();
    });

    expect(mockHistory.clearRecords).toHaveBeenCalled();
    expect(result.current.historyList).toEqual([]);
  });

  it('cancels clear history when rejected in window.confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const mockHistory = createMockHistory([sampleRecord]);
    const { result } = renderHook(() => useHistory(mockHistory));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleClearHistory();
    });

    expect(mockHistory.clearRecords).not.toHaveBeenCalled();
    expect(result.current.historyList).toEqual([sampleRecord]);
  });
});
