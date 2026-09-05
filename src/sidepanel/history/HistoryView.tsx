import { ClockCounterClockwise, Trash } from '@phosphor-icons/react';

import { AnalysisRecord, HistoryItem, HistoryViewProps } from './types';

export type { AnalysisRecord, HistoryItem, HistoryViewProps };

export default function HistoryView({
  historyList,
  onResumeSession,
  onDeleteHistory,
}: HistoryViewProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'>
      <h2 className='flex items-center gap-1.5 text-sm font-bold'>
        <ClockCounterClockwise weight='bold' className='text-primary h-4 w-4' />
        Zapisane Sesje ({historyList.length})
      </h2>

      {historyList.length === 0 ? (
        <div className='text-base-content/80 py-8 text-center text-xs'>
          Brak wcześniejszych podsumowań.
          <br />
          Podsumuj film na YouTube, aby pojawił się na tej liście.
        </div>
      ) : (
        <div className='space-y-2.5'>
          {historyList.map((item) => (
            <div
              key={item.videoId}
              role='button'
              tabIndex={0}
              onClick={() => onResumeSession(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onResumeSession(item);
                }
              }}
              className='card-compact bg-base-100 border-base-200 hover:border-primary/30 card card-side hover:bg-base-50 group flex cursor-pointer items-center rounded-xl border p-2 shadow-sm transition-all'
            >
              <figure className='relative h-10 w-16 shrink-0 overflow-hidden rounded-md shadow-sm'>
                <img
                  src={item.thumbnailUrl}
                  alt='Thumbnail'
                  className='h-full w-full object-cover'
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://www.youtube.com/img/desktop/yt_1200.png';
                  }}
                />
              </figure>
              <div className='min-w-0 flex-grow pl-2.5 pr-2'>
                <h3 className='text-base-content group-hover:text-primary truncate text-xs font-bold transition-colors'>
                  {item.title}
                </h3>
                <p className='text-base-content/75 mt-0.5 truncate text-[11px]'>
                  {item.author}
                </p>
              </div>
              <div className='flex shrink-0 gap-1'>
                <button
                  type='button'
                  onClick={(e) => onDeleteHistory(e, item.videoId)}
                  className='btn btn-ghost btn-xs text-error hover:bg-error/15 btn-circle'
                  title='Usuń'
                  aria-label='Usuń z historii'
                >
                  <Trash weight='fill' className='h-3.5 w-3.5' />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
