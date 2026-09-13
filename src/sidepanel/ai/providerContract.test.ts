import { describe, expect, it } from 'vitest';

import {
  AiProviderAdapter,
  AiRequest,
  AiRequestError,
  getSafeErrorMessage,
} from './providerContract';

describe('AI providerContract (src/sidepanel/ai/providerContract)', () => {
  it('defines AiRequest and AiProviderAdapter contract shapes', () => {
    const request: AiRequest = {
      apiKey: 'test-key',
      model: 'gemini-3.6-flash',
      systemInstruction: 'You are helpful',
      userMessage: 'Hello',
      chatHistory: [],
      maxTokens: 1000,
    };

    const adapter: AiProviderAdapter = {
      name: 'gemini',
      async request(req: AiRequest) {
        return `Response to: ${req.userMessage}`;
      },
    };

    expect(request.apiKey).toBe('test-key');
    expect(adapter.name).toBe('gemini');
  });

  it('provides AiRequestError carrying provider and HTTP status', () => {
    const errorWithStatus = new AiRequestError(
      'openai',
      'Unauthorized access',
      401
    );
    expect(errorWithStatus).toBeInstanceOf(Error);
    expect(errorWithStatus.name).toBe('AiRequestError');
    expect(errorWithStatus.provider).toBe('openai');
    expect(errorWithStatus.status).toBe(401);
    expect(errorWithStatus.message).toBe('Unauthorized access');

    const errorWithoutStatus = new AiRequestError(
      'claude',
      'Network unreachable'
    );
    expect(errorWithoutStatus.status).toBeUndefined();
  });

  it('implements safe error message policy across HTTP status codes', () => {
    expect(getSafeErrorMessage('gemini', 401)).toBe(
      'Klucz API został odrzucony. Sprawdź jego poprawność.'
    );
    expect(getSafeErrorMessage('openai', 403)).toBe(
      'Klucz API został odrzucony. Sprawdź jego poprawność.'
    );
    expect(getSafeErrorMessage('claude', 429)).toBe(
      'Osiągnięto limit zapytań API. Spróbuj ponownie później.'
    );
    expect(getSafeErrorMessage('gemini', 500)).toBe(
      'Usługa gemini jest chwilowo niedostępna. Spróbuj ponownie później.'
    );
    expect(getSafeErrorMessage('openai', 503)).toBe(
      'Usługa openai jest chwilowo niedostępna. Spróbuj ponownie później.'
    );
    expect(getSafeErrorMessage('claude', 400)).toBe(
      'Nie udało się uzyskać odpowiedzi od dostawcy claude.'
    );
    expect(getSafeErrorMessage('unknown')).toBe(
      'Nie udało się uzyskać odpowiedzi od dostawcy unknown.'
    );
  });
});
