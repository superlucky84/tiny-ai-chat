import type { Provider } from './types.js';

export type FakeOptions = {
  /** Milliseconds between words. Default 30. */
  delayMs?: number;
};

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * A demo provider that needs no API key (DESIGN DC-21). It streams back what
 * the visitor wrote, word by word, so you can try the widget and the relay
 * before choosing a real provider.
 */
export const fake = ({ delayMs = 30 }: FakeOptions = {}): Provider => ({
  name: 'fake',
  async *stream({ messages, signal }) {
    const said = messages[messages.length - 1]?.content || '';
    const reply =
      `You said: *${said.replace(/[*_`[\]]/g, '')}*\n\n` +
      'This answer comes from the **demo provider**, so no AI is involved. ' +
      'To get real answers:\n\n' +
      '1. Set `PROVIDER` to `openai`, `gemini` or `anthropic`\n' +
      '2. Set `MODEL` and the API key\n' +
      '3. Restart the relay';
    for (const word of reply.split(/(?<= )/)) {
      if (delayMs) await pause(delayMs, signal);
      if (signal.aborted) return;
      yield { type: 'text', text: word };
    }
    yield { type: 'end', reason: 'stop' };
  },
});
