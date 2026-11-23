import {
  encodeEvent,
  KEEP_ALIVE,
  type ChatMessage,
  type ErrorCode,
  type StreamEvent,
} from '../shared/protocol.js';
import type { Provider } from './types.js';

export type { ChatMessage, EndReason, ErrorCode } from '../shared/protocol.js';
export type { Provider, ProviderEvent, ProviderInput } from './types.js';

export type RelayOptions<Env = unknown> = {
  /** The AI provider: `openai(…)`, `gemini(…)` or `anthropic(…)`. */
  provider: Provider;
  /** Instructions for the model. Visitors can find them out: no secrets. */
  system?: string;
  /** Exact origins allowed to call the relay, or `'*'` for any (DC-9). */
  allowedOrigins: string[] | '*';
  /** Accept requests without an `Origin` header (curl, server to server). */
  allowNoOrigin?: boolean;
  /** Accept cookies from the widget's `with-credentials`. Not with `'*'`. */
  allowCredentials?: boolean;
  /** Output token limit for one reply. Default 4096 (DC-8). */
  maxOutputTokens?: number;
  /** Older messages are dropped beyond this many. Default 20. */
  maxMessages?: number;
  /** A longer message is refused with 413. Default 4000 characters. */
  maxMessageChars?: number;
  /** Runs before the body is read. Return a Response to refuse the request. */
  onRequest?: (
    request: Request,
    env: Env
  ) => Response | void | Promise<Response | void>;
  /** Server-side log of provider and internal errors. Default console.error. */
  onError?: (error: unknown, request: Request) => void;
  /** Milliseconds between keep-alive comments. Default 10000. */
  keepAliveMs?: number;
};

export type RelayHandler<Env = unknown> = (
  request: Request,
  env?: Env,
  ctx?: unknown
) => Promise<Response>;

const messages: Record<ErrorCode, string> = {
  bad_request: 'The request is not a valid chat request.',
  forbidden_origin: 'This site is not allowed to use this chat.',
  method_not_allowed: 'Use POST.',
  too_large: 'The message is too long.',
  rate_limited: 'Too many requests. Try again later.',
  upstream_error: 'The AI provider returned an error.',
  internal: 'The chat server failed.',
};

const statusOf: Partial<Record<ErrorCode, number>> = {
  bad_request: 400,
  forbidden_origin: 403,
  method_not_allowed: 405,
  too_large: 413,
  rate_limited: 429,
  internal: 500,
};

const check = <Env>(options: RelayOptions<Env>) => {
  if (!options || typeof options.provider?.stream !== 'function') {
    throw new TypeError('tiny-ai-chat relay: `provider` is required.');
  }
  const origins = options.allowedOrigins;
  if (origins !== '*' && !Array.isArray(origins)) {
    throw new TypeError(
      "tiny-ai-chat relay: `allowedOrigins` is required: a list of origins such as ['https://example.com'], or '*' for any."
    );
  }
  if (origins === '*' && options.allowCredentials) {
    throw new TypeError(
      "tiny-ai-chat relay: `allowCredentials` cannot be used with allowedOrigins '*'."
    );
  }
  return options;
};

/** A plain JSON error response (DESIGN §4.3). */
export const errorResponse = (
  code: ErrorCode,
  headers: HeadersInit = {},
  message = messages[code]
) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status: statusOf[code] || 500,
    headers: { 'content-type': 'application/json', ...headers },
  });

const isMessage = (value: unknown): value is ChatMessage => {
  const m = value as ChatMessage;
  return (
    !!m &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.content === 'string'
  );
};

/**
 * Creates the relay: a standard fetch handler, `(request, env?) => Response`.
 * Pass options, or a function that builds them from `env` (Cloudflare Workers
 * secrets). On Workers, export it as `fetch`; on Node, see templates/node.
 */
export const createRelay = <Env = unknown>(
  options: RelayOptions<Env> | ((env: Env) => RelayOptions<Env>)
): RelayHandler<Env> => {
  const fixed = typeof options === 'function' ? undefined : check(options);
  const byEnv = new WeakMap<object, RelayOptions<Env>>();

  const resolve = (env: Env) => {
    if (fixed) return fixed;
    const build = options as (env: Env) => RelayOptions<Env>;
    if (env === null || typeof env !== 'object') return check(build(env));
    let built = byEnv.get(env);
    if (!built) byEnv.set(env, (built = check(build(env))));
    return built;
  };

  return async (request, env) => {
    let opts: RelayOptions<Env>;
    try {
      opts = resolve(env as Env);
    } catch (error) {
      console.error(error);
      return errorResponse('internal');
    }
    const {
      provider,
      system,
      allowedOrigins,
      allowNoOrigin,
      allowCredentials,
      maxOutputTokens = 4096,
      maxMessages = 20,
      maxMessageChars = 4000,
      onRequest,
      onError = (error: unknown) => console.error(error),
      keepAliveMs = 10000,
    } = opts;

    const origin = request.headers.get('origin');
    const allowed = origin
      ? allowedOrigins === '*' || allowedOrigins.includes(origin)
      : !!allowNoOrigin;
    const cors: Record<string, string> =
      origin && allowed
        ? {
            'access-control-allow-origin': origin,
            vary: 'Origin',
            ...(allowCredentials
              ? { 'access-control-allow-credentials': 'true' }
              : {}),
          }
        : {};

    if (request.method === 'OPTIONS') {
      if (!allowed) return errorResponse('forbidden_origin');
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'POST',
          'access-control-allow-headers':
            request.headers.get('access-control-request-headers') ||
            'content-type',
          'access-control-max-age': '600',
        },
      });
    }
    if (request.method !== 'POST') {
      return errorResponse('method_not_allowed', { ...cors, allow: 'POST' });
    }
    if (!allowed) return errorResponse('forbidden_origin');

    try {
      const refused = await onRequest?.(request, env as Env);
      if (refused) {
        const headers = new Headers(refused.headers);
        for (const [name, value] of Object.entries(cors)) {
          headers.set(name, value);
        }
        return new Response(refused.body, {
          status: refused.status,
          statusText: refused.statusText,
          headers,
        });
      }
    } catch (error) {
      onError(error, request);
      return errorResponse('internal', cors);
    }

    // Read the body with a size cap before parsing it.
    const limit = maxMessages * maxMessageChars * 2 + 4096;
    const length = Number(request.headers.get('content-length'));
    if (length > limit * 4) return errorResponse('too_large', cors);
    let text: string;
    try {
      text = await request.text();
    } catch {
      return errorResponse('bad_request', cors);
    }
    if (text.length > limit) return errorResponse('too_large', cors);

    let body: { messages?: unknown };
    try {
      body = JSON.parse(text);
    } catch {
      return errorResponse('bad_request', cors);
    }
    const list = body?.messages;
    if (
      !Array.isArray(list) ||
      !list.length ||
      !list.every(isMessage) ||
      list[list.length - 1].role !== 'user'
    ) {
      return errorResponse('bad_request', cors);
    }
    if (list.some(m => m.content.length > maxMessageChars)) {
      return errorResponse('too_large', cors);
    }
    const history = list
      .slice(-maxMessages)
      .map(({ role, content }) => ({ role, content }));
    // Some providers need the conversation to start with the visitor.
    while (history[0].role !== 'user') history.shift();

    const abort = new AbortController();
    const stopUpstream = () => abort.abort();
    request.signal?.addEventListener('abort', stopUpstream);
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let open = true;
        const send = (chunk: string) => {
          if (open) controller.enqueue(encoder.encode(chunk));
        };
        const event = (value: StreamEvent) => send(encodeEvent(value));
        timer = setInterval(() => send(KEEP_ALIVE), keepAliveMs);
        try {
          let ended = false;
          for await (const item of provider.stream({
            system,
            messages: history,
            maxOutputTokens,
            signal: abort.signal,
          })) {
            if (abort.signal.aborted) break;
            if (item.type === 'text') {
              if (item.text)
                event({ event: 'delta', data: { text: item.text } });
            } else {
              event({ event: 'done', data: { reason: item.reason } });
              ended = true;
              break;
            }
          }
          if (!ended && !abort.signal.aborted) {
            event({ event: 'done', data: { reason: 'stop' } });
          }
        } catch (error) {
          if (!abort.signal.aborted) {
            onError(error, request);
            event({
              event: 'error',
              data: {
                code: 'upstream_error',
                message: messages.upstream_error,
              },
            });
          }
        } finally {
          clearInterval(timer);
          request.signal?.removeEventListener('abort', stopUpstream);
          open = false;
          try {
            controller.close();
          } catch {
            // Already cancelled by the visitor.
          }
        }
      },
      cancel() {
        clearInterval(timer);
        stopUpstream();
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
      },
    });
  };
};
