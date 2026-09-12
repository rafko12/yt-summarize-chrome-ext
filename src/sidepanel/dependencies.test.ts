import { describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../storage';
import { StorageAdapter } from '../storage/types';
import {
  createSidePanelDependencies,
  SidePanelDependencies,
} from './dependencies';

describe('Composition Root dependencies (src/sidepanel/dependencies)', () => {
  it('creates production dependencies with a single shared storage adapter for preferences and history', async () => {
    const memoryStore: Record<string, unknown> = {};
    const readSpy = vi.fn(async (keys: readonly string[]) =>
      Object.fromEntries(keys.map((k) => [k, memoryStore[k]]))
    );
    const writeSpy = vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(memoryStore, values);
    });

    const mockStorageAdapter: StorageAdapter = {
      read: readSpy,
      write: writeSpy,
    };

    const deps: SidePanelDependencies = createSidePanelDependencies({
      storage: mockStorageAdapter,
    });

    expect(deps.preferences).toBeDefined();
    expect(deps.history).toBeDefined();
    expect(deps.youtube).toBeDefined();
    expect(deps.aiClient).toBeDefined();

    // Verify storage adapter is shared: write through preferences and read/write through history
    await deps.preferences.setApiKey('gemini', 'test-key-gemini');
    expect(writeSpy).toHaveBeenCalled();

    await deps.history.saveRecord({
      videoId: 'vid-123',
      title: 'Title',
      author: 'Author',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      summary: 'Summary',
      transcript: [],
      chat: [],
    });

    expect(writeSpy).toHaveBeenCalledTimes(2);
    // Both modules operate on the exact same underlying storage
    expect(memoryStore[STORAGE_KEYS.GEMINI_API_KEY]).toBe('test-key-gemini');
    expect(Array.isArray(memoryStore[STORAGE_KEYS.HISTORY])).toBe(true);
  });

  it('instantiates youtube integration and ai client in composition root', async () => {
    const deps = createSidePanelDependencies();

    // YouTube integration exposes canonical public methods
    expect(typeof deps.youtube.readActiveFilm).toBe('function');
    expect(typeof deps.youtube.fetchActiveTranscript).toBe('function');
    expect(typeof deps.youtube.seekToTimestamp).toBe('function');

    // AI client exposes canonical public methods
    expect(typeof deps.aiClient.validateApiKey).toBe('function');
    expect(typeof deps.aiClient.generateSummary).toBe('function');
    expect(typeof deps.aiClient.generateChatResponse).toBe('function');
    expect(typeof deps.aiClient.getProvider).toBe('function');
  });
});
