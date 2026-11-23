import { GoogleGenAI } from '@google/genai';
import type { EndReason, Provider } from './types.js';

export type GeminiOptions = {
  /** Your Gemini API key. Keep it in a server secret. */
  apiKey?: string;
  /** The model ID from Google's model list. Required (DESIGN DC-6). */
  model: string;
  /** Extra generation config merged into each request. */
  extra?: Record<string, unknown>;
  /** A GoogleGenAI client to use instead of creating one (tests). */
  client?: GoogleGenAI;
};

const endReason = (finish: string | undefined): EndReason | undefined =>
  !finish || finish === 'FINISH_REASON_UNSPECIFIED'
    ? undefined
    : finish === 'STOP'
      ? 'stop'
      : finish === 'MAX_TOKENS'
        ? 'length'
        : 'refusal';

/** Streams replies from Gemini through the official Google GenAI SDK. */
export const gemini = ({
  apiKey,
  model,
  extra,
  client,
}: GeminiOptions): Provider => {
  if (!model) throw new TypeError('tiny-ai-chat gemini: `model` is required.');
  if (!client && !apiKey) {
    throw new TypeError('tiny-ai-chat gemini: `apiKey` is required.');
  }
  const api = client || new GoogleGenAI({ apiKey });

  return {
    name: 'gemini',
    async *stream({ system, messages, maxOutputTokens, signal }) {
      const stream = await api.models.generateContentStream({
        model,
        contents: messages.map(({ role, content }) => ({
          role: role === 'assistant' ? 'model' : 'user',
          parts: [{ text: content }],
        })),
        config: {
          ...extra,
          maxOutputTokens,
          abortSignal: signal,
          ...(system ? { systemInstruction: system } : {}),
        },
      });
      let reason: EndReason = 'stop';
      for await (const chunk of stream) {
        if (chunk.promptFeedback?.blockReason) reason = 'refusal';
        const text = chunk.text;
        if (text) yield { type: 'text', text };
        reason = endReason(chunk.candidates?.[0]?.finishReason) || reason;
      }
      yield { type: 'end', reason };
    },
  };
};
