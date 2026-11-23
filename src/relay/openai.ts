import OpenAI from 'openai';
import type { EndReason, Provider } from './types.js';

export type OpenAIOptions = {
  /** Your OpenAI API key. Keep it in a server secret. */
  apiKey?: string;
  /** The model ID from OpenAI's model list. Required (DESIGN DC-6). */
  model: string;
  /** Extra Responses API parameters merged into each request. */
  extra?: Record<string, unknown>;
  /** An OpenAI client to use instead of creating one (tests, proxies). */
  client?: OpenAI;
};

/** Streams replies from OpenAI's Responses API through the official SDK. */
export const openai = ({
  apiKey,
  model,
  extra,
  client,
}: OpenAIOptions): Provider => {
  if (!model) throw new TypeError('tiny-ai-chat openai: `model` is required.');
  if (!client && !apiKey) {
    throw new TypeError('tiny-ai-chat openai: `apiKey` is required.');
  }
  const api = client || new OpenAI({ apiKey });

  return {
    name: 'openai',
    async *stream({ system, messages, maxOutputTokens, signal }) {
      const stream = await api.responses.create(
        {
          ...extra,
          model,
          input: messages,
          max_output_tokens: maxOutputTokens,
          ...(system ? { instructions: system } : {}),
          stream: true,
        },
        { signal }
      );
      let reason: EndReason = 'stop';
      for await (const event of stream) {
        switch (event.type) {
          case 'response.output_text.delta':
            yield { type: 'text', text: event.delta };
            break;
          case 'response.refusal.delta':
            reason = 'refusal';
            yield { type: 'text', text: event.delta };
            break;
          case 'response.incomplete': {
            const why = event.response.incomplete_details?.reason;
            reason =
              why === 'content_filter'
                ? 'refusal'
                : why === 'max_output_tokens' || why === 'max_messages'
                  ? 'length'
                  : 'stop';
            break;
          }
          case 'response.failed':
            throw new Error(
              `OpenAI response failed: ${event.response.error?.code || 'unknown'}`
            );
          case 'error':
            throw new Error(
              `OpenAI stream error: ${event.code || event.message}`
            );
        }
      }
      yield { type: 'end', reason };
    },
  };
};
