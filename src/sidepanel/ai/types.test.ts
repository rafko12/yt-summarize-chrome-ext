import { describe, expect, it } from 'vitest';

import {
  AiErrorProviderName,
  AiProviderAdapter,
  AiRequest,
  AiRequestError,
  getSafeErrorMessage,
} from './types';

describe('AI Types and Errors (src/sidepanel/ai/types)', () => {
  describe('AiRequestError', () => {
    it('creates an error instance with canonical name, provider, status and message', () => {
      const error = new AiRequestError(
        'gemini',
        'Błąd komunikacji z dostawcą',
        503
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AiRequestError);
      expect(error.name).toBe('AiRequestError');
      expect(error.provider).toBe('gemini');
      expect(error.status).toBe(503);
      expect(error.message).toBe('Błąd komunikacji z dostawcą');
    });

    it('supports unknown provider in AiRequestError', () => {
      const error = new AiRequestError(
        'unknown',
        'Wybrany model nie jest obsługiwany przez rozszerzenie.'
      );

      expect(error.provider).toBe('unknown');
      expect(error.status).toBeUndefined();
      expect(error.message).toBe(
        'Wybrany model nie jest obsługiwany przez rozszerzenie.'
      );
    });
  });

  describe('getSafeErrorMessage', () => {
    it('returns unauthorized message for 401 and 403', () => {
      expect(getSafeErrorMessage('openai', 401)).toBe(
        'Klucz API został odrzucony. Sprawdź jego poprawność.'
      );
      expect(getSafeErrorMessage('claude', 403)).toBe(
        'Klucz API został odrzucony. Sprawdź jego poprawność.'
      );
    });

    it('returns rate limit message for 429', () => {
      expect(getSafeErrorMessage('gemini', 429)).toBe(
        'Osiągnięto limit zapytań API. Spróbuj ponownie później.'
      );
    });

    it('returns server unavailable message for 500+', () => {
      expect(getSafeErrorMessage('gemini', 500)).toBe(
        'Usługa gemini jest chwilowo niedostępna. Spróbuj ponownie później.'
      );
      expect(getSafeErrorMessage('claude', 503)).toBe(
        'Usługa claude jest chwilowo niedostępna. Spróbuj ponownie później.'
      );
    });

    it('returns default failure message for other or missing status codes', () => {
      expect(getSafeErrorMessage('openai')).toBe(
        'Nie udało się uzyskać odpowiedzi od dostawcy openai.'
      );
      expect(getSafeErrorMessage('unknown', 404)).toBe(
        'Nie udało się uzyskać odpowiedzi od dostawcy unknown.'
      );
    });
  });

  describe('canonical contracts interface types', () => {
    it('allows defining an AiProviderAdapter with AiRequest and AiErrorProviderName', async () => {
      const mockAdapter: AiProviderAdapter = {
        name: 'gemini',
        async request(request: AiRequest): Promise<string> {
          if (!request.apiKey) {
            const providerName: AiErrorProviderName = 'gemini';
            throw new AiRequestError(providerName, 'Missing key');
          }
          return `Response for ${request.userMessage}`;
        },
      };

      const result = await mockAdapter.request({
        apiKey: 'test-key',
        model: 'gemini-3.6-flash',
        systemInstruction: 'sys',
        userMessage: 'hello',
      });

      expect(result).toBe('Response for hello');
    });
  });
});
