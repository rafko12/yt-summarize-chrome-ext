import { useEffect, useState } from 'react';
import type { AiProvider } from '../ai';
import type { PanelTheme, Settings, UserPreferencesStore } from './types';

import { AiClient, resolveCompatibleModel } from '../ai';

export interface UseSettingsProps {
  preferences?: UserPreferencesStore;
  settings?: UserPreferencesStore;
  aiClient: AiClient;
}

export default function useSettings({
  preferences,
  settings: injectedSettingsStore,
  aiClient,
}: UseSettingsProps) {
  const store = injectedSettingsStore ?? preferences;
  if (!store) {
    throw new Error('useSettings requires a settings/preferences store');
  }

  // Theme state
  const [theme, setTheme] = useState<PanelTheme>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'night'
      : 'nord'
  );

  // Key & Settings state
  const [apiKeys, setApiKeysVal] = useState<Record<AiProvider, string>>({
    gemini: '',
    openai: '',
    claude: '',
  });
  const [selectedProvider, setSelectedProvider] =
    useState<AiProvider>('gemini');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(false);
  const [keyValidationMsg, setKeyValidationMsg] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  const [settings, setSettingsVal] = useState<Settings>({
    language: 'Polski',
    model: 'gemini-3.6-flash', // Fallback
  });

  useEffect(() => {
    const init = async () => {
      const {
        apiKeys: savedKeys,
        settings: savedSettings,
        theme: savedTheme,
      } = await store.readInitialPreferences();

      setApiKeysVal(savedKeys);
      setApiKeyInput(savedKeys[selectedProvider]);
      setSettingsVal(savedSettings);
      if (savedTheme) setTheme(savedTheme);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'night' ? 'nord' : 'night';
    setTheme(nextTheme);
    await store.setTheme(nextTheme);
  };

  const handleSelectProvider = (p: AiProvider) => {
    setSelectedProvider(p);
    setApiKeyInput(apiKeys[p] || '');
    setKeyValidationMsg(null);
  };

  const handleToggleShowKey = () => setShowKey(!showKey);

  const handleSaveApiKey = async () => {
    setIsCheckingKey(true);
    setKeyValidationMsg(null);

    const trimmedKey = apiKeyInput.trim();
    const { valid, error } = await aiClient.validateApiKey(
      trimmedKey,
      settings.model || 'gemini-3.6-flash',
      selectedProvider
    );

    setIsCheckingKey(false);
    if (valid) {
      const nextApiKeys: Record<AiProvider, string> = {
        ...apiKeys,
        [selectedProvider]: trimmedKey,
      };

      const compatibleModel = resolveCompatibleModel({
        currentModel: settings.model,
        apiKeys: nextApiKeys,
        preferredProvider: selectedProvider,
      });

      if (compatibleModel !== settings.model) {
        const nextSettings = { ...settings, model: compatibleModel };
        await store.setSettings(nextSettings);
        setSettingsVal(nextSettings);
      }

      await store.setApiKey(selectedProvider, trimmedKey);
      setApiKeysVal(nextApiKeys);
      setKeyValidationMsg({
        text: 'Klucz API jest poprawny i został zapisany!',
        success: true,
      });
    } else {
      const displayError =
        error || 'Niepoprawny klucz API. Sprawdź go i spróbuj ponownie.';
      setKeyValidationMsg({ text: displayError, success: false });
    }
  };

  const handleDeleteApiKey = async (provider: AiProvider) => {
    const nextApiKeys: Record<AiProvider, string> = {
      ...apiKeys,
      [provider]: '',
    };

    const compatibleModel = resolveCompatibleModel({
      currentModel: settings.model,
      apiKeys: nextApiKeys,
    });

    if (compatibleModel !== settings.model) {
      const nextSettings = { ...settings, model: compatibleModel };
      await store.setSettings(nextSettings);
      setSettingsVal(nextSettings);
    }

    await store.setApiKey(provider, '');
    setApiKeysVal(nextApiKeys);
    if (selectedProvider === provider) {
      setApiKeyInput('');
    }
  };

  const clearApiKeyState = () => {
    setApiKeysVal({ gemini: '', openai: '', claude: '' });
    setApiKeyInput('');
    setKeyValidationMsg(null);
  };

  const handleLanguageChange = async (lang: string) => {
    const updatedSettings = { ...settings, language: lang };
    await store.setSettings(updatedSettings);
    setSettingsVal(updatedSettings);
  };

  const handleModelChange = async (model: string) => {
    const updatedSettings = { ...settings, model };
    await store.setSettings(updatedSettings);
    setSettingsVal(updatedSettings);
  };

  const hasAnyKey = Object.values(apiKeys).some((k) => !!k.trim());

  const clearApiKeys = async () => {
    await store.clearApiKeys();
    clearApiKeyState();
  };

  return {
    theme,
    toggleTheme,
    settings,
    apiKeys,
    hasAnyKey,
    selectedProvider,
    apiKeyInput,
    setApiKeyInput,
    showKey,
    isCheckingKey,
    keyValidationMsg,
    handleSelectProvider,
    handleToggleShowKey,
    handleSaveApiKey,
    handleDeleteApiKey,
    clearApiKeyState,
    clearApiKeys,
    handleModelChange,
    handleLanguageChange,
  };
}
