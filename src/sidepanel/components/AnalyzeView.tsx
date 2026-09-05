import { FormEvent, RefObject } from 'react';
import {
  ArrowUpRight,
  CircleNotch,
  DotsThree,
  FilmStrip,
  Key,
  Sparkle,
} from '@phosphor-icons/react';

import { Settings } from '../../utils/storage';
import { ChatMessage } from '../ai';
import { MarkdownLine } from './MarkdownWithTimestamps';
import SummaryView from './SummaryView';

interface AnalyzeViewProps {
  hasAnyKey: boolean;
  isSearchingVideo: boolean;
  currentVideo: {
    videoId: string;
    title: string;
    author: string;
    thumbnailUrl: string;
  } | null;
  isLoading: boolean;
  loadingMessage: string;
  summary: string | null;
  chatMessages: ChatMessage[];
  isSendingChat: boolean;
  chatInput: string;
  settings: Settings;
  chatListRef: RefObject<HTMLDivElement | null>;

  onLoadActiveVideo: () => void;
  onClearChat: () => void;
  onSendChatMessage: (e: FormEvent) => void;
  onChatInputChange: (val: string) => void;
  onSummarizeVideo: () => void;
  onSetActiveTab: (tab: 'analyze' | 'history' | 'settings') => void;
}

export default function AnalyzeView({
  hasAnyKey,
  isSearchingVideo,
  currentVideo,
  isLoading,
  loadingMessage,
  summary,
  chatMessages,
  isSendingChat,
  chatInput,
  settings,
  chatListRef,

  onLoadActiveVideo,
  onClearChat,
  onSendChatMessage,
  onChatInputChange,
  onSummarizeVideo,
  onSetActiveTab,
}: AnalyzeViewProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      {!hasAnyKey && (
        <div className='bg-base-100 hero border-base-300 my-auto rounded-2xl border border-dashed p-6 text-center shadow-sm'>
          <div className='hero-content flex-col gap-4'>
            <Key weight='duotone' className='text-primary mx-auto text-4xl' />
            <h1 className='text-sm font-bold'>Wymagany klucz API</h1>
            <p className='text-base-content/75 max-w-xs text-xs leading-relaxed'>
              Do działania podsumowań potrzebujesz darmowego klucza API. Wklej
              go w zakładce Ustawienia.
            </p>
            <button
              type='button'
              onClick={() => onSetActiveTab('settings')}
              className='btn btn-primary btn-sm mt-2 rounded-lg'
            >
              Skonfiguruj teraz
            </button>
          </div>
        </div>
      )}

      {hasAnyKey && isSearchingVideo && (
        <div className='flex flex-grow flex-col items-center justify-center'>
          <CircleNotch
            weight='bold'
            className='text-primary h-6 w-6 animate-spin'
          />
          <span className='text-base-content/75 mt-2 text-xs'>
            Szukanie aktywnego wideo...
          </span>
        </div>
      )}

      {hasAnyKey && !isSearchingVideo && !currentVideo && (
        <div className='bg-base-100 hero border-base-300 my-auto rounded-2xl border border-dashed p-6 text-center shadow-sm'>
          <div className='hero-content flex-col gap-4'>
            <FilmStrip
              weight='duotone'
              className='text-primary mx-auto text-4xl'
            />
            <h1 className='text-sm font-bold'>Otwórz film na YouTube</h1>
            <p className='text-base-content/75 max-w-xs text-xs leading-relaxed'>
              Przejdź do strony z filmem w serwisie YouTube, a następnie otwórz
              ten panel, aby wygenerować podsumowanie.
            </p>
            <button
              type='button'
              onClick={onLoadActiveVideo}
              className='btn btn-outline btn-sm mt-2 rounded-lg'
            >
              Odśwież
            </button>
          </div>
        </div>
      )}

      {hasAnyKey && !isSearchingVideo && !!currentVideo && (
        <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-2'>
          {/* Video Info Header Card */}
          <div className='bg-base-100 border-base-200 flex shrink-0 items-center rounded-xl border p-2 shadow-sm'>
            <figure className='w-14 shrink-0 overflow-hidden rounded-md'>
              <img
                src={currentVideo.thumbnailUrl}
                alt='Thumbnail'
                className='h-9 w-full object-cover shadow-sm'
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.youtube.com/img/desktop/yt_1200.png';
                }}
              />
            </figure>
            <div className='flex min-w-0 flex-grow flex-col justify-center pl-2.5 pr-1'>
              <h3
                className='text-base-content truncate text-xs font-bold'
                title={currentVideo.title}
              >
                {currentVideo.title}
              </h3>
              <p className='text-base-content/75 truncate text-[11px]'>
                {currentVideo.author || 'Twórca YouTube'}
              </p>
            </div>
          </div>

          {!isLoading && (
            <div className='flex shrink-0 flex-col'>
              <div className='bg-base-100 border-base-200 flex shrink-0 flex-col rounded-xl border shadow-sm'>
                {chatMessages.length > 0 && (
                  <div className='bg-base-100 border-base-200 flex items-center justify-between border-b px-3 py-1.5'>
                    <span className='text-base-content/75 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider'>
                      <span className='bg-success h-1.5 w-1.5 rounded-full' />
                      Czat z AI o tym filmie
                    </span>
                    <button
                      type='button'
                      onClick={onClearChat}
                      className='btn-2xs btn btn-ghost hover:text-error rounded'
                    >
                      Wyczyść
                    </button>
                  </div>
                )}

                {(chatMessages.length > 0 || isSendingChat) && (
                  <div ref={chatListRef} className='space-y-2.5 px-3 py-2.5'>
                    {chatMessages.map((msg) => (
                      <div
                        key={`chat-${msg.role}-${msg.message.slice(0, 20).replace(/\s/g, '_')}`}
                        className={`chat ${msg.role === 'user' ? 'chat-end' : 'chat-start'}`}
                      >
                        <div className='chat-header mb-0.5 text-[11px] font-medium opacity-80'>
                          {msg.role === 'user' ? 'Ty' : 'AI'}
                        </div>
                        <div
                          className={`chat-bubble max-w-[85%] break-words text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'chat-bubble-primary text-primary-content shadow-sm'
                              : 'chat-bubble-base-300 bg-base-300/80 text-base-content shadow-sm'
                          }`}
                        >
                          <MarkdownLine text={msg.message} />
                        </div>
                      </div>
                    ))}
                    {isSendingChat && (
                      <div className='chat chat-start'>
                        <div className='chat-header mb-0.5 text-[11px] font-medium opacity-80'>
                          AI
                        </div>
                        <div className='chat-bubble-base-300 bg-base-300/60 chat-bubble p-2.5 shadow-sm'>
                          <DotsThree
                            weight='bold'
                            className='h-4 w-4 animate-pulse'
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <form
                  onSubmit={onSendChatMessage}
                  className={`bg-base-100 flex items-center gap-1.5 p-1.5 ${chatMessages.length === 0 ? 'rounded-xl' : ''}`}
                >
                  <input
                    type='text'
                    value={chatInput}
                    onChange={(e) => onChatInputChange(e.target.value)}
                    placeholder='Zadaj pytanie o film...'
                    className='input-bordered input input-sm bg-base-100 focus:border-primary flex-grow rounded-lg text-xs focus:outline-none'
                    disabled={isSendingChat}
                  />
                  <button
                    type='submit'
                    aria-label='Wyślij wiadomość'
                    className='btn btn-primary btn-sm disabled:bg-base-300 disabled:text-base-content/75 rounded-lg border-none px-3 shadow-md active:scale-95'
                    disabled={isSendingChat || !chatInput.trim()}
                  >
                    <ArrowUpRight weight='bold' className='h-3.5 w-3.5' />
                  </button>
                </form>
              </div>
            </div>
          )}

          {!summary && !isLoading && (
            <div
              className={`flex flex-col items-center justify-center ${chatMessages.length > 0 ? 'py-4 opacity-90' : 'my-auto py-8'}`}
            >
              <div className='bg-primary/10 border-primary/20 mb-4 flex h-16 w-16 items-center justify-center rounded-full border'>
                <Sparkle weight='duotone' className='text-primary h-8 w-8' />
              </div>
              <button
                type='button'
                onClick={onSummarizeVideo}
                className='shadow-primary/30 hover:shadow-primary/40 btn btn-primary btn-wide text-primary-content rounded-xl border-none text-sm font-bold shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-95'
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              >
                <Sparkle weight='fill' className='mr-1.5 inline h-4 w-4' />{' '}
                Generuj Podsumowanie AI
              </button>
              <p className='text-base-content/75 mt-3 text-[11px]'>
                Język docelowy:{' '}
                <span className='text-primary font-semibold'>
                  {settings.language}
                </span>
              </p>
            </div>
          )}

          {isLoading && (
            <div className='my-auto flex flex-col items-center justify-center py-8'>
              <CircleNotch
                weight='bold'
                className='text-primary mb-4 h-8 w-8 animate-spin'
              />
              <p className='max-w-xs text-center text-xs font-semibold'>
                {loadingMessage}
              </p>
              <div className='mt-4 flex w-full max-w-xs flex-col gap-2'>
                <div className='bg-base-200 h-4 w-full animate-pulse rounded' />
                <div className='bg-base-200 h-4 w-5/6 animate-pulse rounded' />
                <div className='bg-base-200 h-4 w-4/6 animate-pulse rounded' />
              </div>
            </div>
          )}

          {summary && !isLoading && <SummaryView summary={summary} />}
        </div>
      )}
    </div>
  );
}
