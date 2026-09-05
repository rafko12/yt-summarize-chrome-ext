export const AI_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    apiKeySourceLabel: 'Google AI Studio',
    apiKeyHelpPrefix: 'Klucz Gemini API uzyskasz bezpłatnie na stronie',
    apiKeyHelpUrl: 'https://aistudio.google.com',
    apiKeyHelpLinkLabel: 'Google AI Studio',
    validationModel: 'gemini-3.5-flash-lite',
    defaultModel: 'gemini-3.6-flash',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    apiKeySourceLabel: 'OpenAI',
    apiKeyHelpPrefix: 'Klucz OpenAI API uzyskasz na stronie',
    apiKeyHelpUrl: 'https://platform.openai.com/api-keys',
    apiKeyHelpLinkLabel: 'OpenAI API keys',
    validationModel: 'gpt-4o-mini',
    defaultModel: 'gpt-5.6-luna',
  },
  {
    id: 'claude',
    label: 'Anthropic Claude',
    apiKeySourceLabel: 'Anthropic',
    apiKeyHelpPrefix: 'Klucz Anthropic Claude API uzyskasz na stronie',
    apiKeyHelpUrl: 'https://console.anthropic.com/settings/keys',
    apiKeyHelpLinkLabel: 'Anthropic Console',
    validationModel: 'claude-haiku-4-5',
    defaultModel: 'claude-sonnet-5',
  },
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number]['id'];

export const AI_MODELS = [
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    provider: 'gemini',
    visibleInSettings: true,
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'gemini',
    visibleInSettings: false,
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    provider: 'gemini',
    visibleInSettings: true,
  },
  {
    id: 'gemini-3.1-pro',
    label: 'Gemini 3.1 Pro',
    provider: 'gemini',
    visibleInSettings: true,
  },
  {
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    provider: 'openai',
    visibleInSettings: true,
  },
  {
    id: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    provider: 'openai',
    visibleInSettings: true,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: 'openai',
    visibleInSettings: false,
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude 5 Sonnet',
    provider: 'claude',
    visibleInSettings: true,
  },
  {
    id: 'claude-opus-5',
    label: 'Claude 5 Opus',
    provider: 'claude',
    visibleInSettings: true,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude 4.5 Haiku',
    provider: 'claude',
    visibleInSettings: true,
  },
] as const;

export function getAiProvider(provider: AiProvider) {
  return AI_PROVIDERS.find((entry) => entry.id === provider)!;
}

export function getAiModel(model: string) {
  return AI_MODELS.find((entry) => entry.id === model);
}

export function getDefaultAiModel(provider: AiProvider): string {
  return getAiProvider(provider).defaultModel;
}
