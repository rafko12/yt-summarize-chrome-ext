import { describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS, StorageAdapter } from '../storage';
import {
  createSidePanelDependencies,
  SidePanelDependencies,
} from './compositionRoot';
import { PanelRuntime } from './runtime';

describe('Composition Root (src/sidepanel/compositionRoot)', () => {
  it('creates production dependencies with a single shared storage adapter for settings and history', async () => {
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

    expect(deps.settings).toBeDefined();
    expect(deps.history).toBeDefined();
    expect(deps.youtube).toBeDefined();
    expect(deps.aiClient).toBeDefined();
    expect(deps.runtime).toBeDefined();

    // Verify storage adapter is shared: write through settings and read/write through history
    await deps.settings.setApiKey('gemini', 'test-key-gemini');
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

  it('instantiates youtube integration, ai client, and panel runtime in composition root', async () => {
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

    // Panel runtime exposes canonical public methods
    expect(typeof deps.runtime.getContext).toBe('function');
    expect(typeof deps.runtime.initialize).toBe('function');
    expect(typeof deps.runtime.requestGlobalPin).toBe('function');
    expect(typeof deps.runtime.subscribeNotifications).toBe('function');
  });

  it('allows injecting a custom runtime into composition root', () => {
    const mockRuntime: PanelRuntime = {
      getContext: vi.fn(),
      initialize: vi.fn(),
      requestGlobalPin: vi.fn(),
      subscribeNotifications: vi.fn(),
    };

    const deps = createSidePanelDependencies({
      runtime: mockRuntime,
    });

    expect(deps.runtime).toBe(mockRuntime);
  });

  it('allows injecting a custom youtube adapter into composition root', async () => {
    const mockYoutubeAdapter = {
      getActiveTab: vi.fn(async () => ({
        id: 123,
        url: 'https://www.youtube.com/watch?v=custom-123',
        title: 'Custom Title',
      })),
      getVideoData: vi.fn(async () => ({
        success: true as const,
        videoId: 'custom-123',
        title: 'Custom Title',
        author: 'Custom Author',
        thumbnailUrl: 'https://example.com/custom.jpg',
      })),
      getTranscript: vi.fn(async () => ({
        success: true as const,
        transcript: [{ start: 0, duration: 2, text: 'Custom transcript' }],
      })),
      seekTo: vi.fn(async () => ({ success: true as const })),
    };

    const deps = createSidePanelDependencies({
      youtubeAdapter: mockYoutubeAdapter,
    });

    const film = await deps.youtube.readActiveFilm();
    expect(film).toEqual({
      videoId: 'custom-123',
      title: 'Custom Title',
      author: 'Custom Author',
      thumbnailUrl: 'https://example.com/custom.jpg',
    });
    expect(mockYoutubeAdapter.getActiveTab).toHaveBeenCalled();
  });
});
