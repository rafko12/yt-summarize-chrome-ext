import {
  getSafeErrorMessage,
  LlmProvider,
  LlmRequest,
  LlmRequestError,
} from '../types';

const openaiProvider: LlmProvider = {
  name: 'openai',
  async request({
    apiKey,
    model,
    systemInstruction,
    userMessage,
    chatHistory = [],
    maxTokens,
  }: LlmRequest): Promise<string> {
    const isReasoningModel = model.startsWith('o') || model.startsWith('gpt-5');
    const body: {
      model: string;
      messages: { role: string; content: string }[];
      temperature?: number;
      max_tokens?: number;
    } = {
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        ...chatHistory.map((item) => ({
          role: item.role === 'model' ? 'assistant' : 'user',
          content: item.message,
        })),
        { role: 'user', content: userMessage },
      ],
    };

    if (!isReasoningModel) body.temperature = 0.3;
    if (maxTokens) body.max_tokens = maxTokens;

    const request = () =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

    let response = await request();
    if (!response.ok && body.temperature !== undefined) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData?.error?.message?.includes('temperature')) {
        delete body.temperature;
        response = await request();
      }
    }

    if (!response.ok) {
      throw new LlmRequestError(
        'openai',
        getSafeErrorMessage('openai', response.status),
        response.status
      );
    }

    const result = await response.json();
    const text = result?.choices?.[0]?.message?.content;
    if (!text) {
      throw new LlmRequestError(
        'openai',
        'Dostawca AI zwrócił pustą odpowiedź.'
      );
    }
    return text;
  },
};

export default openaiProvider;
