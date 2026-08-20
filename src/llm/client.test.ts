import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatTranscript,
  generateSummary,
  getProvider,
  MODEL_PROVIDER_CONFIG,
  validateApiKey,
} from './client';

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
    it('maps every configured model to its provider', () => {
      Object.entries(MODEL_PROVIDER_CONFIG).forEach(([model, provider]) => {
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
});
