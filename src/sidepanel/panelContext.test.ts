import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCurrentPanelContext } from './panelContext';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Sidepanel panelContext', () => {
  test('returns tabId and windowId when active tab has both properties', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { id: 42, windowId: 7 } as chrome.tabs.Tab,
    ]);

    const context = await getCurrentPanelContext();

    expect(context).toEqual({ tabId: 42, windowId: 7 });
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
  });

  test('returns null when query returns an empty list', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([]);

    const context = await getCurrentPanelContext();

    expect(context).toBeNull();
  });

  test('returns null when active tab has no id or windowId', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValueOnce([
      { title: 'Untitled' } as chrome.tabs.Tab,
    ]);

    const context = await getCurrentPanelContext();

    expect(context).toBeNull();
  });

  test('returns null when chrome.tabs.query rejects', async () => {
    vi.mocked(chrome.tabs.query).mockRejectedValueOnce(
      new Error('Tabs query failed')
    );

    const context = await getCurrentPanelContext();

    expect(context).toBeNull();
  });
});
