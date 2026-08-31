import { useEffect, useMemo, useState } from 'react';

import { validateApiKey } from '../../llm/client';
import createChromePreferencesPlatform from '../../preferences/chromePreferencesPlatform';
import createUserPreferences, {
  Provider,
  Settings,
  Theme,
  UserPreferences,
} from '../../preferences/userPreferences';

export default function useSettings(preferencesOverride?: UserPreferences) {
  const preferences = useMemo(
    () =>
      preferencesOverride ||
      createUserPreferences(createChromePreferencesPlatform()),
    [preferencesOverride]
  );

  // Theme state
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'nord'
  );

  // Key & Settings state
  const [apiKeys, setApiKeysVal] = useState<Record<Provider, string>>({
    gemini: '',
    openai: '',
    claude: '',
  });
  const [selectedProvider, setSelectedProvider] = useState<Provider>('gemini');
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
      } = await preferences.readInitialPreferences();

      setApiKeysVal(savedKeys);
      setApiKeyInput(savedKeys[selectedProvider]);
      setSettingsVal(savedSettings);
      if (savedTheme) setTheme(savedTheme);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences]);

  // Sync the host document body background to match the theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.add('bg-base-100', 'text-base-content');
    document.body.classList.add('bg-base-100', 'text-base-content');
  }, [theme]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'night' ? 'nord' : 'night';
    setTheme(nextTheme);
    await preferences.setTheme(nextTheme);
  };

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    setApiKeyInput(apiKeys[p] || '');
    setKeyValidationMsg(null);
  };

  const handleToggleShowKey = () => setShowKey(!showKey);

  const handleSaveApiKey = async () => {
    setIsCheckingKey(true);
    setKeyValidationMsg(null);

    const trimmedKey = apiKeyInput.trim();
    const { valid, error } = await validateApiKey(
      trimmedKey,
      settings.model || 'gemini-3.6-flash',
      selectedProvider
    );

    setIsCheckingKey(false);
    if (valid) {
      await preferences.setApiKey(selectedProvider, trimmedKey);
      setApiKeysVal((prev) => ({ ...prev, [selectedProvider]: trimmedKey }));
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

  const handleDeleteApiKey = async (provider: Provider) => {
    await preferences.setApiKey(provider, '');
    setApiKeysVal((prev) => ({ ...prev, [provider]: '' }));
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
    await preferences.setSettings(updatedSettings);
    setSettingsVal(updatedSettings);
  };

  const handleModelChange = async (model: string) => {
    const updatedSettings = { ...settings, model };
    await preferences.setSettings(updatedSettings);
    setSettingsVal(updatedSettings);
  };

  const hasAnyKey = Object.values(apiKeys).some((k) => !!k.trim());

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
    handleModelChange,
    handleLanguageChange,
  };
}
