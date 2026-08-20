import {
  getSafeErrorMessage,
  LlmProvider,
  LlmRequest,
  LlmRequestError,
} from '../types';

const geminiProvider: LlmProvider = {
  name: 'gemini',
  async request({
    apiKey,
    model,
    systemInstruction,
    userMessage,
    chatHistory = [],
    maxTokens,
  }: LlmRequest): Promise<string> {
    const body: {
      contents: { role: string; parts: { text: string }[] }[];
      systemInstruction: { parts: { text: string }[] };
      generationConfig: { temperature: number; maxOutputTokens?: number };
    } = {
      contents: [
        ...chatHistory.map((item) => ({
          role: item.role,
          parts: [{ text: item.message }],
        })),
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.3 },
    };

    if (maxTokens) body.generationConfig.maxOutputTokens = maxTokens;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new LlmRequestError(
        'gemini',
        getSafeErrorMessage('gemini', response.status),
        response.status
      );
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new LlmRequestError(
        'gemini',
        result?.candidates?.[0]?.finishReason === 'SAFETY'
          ? 'Dostawca AI odmówił wygenerowania odpowiedzi ze względów bezpieczeństwa.'
          : 'Dostawca AI zwrócił pustą odpowiedź.'
      );
    }
    return text;
  },
};

export default geminiProvider;
