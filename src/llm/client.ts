import {
  getChatSystemInstruction,
  getSummarySystemInstruction,
  getSummaryUserMessage,
  getValidationSystemInstruction,
  getValidationUserMessage,
} from '../utils/prompts';
import anthropicProvider from './providers/anthropic';
import geminiProvider from './providers/gemini';
import openaiProvider from './providers/openai';
import { getAiModel, getAiProvider } from './registry';
import {
  ChatMessage,
  getSafeErrorMessage,
  LlmProvider,
  LlmProviderName,
  LlmRequest,
  LlmRequestError,
  TranscriptItem,
} from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const providers: Record<LlmProviderName, LlmProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
  claude: anthropicProvider,
};

export const formatTranscript = (transcript: TranscriptItem[]) =>
  transcript
    .map((item) => {
      const min = Math.floor(item.start / 60);
      const sec = Math.floor(item.start % 60);
      return `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}] ${item.text}`;
    })
    .join('\n');

export function getProvider(model: string): LlmProviderName {
  const configuredModel = getAiModel(model);
  if (configuredModel) return configuredModel.provider;
  throw new LlmRequestError(
    'unknown',
    'Wybrany model nie jest obsługiwany przez rozszerzenie.'
  );
}

export function getProviderClient(provider: LlmProviderName): LlmProvider {
  return providers[provider];
}

async function requestProvider(
  provider: LlmProviderName,
  request: LlmRequest
): Promise<string> {
  try {
    return await getProviderClient(provider).request(request);
  } catch (error: unknown) {
    if (error instanceof LlmRequestError) throw error;
    throw new LlmRequestError(provider, getSafeErrorMessage(provider));
  }
}

async function requestForModel(
  model: string,
  request: Omit<LlmRequest, 'model'>
) {
  return requestProvider(getProvider(model), { ...request, model });
}

export async function validateApiKey(
  apiKey: string,
  _model = 'gemini-3.5-flash',
  provider: LlmProviderName = 'gemini'
): Promise<ValidationResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey)
    return { valid: false, error: 'Klucz API nie może być pusty.' };

  try {
    await requestProvider(provider, {
      apiKey: trimmedKey,
      model: getAiProvider(provider).validationModel || _model,
      systemInstruction: getValidationSystemInstruction(),
      userMessage: getValidationUserMessage(),
      chatHistory: [],
      maxTokens: 5,
    });
    return { valid: true };
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('API key validation failed:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Wystąpił błąd sieciowy podczas walidacji.',
    };
  }
}

export async function generateSummary(
  apiKey: string,
  transcript: TranscriptItem[],
  language: string,
  model = 'gemini-3.5-flash'
): Promise<string> {
  return requestForModel(model, {
    apiKey: apiKey.trim(),
    systemInstruction: getSummarySystemInstruction(language),
    userMessage: getSummaryUserMessage(formatTranscript(transcript)),
  });
}

export async function generateChatResponse(
  apiKey: string,
  transcript: TranscriptItem[],
  chatHistory: ChatMessage[],
  userMessage: string,
  language: string,
  model = 'gemini-3.5-flash'
): Promise<string> {
  return requestForModel(model, {
    apiKey: apiKey.trim(),
    systemInstruction: getChatSystemInstruction(
      formatTranscript(transcript),
      language
    ),
    userMessage,
    chatHistory,
  });
}
