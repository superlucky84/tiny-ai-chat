import { describe, expect, it, vi } from 'vitest';
import { createRelay, type RelayOptions } from './index';
import { fakeProvider } from './testing/fakeProvider';
import { readEventStream } from '../shared/protocol';

const SITE = 'https://site.example';

const relayWith = (options: Partial<RelayOptions> = {}) => {
  const provider = fakeProvider();
  const relay = createRelay({
    provider,
    allowedOrigins: [SITE],
    onError: () => {},
    ...options,
  });
  return { relay, provider: (options.provider as typeof provider) || provider };
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://relay.example/', {
    method: 'POST',
    headers: { origin: SITE, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const ask = (content = 'Hi') => ({ messages: [{ role: 'user', content }] });

const events = async (response: Response) => {
  const list: [string, unknown][] = [];
  await readEventStream(response.body!, (name, data) =>
    list.push([name, JSON.parse(data)])
  );
  return list;
};

const errorCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

describe('createRelay options', () => {
  it('requires a provider and allowed origins', () => {
    expect(() =>
      createRelay({ allowedOrigins: '*' } as unknown as RelayOptions)
    ).toThrow(/provider/);
    expect(() =>
      createRelay({ provider: fakeProvider() } as unknown as RelayOptions)
    ).toThrow(/allowedOrigins/);
  });

  it("refuses credentials with allowedOrigins '*'", () => {
    expect(() =>
      createRelay({
        provider: fakeProvider(),
        allowedOrigins: '*',
        allowCredentials: true,
      })
    ).toThrow(/allowCredentials/);
  });

  it('builds options from env once per env object', async () => {
    const provider = fakeProvider();
    const build = vi.fn((env: { origin: string }) => ({
      provider,
      allowedOrigins: [env.origin],
    }));
    const relay = createRelay(build);
    const env = { origin: SITE };
    expect((await relay(post(ask()), env)).status).toBe(200);
    expect((await relay(post(ask()), env)).status).toBe(200);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('answers 500 when options built from env are invalid', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const relay = createRelay(() => ({}) as unknown as RelayOptions);
    const response = await relay(post(ask()), {});
    expect(response.status).toBe(500);
    expect(await errorCode(response)).toBe('internal');
    spy.mockRestore();
  });
});

describe('methods and origins', () => {
  it('answers a preflight from an allowed origin', async () => {
    const { relay } = relayWith();
    const response = await relay(
      new Request('https://relay.example/', {
        method: 'OPTIONS',
        headers: {
          origin: SITE,
          'access-control-request-headers': 'content-type,x-site-token',
        },
      })
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(response.headers.get('access-control-allow-methods')).toBe('POST');
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'content-type,x-site-token'
    );
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('refuses a preflight and a POST from another origin', async () => {
    const { relay, provider } = relayWith();
    const preflight = await relay(
      new Request('https://relay.example/', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      })
    );
    expect(preflight.status).toBe(403);
    const response = await relay(
      post(ask(), { origin: 'https://evil.example' })
    );
    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe('forbidden_origin');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(provider.calls).toHaveLength(0);
  });

  it('refuses requests without an origin unless allowNoOrigin', async () => {
    const noOrigin = () =>
      new Request('https://relay.example/', {
        method: 'POST',
        body: JSON.stringify(ask()),
      });
    expect((await relayWith().relay(noOrigin())).status).toBe(403);
    expect(
      (await relayWith({ allowNoOrigin: true }).relay(noOrigin())).status
    ).toBe(200);
  });

  it("lets any origin in with '*'", async () => {
    const { relay } = relayWith({ allowedOrigins: '*' });
    const response = await relay(
      post(ask(), { origin: 'https://any.example' })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://any.example'
    );
  });

  it('adds the credentials header when allowCredentials is set', async () => {
    const { relay } = relayWith({ allowCredentials: true });
    const response = await relay(post(ask()));
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true'
    );
  });

  it('answers 405 to other methods', async () => {
    const { relay } = relayWith();
    const response = await relay(
      new Request('https://relay.example/', { headers: { origin: SITE } })
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(await errorCode(response)).toBe('method_not_allowed');
  });
});

describe('onRequest', () => {
  it('returns the hook response, with CORS headers, without streaming', async () => {
    const provider = fakeProvider();
    const { relay } = relayWith({
      provider,
      onRequest: () =>
        new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
          status: 429,
        }),
    });
    const response = await relay(post(ask()));
    expect(response.status).toBe(429);
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(provider.calls).toHaveLength(0);
  });

  it('answers 500 and logs when the hook throws', async () => {
    const onError = vi.fn();
    const { relay } = relayWith({
      onError,
      onRequest: () => {
        throw new Error('limiter down');
      },
    });
    const response = await relay(post(ask()));
    expect(response.status).toBe(500);
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe('request body', () => {
  it.each([
    ['not JSON', '{'],
    ['no messages', {}],
    ['empty messages', { messages: [] }],
    ['a bad role', { messages: [{ role: 'system', content: 'x' }] }],
    ['non-string content', { messages: [{ role: 'user', content: 1 }] }],
    [
      'last message from the assistant',
      {
        messages: [
          { role: 'user', content: 'a' },
          { role: 'assistant', content: 'b' },
        ],
      },
    ],
  ])('answers 400 to %s', async (_name, body) => {
    const { relay, provider } = relayWith();
    const response = await relay(post(body));
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('bad_request');
    expect(provider.calls).toHaveLength(0);
  });

  it('answers 413 to a message over maxMessageChars', async () => {
    const { relay } = relayWith({ maxMessageChars: 10 });
    expect((await relay(post(ask('12345678901')))).status).toBe(413);
    expect((await relay(post(ask('1234567890')))).status).toBe(200);
  });

  it('answers 413 to a body over the size cap before parsing it', async () => {
    const { relay } = relayWith({ maxMessages: 1, maxMessageChars: 10 });
    const response = await relay(post(`{"messages":"${'x'.repeat(5000)}"}`));
    expect(response.status).toBe(413);
  });

  it('keeps the last maxMessages, starting with a user message', async () => {
    const provider = fakeProvider();
    const { relay } = relayWith({ provider, maxMessages: 4 });
    const conversation = ['u1', 'a1', 'u2', 'a2', 'u3', 'a3', 'u4'].map(c => ({
      role: c[0] === 'u' ? 'user' : 'assistant',
      content: c,
      extra: 'dropped',
    }));
    await events(await relay(post({ messages: conversation })));
    expect(provider.calls[0].messages).toEqual([
      { role: 'user', content: 'u3' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'u4' },
    ]);
  });

  it('passes the system prompt and output limit to the provider', async () => {
    const provider = fakeProvider();
    const { relay } = relayWith({
      provider,
      system: 'Be brief.',
      maxOutputTokens: 300,
    });
    await events(await relay(post(ask())));
    expect(provider.calls[0]).toMatchObject({
      system: 'Be brief.',
      maxOutputTokens: 300,
    });
  });
});

describe('streaming', () => {
  it('streams deltas and a done event', async () => {
    const { relay } = relayWith({
      provider: fakeProvider({ chunks: ['Hel', '', 'lo'], end: 'length' }),
    });
    const response = await relay(post(ask()));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
    expect(await events(response)).toEqual([
      ['delta', { text: 'Hel' }],
      ['delta', { text: 'lo' }],
      ['done', { reason: 'length' }],
    ]);
  });

  it('ends with done "stop" when the provider ends without a reason', async () => {
    const { relay } = relayWith({
      provider: fakeProvider({ chunks: ['ok'], end: null }),
    });
    expect((await events(await relay(post(ask())))).at(-1)).toEqual([
      'done',
      { reason: 'stop' },
    ]);
  });

  it('sends a generic error event and logs the provider error', async () => {
    const onError = vi.fn();
    const secret = new Error('401 invalid key sk-123');
    const { relay } = relayWith({
      onError,
      provider: fakeProvider({ chunks: ['part'], error: secret }),
    });
    const list = await events(await relay(post(ask())));
    expect(list).toEqual([
      ['delta', { text: 'part' }],
      [
        'error',
        {
          code: 'upstream_error',
          message: 'The AI provider returned an error.',
        },
      ],
    ]);
    expect(onError).toHaveBeenCalledWith(secret, expect.any(Request));
  });

  it('sends keep-alive comments while the provider is quiet', async () => {
    const { relay } = relayWith({
      keepAliveMs: 5,
      provider: fakeProvider({ chunks: ['late'], delayMs: 40 }),
    });
    const text = await (await relay(post(ask()))).text();
    expect(text).toMatch(/^: keep-alive\n\n/);
    expect(text).toContain('event: done');
  });

  it('aborts the provider when the visitor cancels the stream', async () => {
    const provider = fakeProvider({ chunks: ['a', 'b', 'c'], delayMs: 50 });
    const onError = vi.fn();
    const { relay } = relayWith({ provider, onError });
    const response = await relay(post(ask()));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(provider.calls[0].signal.aborted).toBe(true));
    expect(onError).not.toHaveBeenCalled();
  });

  it('aborts the provider when the request signal aborts', async () => {
    const provider = fakeProvider({ chunks: ['a', 'b'], delayMs: 50 });
    const { relay } = relayWith({ provider });
    const controller = new AbortController();
    const request = new Request(post(ask()), { signal: controller.signal });
    const response = await relay(request);
    controller.abort();
    await vi.waitFor(() => expect(provider.calls[0].signal.aborted).toBe(true));
    await response.body?.cancel().catch(() => {});
  });
});
