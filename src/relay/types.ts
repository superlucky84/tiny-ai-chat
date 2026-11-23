import type { ChatMessage, EndReason } from '../shared/protocol.js';

export type { ChatMessage, EndReason };

/** What an adapter yields while a reply streams in (DESIGN §6). */
export type ProviderEvent =
  { type: 'text'; text: string } | { type: 'end'; reason: EndReason };

export type ProviderInput = {
  system?: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
  /** Aborted when the visitor stops or disconnects. */
  signal: AbortSignal;
};

/**
 * A connection to one AI provider. `tiny-ai-chat/relay/openai`, `/gemini`
 * and `/anthropic` make one; anything with this shape works.
 */
export type Provider = {
  name: string;
  stream(input: ProviderInput): AsyncIterable<ProviderEvent>;
};
