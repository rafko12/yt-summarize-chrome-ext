import { ChatMessage, TranscriptSegment } from '../../domain/analysis';
import { AiProvider } from './registry';

export type { ChatMessage, TranscriptSegment };

export type LlmProviderName = AiProvider;
export type LlmErrorProviderName = LlmProviderName | 'unknown';

export interface LlmRequest {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userMessage: string;
  chatHistory?: ChatMessage[];
  maxTokens?: number;
}

export interface LlmProvider {
  readonly name: LlmProviderName;
  request(request: LlmRequest): Promise<string>;
}

export class LlmRequestError extends Error {
  readonly provider: LlmErrorProviderName;

  readonly status?: number;

  constructor(
    provider: LlmErrorProviderName,
    message: string,
    status?: number
  ) {
    super(message);
    this.name = 'LlmRequestError';
    this.provider = provider;
    this.status = status;
  }
}

export function getSafeErrorMessage(
  provider: LlmErrorProviderName,
  status?: number
): string {
  if (status === 401 || status === 403) {
    return 'Klucz API został odrzucony. Sprawdź jego poprawność.';
  }
  if (status === 429) {
    return 'Osiągnięto limit zapytań API. Spróbuj ponownie później.';
  }
  if (status && status >= 500) {
    return `Usługa ${provider} jest chwilowo niedostępna. Spróbuj ponownie później.`;
  }
  return `Nie udało się uzyskać odpowiedzi od dostawcy ${provider}.`;
}
