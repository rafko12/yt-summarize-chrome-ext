import { ListDashes } from '@phosphor-icons/react';

import { SummaryMarkdown } from './MarkdownWithTimestamps';

interface SummaryViewProps {
  summary: string;
}

export default function SummaryView({ summary }: SummaryViewProps) {
  return (
    <div className='flex h-0 min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pb-2'>
      <div className='bg-base-100 border-base-200/80 shrink-0 rounded-xl border p-3.5 shadow-sm'>
        <h4 className='text-base-content/75 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider'>
          <ListDashes weight='bold' className='text-primary h-3.5 w-3.5' />
          Podsumowanie filmu
        </h4>
        <div className='prose-sm prose text-xs leading-relaxed'>
          <SummaryMarkdown markdown={summary} />
        </div>
      </div>
    </div>
  );
}
