/* @vitest-environment jsdom */

import { describe, expect, test, vi } from 'vitest';

import createIsolatedRoot from './createIsolatedRoot';

describe('createIsolatedRoot', () => {
  test('creates an interactive extension mount with style fallback', () => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
    const root = createIsolatedRoot('.app { color: red; }');
    const host = document.body.lastElementChild as HTMLDivElement;
    const shadow = host.shadowRoot!;
    const mount = shadow.firstElementChild as HTMLDivElement;

    expect(chrome.runtime.getURL).not.toHaveBeenCalled();
    expect(host.style.pointerEvents).toBe('none');
    expect(mount.style.pointerEvents).toBe('none');
    expect(shadow.querySelector('style')?.textContent).toContain('.app');
    expect(shadow.querySelector('style')?.textContent).toContain('@font-face');
    root.unmount();
  });
});
