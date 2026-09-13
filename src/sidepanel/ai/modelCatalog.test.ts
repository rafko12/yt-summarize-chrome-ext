import { describe, expect, it } from 'vitest';

import {
  AI_MODELS,
  AI_PROVIDERS,
  getAiModel,
  getAiProvider,
} from './modelCatalog';

describe('AI Model Catalog (modelCatalog)', () => {
  it('exposes standard AI providers in stable order', () => {
    expect(AI_PROVIDERS.map((p) => p.id)).toEqual([
      'gemini',
      'openai',
      'claude',
    ]);
  });

  it('exposes defined models with associated providers', () => {
    expect(AI_MODELS.length).toBeGreaterThan(0);
    AI_MODELS.forEach((model) => {
      expect(['gemini', 'openai', 'claude']).toContain(model.provider);
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
    });
  });

  it('finds provider by id using getAiProvider', () => {
    const gemini = getAiProvider('gemini');
    expect(gemini.label).toBe('Google Gemini');
    expect(gemini.defaultModel).toBe('gemini-3.6-flash');

    const openai = getAiProvider('openai');
    expect(openai.label).toBe('OpenAI');
    expect(openai.defaultModel).toBe('gpt-5.6-luna');

    const claude = getAiProvider('claude');
    expect(claude.label).toBe('Anthropic Claude');
    expect(claude.defaultModel).toBe('claude-sonnet-5');
  });

  it('finds model by id or returns undefined if not found', () => {
    const model = getAiModel('gemini-3.6-flash');
    expect(model).toBeDefined();
    expect(model?.provider).toBe('gemini');

    const notFound = getAiModel('unknown-model-xyz');
    expect(notFound).toBeUndefined();
  });
});
