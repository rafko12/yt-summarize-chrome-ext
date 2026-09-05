// cspell:ignore generativelanguage
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAiClient,
  formatTranscript,
  generateChatResponse,
  generateSummary,
  getProvider,
  validateApiKey,
} from './client';

const existingModelProviders = {
  'gemini-3.6-flash': 'gemini',
  'gemini-3.5-flash': 'gemini',
  'gemini-3.5-flash-lite': 'gemini',
  'gemini-3.1-pro': 'gemini',
  'gpt-5.6-luna': 'openai',
  'gpt-5.6-terra': 'openai',
  'gpt-4o-mini': 'openai',
  'claude-sonnet-5': 'claude',
  'claude-opus-5': 'claude',
  'claude-haiku-4-5': 'claude',
} as const;

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('LLM client', () => {
  describe('formatTranscript', () => {
    it('should format transcript correctly for normal times', () => {
      const transcript = [
        { start: 0, duration: 5, text: 'Hello' },
        { start: 65, duration: 5, text: 'World' },
      ];
      const result = formatTranscript(transcript);
      expect(result).toBe('[00:00] Hello\n[01:05] World');
    });

    it('should format transcript correctly for times above 1 hour (as total minutes)', () => {
      const transcript = [
        { start: 3690, duration: 5, text: 'Above hour' }, // 61:30
      ];
      const result = formatTranscript(transcript);
      expect(result).toBe('[61:30] Above hour');
    });
  });

  describe('getProvider', () => {
    it('maps every previously supported model to its provider', () => {
      Object.entries(existingModelProviders).forEach(([model, provider]) => {
        expect(getProvider(model)).toBe(provider);
      });
    });

    it('rejects models missing from the explicit configuration', () => {
      expect(() => getProvider('unknown-model')).toThrow(
        'Wybrany model nie jest obsługiwany przez rozszerzenie.'
      );
    });
  });

  describe('createAiClient with injected fetch', () => {
    it('uses the provided fetch implementation instead of the global one', async () => {
      const customFetch = vi.fn().mockResolvedValue(
        mockJsonResponse({
          candidates: [
            { content: { parts: [{ text: 'Injected fetch response' }] } },
          ],
        })
      );
      const client = createAiClient(customFetch);

      const result = await client.generateSummary(
        'custom-key',
        [{ start: 0, duration: 10, text: 'Custom text' }],
        'Polski',
        'gemini-3.6-flash'
      );

      expect(result).toBe('Injected fetch response');
      expect(customFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gemini provider through client interface', () => {
    it('serializes generateSummary request, sends API key in query, and parses response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          candidates: [
            { content: { parts: [{ text: 'Podsumowanie filmu Gemini' }] } },
          ],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const summary = await generateSummary(
        'gemini-test-key',
        [{ start: 10, duration: 5, text: 'Fragment 1' }],
        'Polski',
        'gemini-3.6-flash'
      );

      expect(summary).toBe('Podsumowanie filmu Gemini');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain(
        'models/gemini-3.6-flash:generateContent?key=gemini-test-key'
      );
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.contents).toEqual([
        {
          role: 'user',
          parts: [{ text: expect.stringContaining('[00:10] Fragment 1') }],
        },
      ]);
      expect(parsedBody.systemInstruction.parts[0].text).toContain(
        'Odpowiadaj w języku: Polski.'
      );
      expect(parsedBody.generationConfig).toEqual({ temperature: 0.3 });
    });

    it('serializes generateChatResponse request with chat history and transcript context', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          candidates: [
            { content: { parts: [{ text: 'Odpowiedź na czacie Gemini' }] } },
          ],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await generateChatResponse(
        'gemini-test-key',
        [{ start: 0, duration: 5, text: 'Cześć wideo' }],
        [{ role: 'model', message: 'W czym mogę pomóc?' }],
        'O czym jest ten film?',
        'Polski',
        'gemini-3.6-flash'
      );

      expect(response).toBe('Odpowiedź na czacie Gemini');

      const [, options] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.contents).toEqual([
        { role: 'model', parts: [{ text: 'W czym mogę pomóc?' }] },
        { role: 'user', parts: [{ text: 'O czym jest ten film?' }] },
      ]);
      expect(parsedBody.systemInstruction.parts[0].text).toContain(
        '[00:00] Cześć wideo'
      );
    });

    it('handles safety refusal with a dedicated error message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          mockJsonResponse({
            candidates: [{ finishReason: 'SAFETY' }],
          })
        )
      );

      await expect(
        generateSummary(
          'gemini-test-key',
          [{ start: 0, duration: 5, text: 'Wrażliwa treść' }],
          'Polski',
          'gemini-3.6-flash'
        )
      ).rejects.toMatchObject({
        provider: 'gemini',
        message:
          'Dostawca AI odmówił wygenerowania odpowiedzi ze względów bezpieczeństwa.',
      });
    });

    it('handles empty response with standard empty message', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockJsonResponse({ candidates: [] }))
      );

      await expect(
        generateSummary(
          'gemini-test-key',
          [{ start: 0, duration: 5, text: 'Tekst' }],
          'Polski',
          'gemini-3.6-flash'
        )
      ).rejects.toMatchObject({
        provider: 'gemini',
        message: 'Dostawca AI zwrócił pustą odpowiedź.',
      });
    });

    it('handles HTTP error status safely without exposing api key', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockJsonResponse({}, false, 401))
      );

      await expect(
        generateSummary(
          'secret-key-12345',
          [{ start: 0, duration: 5, text: 'Tekst' }],
          'Polski',
          'gemini-3.6-flash'
        )
      ).rejects.toMatchObject({
        provider: 'gemini',
        status: 401,
        message: 'Klucz API został odrzucony. Sprawdź jego poprawność.',
      });
    });
  });

  describe('OpenAI provider through client interface', () => {
    it('serializes generateSummary request with Bearer authorization and parses response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          choices: [{ message: { content: 'Podsumowanie filmu OpenAI' } }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const summary = await generateSummary(
        'openai-test-key',
        [{ start: 30, duration: 10, text: 'Treść odcinka' }],
        'Polski',
        'gpt-4o-mini'
      );

      expect(summary).toBe('Podsumowanie filmu OpenAI');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer openai-test-key',
      });

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.model).toBe('gpt-4o-mini');
      expect(parsedBody.temperature).toBe(0.3);
      expect(parsedBody.messages).toEqual([
        {
          role: 'system',
          content: expect.stringContaining('Odpowiadaj w języku: Polski.'),
        },
        {
          role: 'user',
          content: expect.stringContaining('[00:30] Treść odcinka'),
        },
      ]);
    });

    it('omits temperature for reasoning models (e.g. gpt-5.6-luna)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          choices: [{ message: { content: 'Odpowiedź reasoning' } }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      await generateSummary(
        'openai-test-key',
        [{ start: 0, duration: 5, text: 'Tekst' }],
        'Polski',
        'gpt-5.6-luna'
      );

      const [, options] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.temperature).toBeUndefined();
      expect(parsedBody.model).toBe('gpt-5.6-luna');
    });

    it('retries request without temperature when receiving temperature error', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          mockJsonResponse(
            {
              error: { message: 'temperature is not supported for this model' },
            },
            false,
            400
          )
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            choices: [{ message: { content: 'Odpowiedź po ponowieniu' } }],
          })
        );
      vi.stubGlobal('fetch', fetchMock);

      const result = await generateSummary(
        'openai-test-key',
        [{ start: 0, duration: 5, text: 'Tekst' }],
        'Polski',
        'gpt-4o-mini'
      );

      expect(result).toBe('Odpowiedź po ponowieniu');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [, secondCall] = fetchMock.mock.calls[1];
      const parsedSecondBody = JSON.parse(secondCall.body);
      expect(parsedSecondBody.temperature).toBeUndefined();
    });

    it('serializes generateChatResponse with assistant role mapping', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          choices: [{ message: { content: 'Odpowiedź czatu OpenAI' } }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await generateChatResponse(
        'openai-test-key',
        [{ start: 0, duration: 5, text: 'Tekst wideo' }],
        [
          { role: 'user', message: 'Pytanie 1' },
          { role: 'model', message: 'Odpowiedź 1' },
        ],
        'Pytanie 2',
        'Polski',
        'gpt-4o-mini'
      );

      expect(response).toBe('Odpowiedź czatu OpenAI');

      const [, options] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.messages).toEqual([
        {
          role: 'system',
          content: expect.stringContaining('[00:00] Tekst wideo'),
        },
        { role: 'user', content: 'Pytanie 1' },
        { role: 'assistant', content: 'Odpowiedź 1' },
        { role: 'user', content: 'Pytanie 2' },
      ]);
    });

    it('handles empty response with standard error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockJsonResponse({ choices: [] }))
      );

      await expect(
        generateSummary(
          'openai-test-key',
          [{ start: 0, duration: 5, text: 'Tekst' }],
          'Polski',
          'gpt-4o-mini'
        )
      ).rejects.toMatchObject({
        provider: 'openai',
        message: 'Dostawca AI zwrócił pustą odpowiedź.',
      });
    });
  });

  describe('Anthropic provider through client interface', () => {
    it('serializes generateSummary request with Anthropic headers and parses response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          content: [{ text: 'Podsumowanie filmu Claude' }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const summary = await generateSummary(
        'claude-test-key',
        [{ start: 0, duration: 20, text: 'Treść prezentacji' }],
        'Polski',
        'claude-sonnet-5'
      );

      expect(summary).toBe('Podsumowanie filmu Claude');
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
        'x-api-key': 'claude-test-key',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      });

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.model).toBe('claude-sonnet-5');
      expect(parsedBody.max_tokens).toBe(4096);
      expect(parsedBody.temperature).toBe(0.3);
      expect(parsedBody.system).toContain('Odpowiadaj w języku: Polski.');
      expect(parsedBody.messages).toEqual([
        {
          role: 'user',
          content: expect.stringContaining('[00:00] Treść prezentacji'),
        },
      ]);
    });

    it('serializes generateChatResponse with assistant role mapping', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          content: [{ text: 'Odpowiedź czatu Claude' }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const response = await generateChatResponse(
        'claude-test-key',
        [{ start: 0, duration: 5, text: 'Napisy filmu' }],
        [{ role: 'model', message: 'Wcześniejsza odpowiedź' }],
        'Nowe pytanie',
        'Polski',
        'claude-sonnet-5'
      );

      expect(response).toBe('Odpowiedź czatu Claude');

      const [, options] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.messages).toEqual([
        { role: 'assistant', content: 'Wcześniejsza odpowiedź' },
        { role: 'user', content: 'Nowe pytanie' },
      ]);
    });

    it('handles empty response with standard error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockJsonResponse({ content: [] }))
      );

      await expect(
        generateSummary(
          'claude-test-key',
          [{ start: 0, duration: 5, text: 'Tekst' }],
          'Polski',
          'claude-sonnet-5'
        )
      ).rejects.toMatchObject({
        provider: 'claude',
        message: 'Dostawca AI zwrócił pustą odpowiedź.',
      });
    });
  });

  describe('validateApiKey validation flows', () => {
    it('rejects empty or whitespace API key without making network requests', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await validateApiKey('   ');
      expect(result).toEqual({
        valid: false,
        error: 'Klucz API nie może być pusty.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('validates key successfully and sets maxTokens to 5', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await validateApiKey('valid-key', 'gemini');
      expect(result).toEqual({ valid: true });

      const [, options] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.generationConfig.maxOutputTokens).toBe(5);
    });

    it.each([
      ['gemini', 'gemini-3.5-flash-lite'],
      ['openai', 'gpt-4o-mini'],
      ['claude', 'claude-haiku-4-5'],
    ] as const)(
      'uses %s validation model for %s',
      async (provider, expectedModel) => {
        const fetchMock = vi
          .fn()
          .mockRejectedValue(new TypeError('Failed to fetch'));
        vi.stubGlobal('fetch', fetchMock);

        await validateApiKey('test-key', undefined, provider);

        const [url, options] = fetchMock.mock.calls[0];
        const requestedModel = String(url).includes('generativelanguage')
          ? new URL(String(url)).pathname
              .split('/')
              .at(-1)
              ?.replace(':generateContent', '')
          : JSON.parse(options.body).model;
        expect(requestedModel).toBe(expectedModel);
      }
    );

    it('resolves provider from model name if provider is omitted in validateApiKey', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockJsonResponse({
          choices: [{ message: { content: 'OK' } }],
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await validateApiKey('openai-key', 'gpt-5.6-terra');
      expect(result).toEqual({ valid: true });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('returns safe error for 429 rate limit', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockJsonResponse({}, false, 429))
      );

      const result = await validateApiKey('test-key', undefined, 'openai');
      expect(result).toEqual({
        valid: false,
        error: 'Osiągnięto limit zapytań API. Spróbuj ponownie później.',
      });
    });

    it('returns safe error for 500 server error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockJsonResponse({}, false, 503))
      );

      const result = await validateApiKey('test-key', undefined, 'claude');
      expect(result).toEqual({
        valid: false,
        error:
          'Usługa claude jest chwilowo niedostępna. Spróbuj ponownie później.',
      });
    });

    it('returns a safe validation error for network failures', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      );

      await expect(
        validateApiKey('test-key', undefined, 'openai')
      ).resolves.toEqual({
        valid: false,
        error: 'Nie udało się uzyskać odpowiedzi od dostawcy openai.',
      });
    });
  });

  describe('Error handling', () => {
    it('normalizes network errors before they reach the UI', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      );

      await expect(
        generateSummary(
          'test-key',
          [{ start: 0, duration: 1, text: 'Transcript' }],
          'Polski',
          'gemini-3.6-flash'
        )
      ).rejects.toMatchObject({
        provider: 'gemini',
        status: undefined,
        message: 'Nie udało się uzyskać odpowiedzi od dostawcy gemini.',
      });
    });
  });
});
