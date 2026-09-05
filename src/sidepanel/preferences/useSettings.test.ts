/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as aiModule from '../ai';
import {
  InitialPreferences,
  Provider,
  Settings,
  Theme,
  UserPreferences,
} from './types';
import useSettings from './useSettings';

vi.mock('../ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai')>();
  return {
    ...actual,
    validateApiKey: vi.fn(),
  };
});

function createMockPreferences(
  initialData?: Partial<InitialPreferences>
): UserPreferences {
  let apiKeys: Record<Provider, string> = {
    gemini: initialData?.apiKeys?.gemini ?? '',
    openai: initialData?.apiKeys?.openai ?? '',
    claude: initialData?.apiKeys?.claude ?? '',
  };
  let settings: Settings = initialData?.settings ?? {
    language: 'Polski',
    model: 'gemini-3.6-flash',
  };
  let theme: Theme | null = initialData?.theme ?? 'night';

  return {
    readInitialPreferences: vi.fn(async () => ({
      apiKeys: { ...apiKeys },
      settings: { ...settings },
      theme,
    })),
    getSettings: vi.fn(async () => ({ ...settings })),
    setSettings: vi.fn(async (s: Settings) => {
      settings = { ...s };
    }),
    getApiKey: vi.fn(
      async (provider: Provider = 'gemini') => apiKeys[provider]
    ),
    setApiKey: vi.fn(async (provider: Provider, key: string) => {
      apiKeys[provider] = key;
    }),
    getAllApiKeys: vi.fn(async () => ({ ...apiKeys })),
    getTheme: vi.fn(async () => theme),
    setTheme: vi.fn(async (t: Theme) => {
      theme = t;
    }),
    clearApiKeys: vi.fn(async () => {
      apiKeys = { gemini: '', openai: '', claude: '' };
    }),
  };
}

describe('useSettings (src/sidepanel/preferences)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads initial preferences on mount and sets data-theme attribute', async () => {
    const mockPreferences = createMockPreferences({
      apiKeys: { gemini: 'gem-123', openai: '', claude: '' },
      settings: { language: 'English', model: 'gemini-3.6-flash' },
      theme: 'night',
    });

    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.theme).toBe('night');
    expect(result.current.settings).toEqual({
      language: 'English',
      model: 'gemini-3.6-flash',
    });
    expect(result.current.apiKeys.gemini).toBe('gem-123');
    expect(result.current.apiKeyInput).toBe('gem-123');
    expect(result.current.hasAnyKey).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
  });

  it('toggles theme between night and nord and persists via preferences', async () => {
    const mockPreferences = createMockPreferences({ theme: 'night' });
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.theme).toBe('night');

    await act(async () => {
      await result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('nord');
    expect(mockPreferences.setTheme).toHaveBeenCalledWith('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('nord');

    await act(async () => {
      await result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('night');
    expect(mockPreferences.setTheme).toHaveBeenCalledWith('night');
  });

  it('switches active provider and updates apiKeyInput accordingly', async () => {
    const mockPreferences = createMockPreferences({
      apiKeys: { gemini: 'gem-key', openai: 'oai-key', claude: '' },
    });
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.selectedProvider).toBe('gemini');
    expect(result.current.apiKeyInput).toBe('gem-key');

    act(() => {
      result.current.handleSelectProvider('openai');
    });

    expect(result.current.selectedProvider).toBe('openai');
    expect(result.current.apiKeyInput).toBe('oai-key');

    act(() => {
      result.current.handleSelectProvider('claude');
    });

    expect(result.current.selectedProvider).toBe('claude');
    expect(result.current.apiKeyInput).toBe('');
  });

  it('toggles apiKey visibility flag with handleToggleShowKey', async () => {
    const mockPreferences = createMockPreferences();
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showKey).toBe(false);

    act(() => {
      result.current.handleToggleShowKey();
    });
    expect(result.current.showKey).toBe(true);

    act(() => {
      result.current.handleToggleShowKey();
    });
    expect(result.current.showKey).toBe(false);
  });

  it('saves valid API key, updates model if needed, and shows success message', async () => {
    vi.mocked(aiModule.validateApiKey).mockResolvedValue({ valid: true });

    const mockPreferences = createMockPreferences({
      apiKeys: { gemini: '', openai: '', claude: '' },
      settings: { language: 'Polski', model: 'gemini-3.6-flash' },
    });
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.handleSelectProvider('openai');
      result.current.setApiKeyInput('  sk-valid-openai-key  ');
    });

    await act(async () => {
      await result.current.handleSaveApiKey();
    });

    expect(aiModule.validateApiKey).toHaveBeenCalledWith(
      'sk-valid-openai-key',
      'gemini-3.6-flash',
      'openai'
    );
    expect(mockPreferences.setApiKey).toHaveBeenCalledWith(
      'openai',
      'sk-valid-openai-key'
    );
    expect(result.current.apiKeys.openai).toBe('sk-valid-openai-key');
    expect(result.current.keyValidationMsg).toEqual({
      text: 'Klucz API jest poprawny i został zapisany!',
      success: true,
    });
    // OpenAI model should be chosen since gemini has no key
    expect(result.current.settings.model).toBe('gpt-5.6-luna');
  });

  it('displays error message when saving invalid API key and does not persist', async () => {
    vi.mocked(aiModule.validateApiKey).mockResolvedValue({
      valid: false,
      error: 'Błędny token',
    });

    const mockPreferences = createMockPreferences();
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setApiKeyInput('bad-key');
    });

    await act(async () => {
      await result.current.handleSaveApiKey();
    });

    expect(mockPreferences.setApiKey).not.toHaveBeenCalled();
    expect(result.current.keyValidationMsg).toEqual({
      text: 'Błędny token',
      success: false,
    });
  });

  it('deletes API key and switches to compatible model if available', async () => {
    const mockPreferences = createMockPreferences({
      apiKeys: { gemini: 'gem-key', openai: 'oai-key', claude: '' },
      settings: { language: 'Polski', model: 'gemini-3.6-flash' },
    });
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleDeleteApiKey('gemini');
    });

    expect(mockPreferences.setApiKey).toHaveBeenCalledWith('gemini', '');
    expect(result.current.apiKeys.gemini).toBe('');
    expect(result.current.apiKeyInput).toBe('');
    // Model switched from gemini to openai compatible model
    expect(result.current.settings.model).toBe('gpt-5.6-luna');
  });

  it('clears all local API key state with clearApiKeyState', async () => {
    const mockPreferences = createMockPreferences({
      apiKeys: { gemini: 'gem-key', openai: 'oai-key', claude: '' },
    });
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.clearApiKeyState();
    });

    expect(result.current.apiKeys).toEqual({
      gemini: '',
      openai: '',
      claude: '',
    });
    expect(result.current.apiKeyInput).toBe('');
    expect(result.current.keyValidationMsg).toBeNull();
  });

  it('updates language setting and persists via preferences', async () => {
    const mockPreferences = createMockPreferences();
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleLanguageChange('English');
    });

    expect(mockPreferences.setSettings).toHaveBeenCalledWith({
      language: 'English',
      model: 'gemini-3.6-flash',
    });
    expect(result.current.settings.language).toBe('English');
  });

  it('updates model setting and persists via preferences', async () => {
    const mockPreferences = createMockPreferences();
    const { result } = renderHook(() => useSettings(mockPreferences));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleModelChange('gemini-3.1-pro');
    });

    expect(mockPreferences.setSettings).toHaveBeenCalledWith({
      language: 'Polski',
      model: 'gemini-3.1-pro',
    });
    expect(result.current.settings.model).toBe('gemini-3.1-pro');
  });
});
