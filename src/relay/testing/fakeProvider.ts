import type { EndReason } from '../../shared/protocol.js';
import type { Provider, ProviderInput } from '../types.js';

export type FakeProviderOptions = {
  /** Text pieces to stream, in order. */
  chunks?: string[];
  /** How the reply ends. `null` ends without an end event. */
  end?: EndReason | null;
  /** Milliseconds before each piece. */
  delayMs?: number;
  /** Throw this after the pieces, instead of ending. */
  error?: unknown;
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });

/**
 * A provider that streams scripted text, for tests and for running the widget
 * without an API key. `calls` records what the relay passed in.
 */
export const fakeProvider = ({
  chunks = ['Hello', ' from', ' the fake provider.'],
  end = 'stop',
  delayMs = 0,
  error,
}: FakeProviderOptions = {}) => {
  const calls: ProviderInput[] = [];
  const provider: Provider & { calls: ProviderInput[] } = {
    name: 'fake',
    calls,
    async *stream(input) {
      calls.push(input);
      for (const text of chunks) {
        if (delayMs) await wait(delayMs, input.signal);
        yield { type: 'text', text };
      }
      if (error !== undefined) throw error;
      if (end) yield { type: 'end', reason: end };
    },
  };
  return provider;
};
