import { Moon, PushPin, Sparkle, Sun } from '@phosphor-icons/react';

export type SidePanelTab = 'analyze' | 'history' | 'settings';
export type PopupTab = SidePanelTab;

interface HeaderProps {
  activeTab: SidePanelTab;
  theme: 'night' | 'nord';
  isPinned: boolean;
  onSelectTab: (tab: SidePanelTab) => void;
  onPin: () => void;
  onToggleTheme: () => void;
}

export function Header({
  activeTab,
  theme,
  isPinned,
  onSelectTab,
  onPin,
  onToggleTheme,
}: HeaderProps) {
  const tabClass = (tab: SidePanelTab) =>
    `btn btn-xs rounded-md font-bold transition-all duration-200 ${activeTab === tab ? 'shadow-primary/25 btn-primary text-primary-content shadow-md' : 'bg-base-200/50 text-base-content border-base-200 btn-ghost border hover:bg-base-200 hover:text-base-content'}`;

  return (
    <header className='border-base-300 bg-base-200 flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-y-2 border-b px-3 py-2 shadow-sm'>
      <div className='flex items-center gap-2'>
        <div className='bg-primary/20 flex h-7 w-7 items-center justify-center rounded-lg shadow-md'>
          <Sparkle weight='fill' className='text-primary h-4 w-4' />
        </div>
        <span className='text-base-content text-sm font-extrabold tracking-tighter'>
          YT Summarizer
        </span>
      </div>
      <div className='flex flex-wrap items-center gap-1.5'>
        <button
          type='button'
          onClick={() => onSelectTab('analyze')}
          className={tabClass('analyze')}
        >
          Analizuj
        </button>
        <button
          type='button'
          onClick={() => onSelectTab('history')}
          className={tabClass('history')}
        >
          Historia
        </button>
        <button
          type='button'
          onClick={() => onSelectTab('settings')}
          className={tabClass('settings')}
        >
          Opcje
        </button>
        <div className='divider divider-horizontal mx-0.5 my-2' />
        {!isPinned && (
          <button
            type='button'
            onClick={onPin}
            className='text-base-content/60 hover:text-base-content hover:bg-base-content/10 btn btn-ghost btn-xs btn-circle'
            aria-label='Przypnij do przeglądarki'
          >
            <PushPin className='h-4 w-4' />
          </button>
        )}
        <button
          type='button'
          onClick={onToggleTheme}
          className='text-base-content/85 btn btn-ghost btn-xs btn-circle'
          aria-label='Zmień motyw'
        >
          {theme === 'night' ? (
            <Sun weight='bold' className='h-4 w-4' />
          ) : (
            <Moon weight='bold' className='h-4 w-4' />
          )}
        </button>
      </div>
    </header>
  );
}
