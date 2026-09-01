/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import Options from './Options';

describe('Options page', () => {
  test('renders static informational view with night theme and without storage dependencies', () => {
    const { container } = render(<Options />);

    const rootElement = container.querySelector('#my-ext');
    expect(rootElement).toBeInTheDocument();
    expect(rootElement).toHaveAttribute('data-theme', 'night');
    expect(rootElement).toHaveClass(
      'min-h-[100dvh]',
      'flex-col',
      'items-center',
      'justify-center'
    );

    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'YT Summarizer',
    });
    expect(heading).toBeInTheDocument();

    expect(
      screen.getByText(
        /Wszystkie ustawienia \(w tym klucze API dostawców oraz wybór języka\) są dostępne bezpośrednio w/
      )
    ).toBeInTheDocument();

    expect(screen.getByText('Panelu Bocznym')).toBeInTheDocument();

    expect(
      screen.getByText(
        /Aby je skonfigurować, otwórz dowolny film na YouTube, a następnie kliknij ikonę rozszerzenia na pasku zadań przeglądarki\./
      )
    ).toBeInTheDocument();
  });

  test('does not contain any form controls, input fields or storage-bound buttons', () => {
    const { container } = render(<Options />);

    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('select')).toHaveLength(0);
    expect(container.querySelectorAll('textarea')).toHaveLength(0);
    expect(container.querySelectorAll('form')).toHaveLength(0);
  });
});
