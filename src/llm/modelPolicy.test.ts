import { describe, expect, it } from 'vitest';

import {
  hasApiKey,
  isModelAvailable,
  resolveCompatibleModel,
} from './modelPolicy';
import { AI_MODELS, AI_PROVIDERS, getDefaultAiModel } from './registry';

describe('AI model compatibility policy and registry defaults', () => {
  describe('Provider default models in registry', () => {
    it('every supported AI provider has exactly one explicit default model present in AI_MODELS', () => {
      expect(AI_PROVIDERS.length).toBeGreaterThan(0);

      AI_PROVIDERS.forEach((provider) => {
        expect(provider.defaultModel).toBeDefined();
        expect(getDefaultAiModel(provider.id)).toBe(provider.defaultModel);

        const modelEntry = AI_MODELS.find(
          (model) => model.id === provider.defaultModel
        );

        expect(
          modelEntry,
          `Default model "${provider.defaultModel}" for provider "${provider.id}" must exist in AI_MODELS`
        ).toBeDefined();

        expect(modelEntry?.provider).toBe(provider.id);
        expect(
          modelEntry?.visibleInSettings,
          `Default model "${provider.defaultModel}" must be visible in settings`
        ).toBe(true);
      });
    });

    it('defines expected default models for gemini, openai, and claude', () => {
      expect(getDefaultAiModel('gemini')).toBe('gemini-3.6-flash');
      expect(getDefaultAiModel('openai')).toBe('gpt-5.6-luna');
      expect(getDefaultAiModel('claude')).toBe('claude-sonnet-5');
    });
  });

  describe('hasApiKey helper', () => {
    it('returns true only for non-empty trimmed keys', () => {
      expect(hasApiKey({ gemini: 'valid-key' }, 'gemini')).toBe(true);
      expect(hasApiKey({ gemini: '  ' }, 'gemini')).toBe(false);
      expect(hasApiKey({ gemini: '' }, 'gemini')).toBe(false);
      expect(hasApiKey({}, 'gemini')).toBe(false);
      expect(hasApiKey(undefined, 'gemini')).toBe(false);
    });
  });

  describe('isModelAvailable helper', () => {
    it('returns true when model exists, is visible in settings, and provider key is present', () => {
      expect(
        isModelAvailable('gemini-3.6-flash', { gemini: 'valid-key' })
      ).toBe(true);
      expect(isModelAvailable('gpt-5.6-terra', { openai: 'valid-key' })).toBe(
        true
      );
      expect(isModelAvailable('claude-sonnet-5', { claude: 'valid-key' })).toBe(
        true
      );
    });

    it('returns false when model has no corresponding API key', () => {
      expect(isModelAvailable('gemini-3.6-flash', { gemini: '' })).toBe(false);
      expect(
        isModelAvailable('gpt-5.6-luna', { gemini: 'key-for-other' })
      ).toBe(false);
      expect(isModelAvailable('claude-opus-5', {})).toBe(false);
    });

    it('returns false for unknown or invalid model names', () => {
      expect(
        isModelAvailable('non-existent-model', {
          gemini: 'key',
          openai: 'key',
          claude: 'key',
        })
      ).toBe(false);
      expect(isModelAvailable('', { gemini: 'key' })).toBe(false);
      expect(isModelAvailable(null, { gemini: 'key' })).toBe(false);
      expect(isModelAvailable(undefined, { gemini: 'key' })).toBe(false);
    });

    it('returns false for hidden / non-visible models even if key exists', () => {
      // gemini-3.5-flash and gpt-4o-mini have visibleInSettings: false
      expect(
        isModelAvailable('gemini-3.5-flash', { gemini: 'valid-key' })
      ).toBe(false);
      expect(isModelAvailable('gpt-4o-mini', { openai: 'valid-key' })).toBe(
        false
      );
    });
  });

  describe('resolveCompatibleModel', () => {
    it('preserves a valid and available user model without overwriting it', () => {
      const resultGemini = resolveCompatibleModel({
        currentModel: 'gemini-3.6-flash',
        apiKeys: { gemini: 'gemini-key' },
      });
      expect(resultGemini).toBe('gemini-3.6-flash');

      const resultOpenAi = resolveCompatibleModel({
        currentModel: 'gpt-5.6-terra',
        apiKeys: { openai: 'openai-key' },
      });
      expect(resultOpenAi).toBe('gpt-5.6-terra');

      const resultClaude = resolveCompatibleModel({
        currentModel: 'claude-opus-5',
        apiKeys: { claude: 'claude-key' },
      });
      expect(resultClaude).toBe('claude-opus-5');
    });

    it('preserves current valid model even when additional keys are added or present', () => {
      const result = resolveCompatibleModel({
        currentModel: 'gpt-5.6-terra',
        apiKeys: {
          openai: 'openai-key',
          gemini: 'gemini-key',
          claude: 'claude-key',
        },
        preferredProvider: 'claude',
      });
      expect(result).toBe('gpt-5.6-terra');
    });

    it('selects the default model of the first key for each AI provider when current model is unavailable', () => {
      // First key is OpenAI
      const openAiResult = resolveCompatibleModel({
        currentModel: 'gemini-3.5-flash', // unavailable / hidden / no gemini key
        apiKeys: { openai: 'openai-key' },
      });
      expect(openAiResult).toBe('gpt-5.6-luna');

      // First key is Claude
      const claudeResult = resolveCompatibleModel({
        currentModel: 'gemini-3.6-flash', // no claude key for gemini
        apiKeys: { claude: 'claude-key' },
      });
      expect(claudeResult).toBe('claude-sonnet-5');

      // First key is Gemini (when switching from unavailable model)
      const geminiResult = resolveCompatibleModel({
        currentModel: 'unknown-model',
        apiKeys: { gemini: 'gemini-key' },
      });
      expect(geminiResult).toBe('gemini-3.6-flash');
    });

    it('uses preferredProvider when current model is unavailable and preferred provider has a key', () => {
      const result = resolveCompatibleModel({
        currentModel: 'gemini-3.6-flash', // no gemini key
        apiKeys: {
          openai: 'openai-key',
          claude: 'claude-key',
        },
        preferredProvider: 'claude',
      });
      expect(result).toBe('claude-sonnet-5');
    });

    it('deterministically selects the first provider in registry order when multiple keys exist and current model is invalid', () => {
      // Order in AI_PROVIDERS is gemini -> openai -> claude
      const resultWithoutGemini = resolveCompatibleModel({
        currentModel: 'invalid-model',
        apiKeys: {
          openai: 'openai-key',
          claude: 'claude-key',
        },
      });
      expect(resultWithoutGemini).toBe('gpt-5.6-luna');

      const resultWithGemini = resolveCompatibleModel({
        currentModel: 'invalid-model',
        apiKeys: {
          gemini: 'gemini-key',
          openai: 'openai-key',
          claude: 'claude-key',
        },
      });
      expect(resultWithGemini).toBe('gemini-3.6-flash');
    });

    it('switches to an available provider when active key is removed', () => {
      // Was using gpt-5.6-luna (OpenAI), OpenAI key removed, Claude key still present
      const result = resolveCompatibleModel({
        currentModel: 'gpt-5.6-luna',
        apiKeys: {
          openai: '',
          claude: 'claude-key',
        },
      });
      expect(result).toBe('claude-sonnet-5');
    });

    it('keeps the active model unchanged when an inactive key is removed', () => {
      // Active model is gpt-5.6-luna (OpenAI), Claude key removed
      const result = resolveCompatibleModel({
        currentModel: 'gpt-5.6-luna',
        apiKeys: {
          openai: 'openai-key',
          claude: '',
        },
      });
      expect(result).toBe('gpt-5.6-luna');
    });

    it('replaces unknown or hidden models with visible default models', () => {
      const resultUnknown = resolveCompatibleModel({
        currentModel: 'unknown-xyz',
        apiKeys: { openai: 'openai-key' },
      });
      expect(resultUnknown).toBe('gpt-5.6-luna');

      const resultHiddenGemini = resolveCompatibleModel({
        currentModel: 'gemini-3.5-flash',
        apiKeys: { gemini: 'gemini-key' },
      });
      expect(resultHiddenGemini).toBe('gemini-3.6-flash');

      const resultHiddenOpenAi = resolveCompatibleModel({
        currentModel: 'gpt-4o-mini',
        apiKeys: { openai: 'openai-key' },
      });
      expect(resultHiddenOpenAi).toBe('gpt-5.6-luna');
    });

    it('handles no keys case without mutating current model or inventing a phantom model', () => {
      // Storage model is preserved as-is when no keys exist
      const resultPreserved = resolveCompatibleModel({
        currentModel: 'gemini-3.5-flash',
        apiKeys: { gemini: '', openai: '', claude: '' },
      });
      expect(resultPreserved).toBe('gemini-3.5-flash');

      const resultEmpty = resolveCompatibleModel({
        currentModel: '',
        apiKeys: {},
      });
      expect(resultEmpty).toBe('gemini-3.6-flash');

      // Model is recognized as not available for generation
      expect(isModelAvailable('gemini-3.5-flash', {})).toBe(false);
      expect(isModelAvailable('gemini-3.6-flash', {})).toBe(false);
    });

    it('falls back to registry order when preferredProvider has no key', () => {
      const result = resolveCompatibleModel({
        currentModel: 'unavailable-model',
        apiKeys: {
          gemini: '',
          openai: 'openai-key',
          claude: '',
        },
        preferredProvider: 'claude',
      });
      expect(result).toBe('gpt-5.6-luna');
    });

    it('handles completely empty options or undefined apiKeys', () => {
      expect(resolveCompatibleModel({})).toBe('gemini-3.6-flash');
      expect(resolveCompatibleModel({ apiKeys: undefined })).toBe(
        'gemini-3.6-flash'
      );
    });
  });
});
