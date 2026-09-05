import { JSX } from 'react';

import { parseTimestamp } from '../../utils/time';
import { createYoutube } from '../youtube';

const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

const youtubePage = createYoutube();

function handleTimestampClick(timeStr: string) {
  const seconds = parseTimestamp(timeStr);

  youtubePage.seekToTimestamp(seconds).catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to seek player:', error);
  });
}
export function MarkdownLine({ text }: { text: string }) {
  const boldParts = text.split('**');

  return boldParts.map((part, boldIdx) => {
    const isBold = boldIdx % 2 !== 0;
    const partKey = `${isBold ? 'b' : 't'}-${part.slice(0, 12)}-${boldIdx}`;
    const subParts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const regex = new RegExp(timestampRegex.source, timestampRegex.flags);
    let match = regex.exec(part);

    while (match !== null) {
      const matchIndex = match.index;
      const timeVal = match[1];
      if (matchIndex > lastIndex)
        subParts.push(part.substring(lastIndex, matchIndex));
      subParts.push(
        <button
          key={`ts-${timeVal}-${matchIndex}`}
          onClick={() => handleTimestampClick(timeVal)}
          className='badge badge-outline badge-primary badge-sm hover:badge-secondary mx-1 cursor-pointer border px-1 py-0 font-mono text-[11px] font-bold transition-all active:scale-95'
          type='button'
        >
          {timeVal}
        </button>
      );
      lastIndex = regex.lastIndex;
      match = regex.exec(part);
    }

    if (lastIndex < part.length) subParts.push(part.substring(lastIndex));
    return isBold ? (
      <strong key={partKey} className='text-base-content font-semibold'>
        {subParts}
      </strong>
    ) : (
      <span key={partKey}>{subParts}</span>
    );
  });
}

export function SummaryMarkdown({ markdown }: { markdown: string }) {
  return markdown.split('\n').map((line, lineIdx) => {
    let cleanLine = line.trim();
    const lineKey = `line-${cleanLine.slice(0, 20).replace(/\s/g, '_')}-${lineIdx}`;
    if (!cleanLine) return <div key={lineKey} className='h-2' />;
    if (cleanLine.startsWith('## ')) {
      return (
        <h2
          key={lineKey}
          className='text-md border-base-200 text-primary mb-2 mt-4 border-b pb-1 font-bold'
        >
          <MarkdownLine text={cleanLine.substring(3)} />
        </h2>
      );
    }
    if (cleanLine.startsWith('### ')) {
      return (
        <h3
          key={lineKey}
          className='text-secondary mb-1 mt-3 text-sm font-semibold'
        >
          <MarkdownLine text={cleanLine.substring(4)} />
        </h3>
      );
    }

    const isBullet =
      cleanLine.startsWith('- ') ||
      cleanLine.startsWith('* ') ||
      /^\d+\.\s/.test(cleanLine);
    if (isBullet) cleanLine = cleanLine.replace(/^(?:[-*]|\d+\.)\s/, '');
    const content = <MarkdownLine text={cleanLine} />;
    return isBullet ? (
      <li
        key={lineKey}
        className='text-base-content/90 my-1 ml-3 list-disc text-[13px] leading-relaxed'
      >
        {content}
      </li>
    ) : (
      <p
        key={lineKey}
        className='text-base-content/95 my-1 text-[13px] leading-relaxed'
      >
        {content}
      </p>
    );
  });
}
