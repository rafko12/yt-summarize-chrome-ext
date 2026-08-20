import {
  getSafeErrorMessage,
  LlmProvider,
  LlmRequest,
  LlmRequestError,
} from '../types';

const anthropicProvider: LlmProvider = {
  name: 'claude',
  async request({
    apiKey,
    model,
    systemInstruction,
    userMessage,
    chatHistory = [],
    maxTokens,
  }: LlmRequest): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        system: systemInstruction,
        messages: [
          ...chatHistory.map((item) => ({
            role: item.role === 'model' ? 'assistant' : 'user',
            content: item.message,
          })),
          { role: 'user', content: userMessage },
        ],
        max_tokens: maxTokens || 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new LlmRequestError(
        'claude',
        getSafeErrorMessage('claude', response.status),
        response.status
      );
    }

    const result = await response.json();
    const text = result?.content?.[0]?.text;
    if (!text) {
      throw new LlmRequestError(
        'claude',
        'Dostawca AI zwrócił pustą odpowiedź.'
      );
    }
    return text;
  },
};

export default anthropicProvider;
