import {
  AI_PROVIDERS,
  AiProvider,
  getAiModel,
  getAiProvider,
} from './registry';

/**
 * Sprawdza, czy klucz API dla danego Dostawcy AI jest niepusty.
 */
export function hasApiKey(
  apiKeys: Partial<Record<AiProvider, string | null | undefined>> | undefined,
  provider: AiProvider
): boolean {
  if (!apiKeys) return false;
  const key = apiKeys[provider];
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Sprawdza, czy wskazany model jest zarejestrowany, widoczny w interfejsie
 * oraz czy odpowiadający mu Dostawca AI posiada zapisany klucz API.
 */
export function isModelAvailable(
  model: string | null | undefined,
  apiKeys: Partial<Record<AiProvider, string | null | undefined>> | undefined
): boolean {
  if (!model || typeof model !== 'string') return false;
  const registeredModel = getAiModel(model);
  if (!registeredModel || !registeredModel.visibleInSettings) return false;
  return hasApiKey(apiKeys, registeredModel.provider);
}

export interface ResolveCompatibleModelOptions {
  currentModel?: string | null;
  apiKeys?: Partial<Record<AiProvider, string | null | undefined>>;
  preferredProvider?: AiProvider;
}

/**
 * Deterministyczna reguła domenowa wyboru aktywnego modelu.
 *
 * 1. Jeśli bieżący model jest zarejestrowany, widoczny w interfejsie i posiada klucz, jest zachowywany.
 * 2. Jeśli bieżący model jest niedostępny, a podany preferredProvider posiada klucz, wybierany jest model domyślny tego dostawcy.
 * 3. W przeciwnym razie wybierany jest model domyślny pierwszego Dostawcy AI z rejestru (AI_PROVIDERS), który posiada klucz.
 * 4. W przypadku braku jakichkolwiek kluczy zwracany jest dotychczasowy model (lub domyślny fallback),
 *    bez modyfikacji trwałego formatu storage i bez tworzenia pozornie aktywnego modelu.
 */
export function resolveCompatibleModel(
  options: ResolveCompatibleModelOptions
): string {
  const { currentModel, apiKeys, preferredProvider } = options;

  if (currentModel && isModelAvailable(currentModel, apiKeys)) {
    return currentModel;
  }

  if (preferredProvider && hasApiKey(apiKeys, preferredProvider)) {
    return getAiProvider(preferredProvider).defaultModel;
  }

  const availableProvider = AI_PROVIDERS.find((provider) =>
    hasApiKey(apiKeys, provider.id)
  );

  if (availableProvider) {
    return availableProvider.defaultModel;
  }

  return currentModel || AI_PROVIDERS[0].defaultModel;
}
