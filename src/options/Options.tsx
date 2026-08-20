import { JSX } from 'react';
import { Info, Sparkle } from '@phosphor-icons/react';

export default function Options(): JSX.Element {
  return (
    <div
      id='my-ext'
      className='bg-base-100 flex min-h-[100dvh] flex-col items-center justify-center p-8'
      data-theme='night'
    >
      <div className='card bg-base-200 border-base-300 max-w-md border p-6 text-center shadow-xl'>
        <div className='bg-primary/20 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl'>
          <Sparkle weight='fill' className='text-primary h-6 w-6' />
        </div>
        <h1 className='text-base-content mb-2 text-xl font-extrabold tracking-tighter'>
          YT Summarizer
        </h1>
        <p className='text-base-content/85 mb-4 text-xs leading-relaxed'>
          Wszystkie ustawienia (w tym klucze API dostawców oraz wybór języka) są
          dostępne bezpośrednio w <strong>Panelu Bocznym</strong> rozszerzenia.
        </p>
        <div className='alert alert-info inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-left text-xs text-white'>
          <Info weight='bold' className='h-5 w-5 shrink-0' />
          <span>
            Aby je skonfigurować, otwórz dowolny film na YouTube, a następnie
            kliknij ikonę rozszerzenia na pasku zadań przeglądarki.
          </span>
        </div>
      </div>
    </div>
  );
}
