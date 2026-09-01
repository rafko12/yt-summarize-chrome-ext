/* eslint-disable jsx-a11y/label-has-associated-control */
import { CircleNotch, Eye, EyeSlash, Key, Trash } from '@phosphor-icons/react';

import { AI_MODELS, AI_PROVIDERS } from '../../llm/registry';
import { Provider, Settings } from '../../utils/storage';

interface SettingsViewProps {
  selectedProvider: Provider;
  apiKeys: Record<Provider, string>;
  apiKeyInput: string;
  showKey: boolean;
  isCheckingKey: boolean;
  keyValidationMsg: { text: string; success: boolean } | null;
  settings: Settings;
  hasAnyKey: boolean;
  historyListLength: number;
  onSelectProvider: (p: Provider) => void;
  onApiKeyInputChange: (val: string) => void;
  onToggleShowKey: () => void;
  onSaveApiKey: () => void;
  onDeleteApiKey: (p: Provider) => void;
  onModelChange: (val: string) => void;
  onLanguageChange: (val: string) => void;
  onClearHistory: () => void;
  onClearApiKeysAndHistory: () => void;
}

export default function SettingsView({
  selectedProvider,
  apiKeys,
  apiKeyInput,
  showKey,
  isCheckingKey,
  keyValidationMsg,
  settings,
  hasAnyKey,
  historyListLength,
  onSelectProvider,
  onApiKeyInputChange,
  onToggleShowKey,
  onSaveApiKey,
  onDeleteApiKey,
  onModelChange,
  onLanguageChange,
  onClearHistory,
  onClearApiKeysAndHistory,
}: SettingsViewProps) {
  const selectedProviderConfig = AI_PROVIDERS.find(
    (provider) => provider.id === selectedProvider
  )!;

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto'>
      <h2 className='flex items-center gap-1.5 text-sm font-bold'>
        <Key weight='bold' className='text-primary h-4 w-4' />
        Konfiguracja Rozszerzenia
      </h2>

      {/* API Key Form */}
      <div className='bg-base-100 border-base-200 rounded-xl border p-3.5 shadow-sm'>
        <label htmlFor='provider-select' className='label mb-0.5 py-0.5'>
          <span className='label-text text-xs font-bold'>
            Wybierz Dostawcę AI
          </span>
        </label>
        <select
          id='provider-select'
          value={selectedProvider}
          onChange={(e) => onSelectProvider(e.target.value as Provider)}
          className='select-bordered select select-sm bg-base-100 mb-2 w-full rounded-lg text-xs focus:outline-none'
        >
          {AI_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
            </option>
          ))}
        </select>

        <label htmlFor='api-key-input' className='label mb-0.5 py-0.5'>
          <span className='label-text text-xs font-bold'>
            Klucz API ({selectedProviderConfig.apiKeySourceLabel})
          </span>
        </label>

        <div className='mt-0.5 flex items-center gap-2'>
          <div className='relative flex-grow'>
            <input
              id='api-key-input'
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => onApiKeyInputChange(e.target.value)}
              placeholder='Wklej swój klucz API...'
              className='input-bordered input input-sm w-full rounded-lg pr-8 text-xs'
              disabled={isCheckingKey}
            />
            <button
              type='button'
              onClick={onToggleShowKey}
              aria-label={showKey ? 'Ukryj klucz API' : 'Pokaż klucz API'}
              className='text-base-content/75 hover:text-base-content absolute right-2 top-2'
            >
              {showKey ? (
                <EyeSlash weight='bold' className='h-3.5 w-3.5' />
              ) : (
                <Eye weight='bold' className='h-3.5 w-3.5' />
              )}
            </button>
          </div>

          <button
            type='button'
            onClick={onSaveApiKey}
            className='hover:shadow-primary/10 btn btn-primary btn-sm disabled:bg-base-300 disabled:text-base-content/75 rounded-lg text-xs shadow-sm disabled:border-none'
            disabled={isCheckingKey || !apiKeyInput.trim()}
          >
            {isCheckingKey ? (
              <CircleNotch weight='bold' className='h-4 w-4 animate-spin' />
            ) : (
              'Zapisz'
            )}
          </button>
        </div>

        {keyValidationMsg && (
          <div
            className={`mt-1.5 text-[11px] font-semibold ${keyValidationMsg.success ? 'text-success' : 'text-error'}`}
          >
            {keyValidationMsg.text}
          </div>
        )}

        <p className='text-base-content/75 mt-2 text-[11px] leading-relaxed'>
          {selectedProviderConfig.apiKeyHelpPrefix}{' '}
          <a
            href={selectedProviderConfig.apiKeyHelpUrl}
            target='_blank'
            rel='noreferrer'
            className='link link-primary font-semibold'
          >
            {selectedProviderConfig.apiKeyHelpLinkLabel}
          </a>
          .
        </p>

        <div className='border-base-300/50 mt-3 border-t pt-2.5'>
          <h4 className='mb-1.5 text-xs font-bold'>Zapisane klucze:</h4>
          <ul className='space-y-1'>
            {Object.entries(apiKeys).map(([prov, key]) => {
              if (!key) return null;
              return (
                <li
                  key={prov}
                  className='bg-base-100 border-base-300/50 flex items-center justify-between rounded-lg border p-1.5 px-2 text-xs shadow-sm'
                >
                  <div className='flex items-center gap-2'>
                    <span className='text-base-content/90 font-semibold capitalize'>
                      {prov}
                    </span>
                    <span className='text-base-content/75 font-mono text-[11px] tracking-widest'>
                      {key.length > 8
                        ? `${key.slice(0, 4)}••••••${key.slice(-3)}`
                        : '••••••••'}
                    </span>
                  </div>
                  <button
                    type='button'
                    onClick={() => onDeleteApiKey(prov as Provider)}
                    className='btn btn-ghost btn-xs text-error hover:bg-error/15 btn-circle'
                    title='Usuń klucz'
                    aria-label={`Usuń klucz ${prov}`}
                  >
                    <Trash weight='fill' className='h-3.5 w-3.5' />
                  </button>
                </li>
              );
            })}
            {!hasAnyKey && (
              <li className='text-base-content/75 py-1 text-center text-[11px] italic'>
                Brak zapisanych kluczy API
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Combined Model & Language Preferences Card */}
      <div className='bg-base-100 border-base-200 flex flex-col gap-3 rounded-xl border p-3.5 shadow-sm'>
        <div>
          <label htmlFor='model-select' className='label mb-0.5 py-0.5'>
            <span className='label-text text-xs font-bold'>
              Wybór Modelu API
            </span>
          </label>
          {!hasAnyKey ? (
            <div className='text-error/90 bg-error/10 border-error/20 mt-0.5 rounded-lg border p-2 text-center text-[11px] font-semibold'>
              Dodaj klucz API, aby móc wybrać model.
            </div>
          ) : (
            <select
              id='model-select'
              value={settings.model || 'gemini-3.6-flash'}
              onChange={(e) => onModelChange(e.target.value)}
              className='select-bordered select select-sm bg-base-100 mt-0.5 w-full rounded-lg text-xs focus:outline-none'
            >
              {AI_PROVIDERS.map((provider) =>
                apiKeys[provider.id] ? (
                  <optgroup key={provider.id} label={provider.label}>
                    {AI_MODELS.filter(
                      (model) =>
                        model.provider === provider.id &&
                        model.visibleInSettings
                    ).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )}
            </select>
          )}
        </div>

        <div className='border-base-300/40 border-t pt-2'>
          <label htmlFor='language-select' className='label mb-0.5 py-0.5'>
            <span className='label-text text-xs font-bold'>
              Język podsumowania i czatu
            </span>
          </label>
          <select
            id='language-select'
            value={settings.language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className='select-bordered select select-sm bg-base-100 mt-0.5 w-full rounded-lg text-xs focus:outline-none'
          >
            <option value='Polski'>Polski (domyślny)</option>
            <option value='English'>Angielski (English)</option>
          </select>
        </div>
      </div>

      {/* Danger Zone */}
      <div className='bg-error/5 border-error/20 flex flex-col gap-2.5 rounded-xl border p-3.5'>
        <h3 className='text-error flex items-center gap-1.5 text-xs font-bold'>
          Strefa Niebezpieczna
        </h3>
        <p className='text-base-content/75 text-[11px] leading-relaxed'>
          Klucze API są przechowywane wyłącznie lokalnie w profilu przeglądarki.
        </p>
        <button
          type='button'
          onClick={onClearHistory}
          className='btn btn-error btn-outline btn-sm w-full rounded-lg text-xs hover:text-white'
          disabled={historyListLength === 0}
        >
          Wyczyść całą historię
        </button>
        <button
          type='button'
          onClick={onClearApiKeysAndHistory}
          className='btn btn-error btn-outline btn-sm w-full rounded-lg text-xs hover:text-white'
          disabled={!hasAnyKey && historyListLength === 0}
        >
          Usuń wszystkie klucze API i historię
        </button>
      </div>

      {/* Info footer */}
      <div className='text-base-content/75 mt-2 text-center text-[11px] font-medium'>
        Wersja rozszerzenia: 1.2.0 • Obsługuje wielu dostawców AI
      </div>
    </div>
  );
}
