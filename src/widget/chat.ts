import {
  readEventStream,
  type ChatMessage,
  type EndReason,
} from '../shared/protocol';

export type Turn = ChatMessage & {
  /** Set on an assistant turn once it has ended. */
  end?: EndReason | 'aborted' | 'error';
};

export type Ask = {
  endpoint: string;
  messages: ChatMessage[];
  headers?: Record<string, string>;
  withCredentials?: boolean;
  signal: AbortSignal;
  onText: (text: string) => void;
};

/** An error with a protocol code (DESIGN §4.3) or `network_error`. */
export class ChatError extends Error {
  constructor(
    public code: string,
    message = code
  ) {
    super(message);
  }
}

/**
 * Sends the conversation and streams the reply into `onText`. Resolves with
 * the end reason; rejects with a ChatError, or an AbortError when stopped.
 */
export const ask = async ({
  endpoint,
  messages,
  headers,
  withCredentials,
  signal,
  onText,
}: Ask): Promise<EndReason> => {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ messages }),
      credentials: withCredentials ? 'include' : 'same-origin',
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ChatError('network_error');
  }
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new ChatError(
      body?.error?.code || 'network_error',
      body?.error?.message
    );
  }
  let end: EndReason | undefined;
  let failure: ChatError | undefined;
  try {
    await readEventStream(response.body, (name, data) => {
      const value = JSON.parse(data);
      if (name === 'delta') onText(value.text);
      else if (name === 'done') end = value.reason;
      else if (name === 'error') {
        failure = new ChatError(value.code, value.message);
      }
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ChatError('network_error');
  }
  if (failure) throw failure;
  if (!end) throw new ChatError('network_error');
  return end;
};

/** sessionStorage, ignoring browsers and modes where it throws. */
export const store = {
  load(key: string): Turn[] {
    try {
      return JSON.parse(sessionStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  },
  save(key: string, turns: Turn[]) {
    try {
      if (turns.length) sessionStorage.setItem(key, JSON.stringify(turns));
      else sessionStorage.removeItem(key);
    } catch {
      // Storage full or blocked: the conversation still works without it.
    }
  },
};
