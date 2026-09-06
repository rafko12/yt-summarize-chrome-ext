/* @vitest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { Theme } from '../preferences';
import useDocumentTheme from './useDocumentTheme';

describe('useDocumentTheme (src/sidepanel/shell)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.className = '';
    document.body.className = '';
  });

  it('synchronizes data-theme and utility classes to documentElement and body', () => {
    const { rerender } = renderHook(
      ({ theme }: { theme: Theme }) => useDocumentTheme(theme),
      {
        initialProps: { theme: 'night' as Theme },
      }
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
    expect(document.documentElement.classList.contains('bg-base-100')).toBe(
      true
    );
    expect(
      document.documentElement.classList.contains('text-base-content')
    ).toBe(true);
    expect(document.body.classList.contains('bg-base-100')).toBe(true);
    expect(document.body.classList.contains('text-base-content')).toBe(true);

    rerender({ theme: 'nord' });

    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');
  });
});
