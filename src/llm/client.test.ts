// cspell:ignore generativelanguage
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatTranscript,
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
});
