import { describe, expect, it } from 'vitest';

import defaultCreateAnalysisHistory, {
  createAnalysisHistory,
  HistoryView,
  useAnalysisHistory,
} from './index';

describe('History Module public seam (src/sidepanel/history)', () => {
  it('exposes createAnalysisHistory factory and default export', () => {
    expect(createAnalysisHistory).toBeDefined();
    expect(typeof createAnalysisHistory).toBe('function');
    expect(defaultCreateAnalysisHistory).toBe(createAnalysisHistory);
  });

  it('exposes useAnalysisHistory hook', () => {
    expect(useAnalysisHistory).toBeDefined();
    expect(typeof useAnalysisHistory).toBe('function');
  });

  it('exposes HistoryView component', () => {
    expect(HistoryView).toBeDefined();
    expect(typeof HistoryView).toBe('function');
  });

  it('instantiates history directly with shared ChromeStorageLocalAdapter and canonical keys', async () => {
    const memoryStore: Record<string, unknown> = {};
    const mockStorageLocal = {
      get: (
        keys: string | string[],
        cb: (res: Record<string, unknown>) => void
      ) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        cb(Object.fromEntries(keyList.map((k) => [k, memoryStore[k]])));
      },
      set: (items: Record<string, unknown>, cb?: () => void) => {
        Object.assign(memoryStore, items);
        cb?.();
      },
    } as unknown as typeof chrome.storage.local;

    const { createChromeStorageLocalAdapter, STORAGE_KEYS } = await import(
      '../../storage'
    );
    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);
    const history = createAnalysisHistory(adapter);

    expect(typeof history.saveChat).toBe('function');
    expect(
      (history as unknown as Record<string, unknown>).saveSession
    ).toBeUndefined();
    expect(
      (history as unknown as Record<string, unknown>).saveAnalysisSession
    ).toBeUndefined();

    await history.saveChat({
      videoId: 'seam-vid',
      title: 'Seam Title',
      author: 'Author',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      summary: 'Summary',
      transcript: [],
      chat: [{ role: 'user', message: 'Hello seam' }],
    });

    const records = await history.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].videoId).toBe('seam-vid');
    // Verify stored under canonical STORAGE_KEYS.HISTORY
    const rawStored = memoryStore[STORAGE_KEYS.HISTORY] as unknown[];
    expect(rawStored).toHaveLength(1);
  });
});
