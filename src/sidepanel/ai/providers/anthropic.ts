import {
  AiProviderAdapter,
  AiRequest,
  AiRequestError,
  getSafeErrorMessage,
} from '../types';

export function createAnthropicProvider(
  customFetch?: typeof fetch
): AiProviderAdapter {
  const fetchImpl: typeof fetch =
    customFetch ?? ((...args) => globalThis.fetch(...args));

  return {
    name: 'claude',
    async request({
      apiKey,
      model,
      systemInstruction,
      userMessage,
      chatHistory = [],
      maxTokens,
    }: AiRequest): Promise<string> {
      const response = await fetchImpl(
        'https://api.anthropic.com/v1/messages',
        {
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
        }
      );

      if (!response.ok) {
        throw new AiRequestError(
          'claude',
          getSafeErrorMessage('claude', response.status),
          response.status
        );
      }

      const result = await response.json();
      const text = result?.content?.[0]?.text;
      if (!text) {
        throw new AiRequestError(
          'claude',
          'Dostawca AI zwrócił pustą odpowiedź.'
        );
      }
      return text;
    },
  };
}

const anthropicProvider = createAnthropicProvider();

export default anthropicProvider;
