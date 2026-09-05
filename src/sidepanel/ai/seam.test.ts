import { describe, expect, it } from 'vitest';

import {
  AI_MODELS,
  AI_PROVIDERS,
  createAiClient,
  formatTranscript,
  generateChatResponse,
  generateSummary,
  getChatSystemInstruction,
  getProvider,
  getSummarySystemInstruction,
  getValidationSystemInstruction,
  hasApiKey,
  isModelAvailable,
  resolveCompatibleModel,
  validateApiKey,
} from './index';

describe('AI Module public seam (src/sidepanel/ai)', () => {
  it('exposes AI client methods and helpers at the public seam', () => {
    expect(createAiClient).toBeDefined();
    expect(validateApiKey).toBeDefined();
    expect(generateSummary).toBeDefined();
    expect(generateChatResponse).toBeDefined();
    expect(formatTranscript).toBeDefined();
    expect(getProvider).toBeDefined();
  });

  it('exposes AI registry and model policy at the public seam', () => {
    expect(AI_PROVIDERS).toBeDefined();
    expect(AI_MODELS).toBeDefined();
    expect(hasApiKey).toBeDefined();
    expect(isModelAvailable).toBeDefined();
    expect(resolveCompatibleModel).toBeDefined();
  });

  it('exposes prompt builders at the public seam', () => {
    expect(getValidationSystemInstruction).toBeDefined();
    expect(getSummarySystemInstruction).toBeDefined();
    expect(getChatSystemInstruction).toBeDefined();
  });
});
