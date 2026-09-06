import { useEffect } from 'react';

import { Theme } from '../preferences';

export default function useDocumentTheme(theme: Theme): void {
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.add(
        'bg-base-100',
        'text-base-content'
      );
      document.body.classList.add('bg-base-100', 'text-base-content');
    }
  }, [theme]);
}
