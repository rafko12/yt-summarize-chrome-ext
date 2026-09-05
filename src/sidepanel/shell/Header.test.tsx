/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { Header } from './Header';

describe('Header', () => {
  test('nagłówek przełącza zakładki oraz udostępnia przypięcie i zmianę motywu', () => {
    const callbacks = {
      selectTab: vi.fn(),
      pin: vi.fn(),
      theme: vi.fn(),
    };

    const { rerender } = render(
      <Header
        activeTab='analyze'
        theme='night'
        isPinned={false}
        onSelectTab={callbacks.selectTab}
        onPin={callbacks.pin}
        onToggleTheme={callbacks.theme}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Historia' }));
    fireEvent.click(screen.getByRole('button', { name: /Przypnij/ }));
    fireEvent.click(screen.getByRole('button', { name: /Zmie/ }));
    expect(callbacks.selectTab).toHaveBeenCalledWith('history');
    expect(callbacks.pin).toHaveBeenCalledOnce();
    expect(callbacks.theme).toHaveBeenCalledOnce();

    rerender(
      <Header
        activeTab='settings'
        theme='nord'
        isPinned
        onSelectTab={callbacks.selectTab}
        onPin={callbacks.pin}
        onToggleTheme={callbacks.theme}
      />
    );
    expect(
      screen.queryByRole('button', { name: /Przypnij/ })
    ).not.toBeInTheDocument();
  });
});
