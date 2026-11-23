import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRelay } from './index';
import { fake } from './fake';
import { toNodeHandler } from './node';
import { fakeProvider } from './testing/fakeProvider';
import { readEventStream } from '../shared/protocol';

const SITE = 'https://site.example';
let server: Server | undefined;

afterEach(async () => {
  if (!server) return;
  await new Promise(resolve => server!.close(resolve));
  server = undefined;
});

const listen = async (handler: Parameters<typeof createServer>[1]) => {
  server = createServer(handler);
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}/`;
};

const post = (url: string, content = 'Hi', init: RequestInit = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { origin: SITE, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content }] }),
    ...init,
  });

describe('toNodeHandler', () => {
  it('serves the relay over node:http, streaming events', async () => {
    const url = await listen(
      toNodeHandler(
        createRelay({ provider: fake({ delayMs: 0 }), allowedOrigins: [SITE] })
      )
    );
    const response = await post(url, 'ping');
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(SITE);
    const events: string[] = [];
    let text = '';
    await readEventStream(response.body!, (name, data) => {
      events.push(name);
      if (name === 'delta') text += JSON.parse(data).text;
    });
    expect(events.at(-1)).toBe('done');
    expect(text).toContain('You said: *ping*');
  });

  it('passes status codes and preflights through', async () => {
    const url = await listen(
      toNodeHandler(createRelay({ provider: fake(), allowedOrigins: [SITE] }))
    );
    expect(
      (await post(url, 'x', { headers: { origin: 'https://evil.example' } }))
        .status
    ).toBe(403);
    const preflight = await fetch(url, {
      method: 'OPTIONS',
      headers: { origin: SITE, 'access-control-request-method': 'POST' },
    });
    expect(preflight.status).toBe(204);
    expect((await fetch(url)).status).toBe(405);
  });

  it('aborts the provider when the visitor disconnects', async () => {
    const provider = fakeProvider({
      chunks: ['a', 'b', 'c', 'd'],
      delayMs: 100,
    });
    const url = await listen(
      toNodeHandler(createRelay({ provider, allowedOrigins: [SITE] }))
    );
    const controller = new AbortController();
    const response = await post(url, 'Hi', { signal: controller.signal });
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    await vi.waitFor(
      () => expect(provider.calls[0].signal.aborted).toBe(true),
      {
        timeout: 2000,
      }
    );
  });

  it('answers 413 to a chunked body over the cap', async () => {
    const url = await listen(
      toNodeHandler(
        createRelay({
          provider: fake(),
          allowedOrigins: [SITE],
          maxMessages: 1,
          maxMessageChars: 10,
        })
      )
    );
    const big = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunk = new TextEncoder().encode('x'.repeat(1024));
        for (let i = 0; i < 10; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: { origin: SITE },
      body: big,
      duplex: 'half',
    } as RequestInit);
    expect(response.status).toBe(413);
  });
});

describe('fake provider', () => {
  it('echoes the last message as Markdown and ends with "stop"', async () => {
    const out: string[] = [];
    let end = '';
    for await (const event of fake({ delayMs: 0 }).stream({
      messages: [{ role: 'user', content: 'Hello *there*' }],
      maxOutputTokens: 10,
      signal: new AbortController().signal,
    })) {
      if (event.type === 'text') out.push(event.text);
      else end = event.reason;
    }
    expect(out.join('')).toMatch(/^You said: \*Hello there\*\n\n/);
    expect(end).toBe('stop');
  });

  it('stops when aborted', async () => {
    const controller = new AbortController();
    const out: string[] = [];
    for await (const event of fake({ delayMs: 5 }).stream({
      messages: [{ role: 'user', content: 'x' }],
      maxOutputTokens: 10,
      signal: controller.signal,
    })) {
      if (event.type === 'text') out.push(event.text);
      if (out.length === 2) controller.abort();
    }
    expect(out).toHaveLength(2);
  });
});
