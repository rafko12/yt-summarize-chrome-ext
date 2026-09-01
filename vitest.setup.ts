import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

const runtimeMessageListeners = new Set<
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => boolean | void
>();

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    } as unknown as typeof chrome.storage.local,
  } as unknown as typeof chrome.storage,
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  } as unknown as typeof chrome.tabs,
  runtime: {
    id: 'test-ext-id',
    getManifest: vi.fn(() => ({ version: '1.0.0' })),
    getURL: vi.fn((path) => `chrome-extension://test-ext-id/${path}`),
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((listener) => runtimeMessageListeners.add(listener)),
      removeListener: vi.fn((listener) =>
        runtimeMessageListeners.delete(listener)
      ),
      hasListener: vi.fn((listener) => runtimeMessageListeners.has(listener)),
    },
    lastError: undefined,
  } as unknown as typeof chrome.runtime,
} as unknown as typeof chrome;
