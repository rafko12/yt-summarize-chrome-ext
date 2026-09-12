import { describe, expect, it } from 'vitest';

import { createChromeStorageLocalAdapter, STORAGE_KEYS } from '../../storage';
import { createAnalysisHistory } from './index';

describe('History Module public seam (src/sidepanel/history)', () => {
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

    const adapter = createChromeStorageLocalAdapter(mockStorageLocal);
    const history = createAnalysisHistory(adapter);

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
