import {
  getChatSystemInstruction,
  getSummarySystemInstruction,
  getSummaryUserMessage,
  getValidationSystemInstruction,
  getValidationUserMessage,
} from '../utils/prompts';
import { createAnthropicProvider } from './providers/anthropic';
import { createGeminiProvider } from './providers/gemini';
import { createOpenaiProvider } from './providers/openai';
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

export interface AiClient {
  validateApiKey(
    apiKey: string,
    modelOrProvider?: string,
    explicitProvider?: LlmProviderName
  ): Promise<ValidationResult>;
  generateSummary(
    apiKey: string,
    transcript: TranscriptItem[],
    language: string,
    model?: string
  ): Promise<string>;
  generateChatResponse(
    apiKey: string,
    transcript: TranscriptItem[],
    chatHistory: ChatMessage[],
    userMessage: string,
    language: string,
    model?: string
  ): Promise<string>;
  getProvider(model: string): LlmProviderName;
  formatTranscript(transcript: TranscriptItem[]): string;
}

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

export function createAiClient(customFetch?: typeof fetch): AiClient {
  const fetchImpl: typeof fetch =
    customFetch ?? ((...args) => globalThis.fetch(...args));
  const providers: Record<LlmProviderName, LlmProvider> = {
    gemini: createGeminiProvider(fetchImpl),
    openai: createOpenaiProvider(fetchImpl),
    claude: createAnthropicProvider(fetchImpl),
  };

  async function requestProvider(
    provider: LlmProviderName,
    request: LlmRequest
  ): Promise<string> {
    try {
      return await providers[provider].request(request);
    } catch (error: unknown) {
      if (error instanceof LlmRequestError) throw error;
      throw new LlmRequestError(provider, getSafeErrorMessage(provider));
    }
  }

  async function requestForModel(
    model: string,
    request: Omit<LlmRequest, 'model'>
  ): Promise<string> {
    return requestProvider(getProvider(model), { ...request, model });
  }

  return {
    formatTranscript,
    getProvider,

    async validateApiKey(
      apiKey: string,
      modelOrProvider?: string,
      explicitProvider?: LlmProviderName
    ): Promise<ValidationResult> {
      const trimmedKey = apiKey.trim();
      if (!trimmedKey) {
        return { valid: false, error: 'Klucz API nie może być pusty.' };
      }

      const effectiveModelOrProvider = modelOrProvider || 'gemini-3.5-flash';

      let provider: LlmProviderName;
      if (explicitProvider) {
        provider = explicitProvider;
      } else if (
        effectiveModelOrProvider === 'gemini' ||
        effectiveModelOrProvider === 'openai' ||
        effectiveModelOrProvider === 'claude'
      ) {
        provider = effectiveModelOrProvider;
      } else {
        const configuredModel = getAiModel(effectiveModelOrProvider);
        provider = configuredModel ? configuredModel.provider : 'gemini';
      }

      const providerConfig = getAiProvider(provider);
      const validationModel =
        providerConfig?.validationModel ||
        effectiveModelOrProvider ||
        'gemini-3.5-flash-lite';

      try {
        await requestProvider(provider, {
          apiKey: trimmedKey,
          model: validationModel,
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
    },

    async generateSummary(
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
    },

    async generateChatResponse(
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
    },
  };
}

const defaultAiClient = createAiClient();

export const validateApiKey =
  defaultAiClient.validateApiKey.bind(defaultAiClient);
export const generateSummary =
  defaultAiClient.generateSummary.bind(defaultAiClient);
export const generateChatResponse =
  defaultAiClient.generateChatResponse.bind(defaultAiClient);

export default createAiClient;
