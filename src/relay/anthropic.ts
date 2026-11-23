import Anthropic from '@anthropic-ai/sdk';
import type { EndReason, Provider } from './types.js';

export type AnthropicOptions = {
  /** Your Anthropic API key. Keep it in a server secret. */
  apiKey?: string;
  /** The model ID, for example `claude-opus-5-5`. Required (DESIGN DC-6). */
  model: string;
  /** How much effort the model puts in. Unset uses the API default. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /**
   * When the model declines on safety grounds, let another model continue
   * the same reply (server-side fallback). Default `'default'`; `false`
   * turns it off (DESIGN DC-7).
   */
  fallbacks?: 'default' | Array<{ model: string }> | false;
  /** An Anthropic client to use instead of creating one (tests, proxies). */
  client?: Anthropic;
};

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const endReason = (stop: string | null | undefined): EndReason =>
  stop === 'refusal'
    ? 'refusal'
    : stop === 'max_tokens' || stop === 'model_context_window_exceeded'
      ? 'length'
      : 'stop';

/** Streams replies from Claude through the official Anthropic SDK. */
export const anthropic = ({
  apiKey,
  model,
  effort,
  fallbacks = 'default',
  client,
}: AnthropicOptions): Provider => {
  if (!model)
    throw new TypeError('tiny-ai-chat anthropic: `model` is required.');
  if (!client && !apiKey) {
    throw new TypeError('tiny-ai-chat anthropic: `apiKey` is required.');
  }
  const api = client || new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    async *stream({ system, messages, maxOutputTokens, signal }) {
      const stream = api.beta.messages.stream(
        {
          model,
          max_tokens: maxOutputTokens,
          messages,
          ...(system ? { system } : {}),
          ...(effort ? { output_config: { effort } } : {}),
          ...(fallbacks ? { betas: [FALLBACK_BETA], fallbacks } : {}),
        },
        { signal }
      );
      let stop: string | null | undefined;
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text', text: event.delta.text };
        } else if (event.type === 'message_delta') {
          stop = event.delta.stop_reason;
        }
      }
      yield { type: 'end', reason: endReason(stop) };
    },
  };
};
