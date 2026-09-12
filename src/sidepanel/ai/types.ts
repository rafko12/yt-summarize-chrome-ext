import { ConversationMessage, TranscriptSegment } from '../../domain/analysis';
import { AiProvider } from './modelCatalog';

export type { ConversationMessage, TranscriptSegment };

export type AiErrorProviderName = AiProvider | 'unknown';

export interface AiRequest {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userMessage: string;
  chatHistory?: ConversationMessage[];
  maxTokens?: number;
}

export interface AiProviderAdapter {
  readonly name: AiProvider;
  request(request: AiRequest): Promise<string>;
}

export class AiRequestError extends Error {
  readonly provider: AiErrorProviderName;

  readonly status?: number;

  constructor(provider: AiErrorProviderName, message: string, status?: number) {
    super(message);
    this.name = 'AiRequestError';
    this.provider = provider;
    this.status = status;
  }
}

export function getSafeErrorMessage(
  provider: AiErrorProviderName,
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
