/* @vitest-environment jsdom */

import { describe, expect, test } from 'vitest';

import createShadowRoot from './createShadowRoot';

describe('createShadowRoot', () => {
  test('creates an interactive extension mount with style fallback', () => {
    window.history.replaceState({}, '', '/');
    const root = createShadowRoot('.app { color: red; }');
    const host = document.body.lastElementChild as HTMLDivElement;
    const shadow = host.shadowRoot!;
    const mount = shadow.firstElementChild as HTMLDivElement;

    expect(host.style.pointerEvents).toBe('none');
    expect(mount.style.pointerEvents).toBe('none');
    expect(shadow.querySelector('style')?.textContent).toContain('.app');
    expect(shadow.querySelector('style')?.textContent).toContain('@font-face');
    root.unmount();
  });
});
