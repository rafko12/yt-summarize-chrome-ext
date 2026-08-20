import { afterEach, describe, expect, it, vi } from 'vitest';

import anthropicProvider from './anthropic';
import geminiProvider from './gemini';
import openaiProvider from './openai';

const request = {
  apiKey: 'test-key',
  model: 'test-model',
  systemInstruction: 'System instruction',
  userMessage: 'User message',
  chatHistory: [{ role: 'model' as const, message: 'Previous answer' }],
  maxTokens: 100,
};

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe('LLM provider adapters', () => {
  it('serializes a Gemini request and maps its response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        candidates: [{ content: { parts: [{ text: 'Gemini answer' }] } }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(geminiProvider.request(request)).resolves.toBe(
      'Gemini answer'
    );

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('models/test-model:generateContent?key=test-key');
    expect(JSON.parse(options.body)).toMatchObject({
      contents: [
        { role: 'model', parts: [{ text: 'Previous answer' }] },
        { role: 'user', parts: [{ text: 'User message' }] },
      ],
      systemInstruction: { parts: [{ text: 'System instruction' }] },
      generationConfig: { temperature: 0.3, maxOutputTokens: 100 },
    });
  });

  it('serializes an OpenAI request and maps its response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockJsonResponse({
        choices: [{ message: { content: 'OpenAI answer' } }],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(openaiProvider.request(request)).resolves.toBe(
      'OpenAI answer'
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      model: 'test-model',
      messages: [
        { role: 'system', content: 'System instruction' },
        { role: 'assistant', content: 'Previous answer' },
        { role: 'user', content: 'User message' },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });
  });

  it('serializes an Anthropic request and maps its response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockJsonResponse({ content: [{ text: 'Anthropic answer' }] })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(anthropicProvider.request(request)).resolves.toBe(
      'Anthropic answer'
    );

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      model: 'test-model',
      system: 'System instruction',
      messages: [
        { role: 'assistant', content: 'Previous answer' },
        { role: 'user', content: 'User message' },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });
  });

  it('returns a safe error with provider and HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockJsonResponse({}, false, 401))
    );

    await expect(openaiProvider.request(request)).rejects.toMatchObject({
      provider: 'openai',
      status: 401,
      message: 'Klucz API został odrzucony. Sprawdź jego poprawność.',
    });
  });
});
