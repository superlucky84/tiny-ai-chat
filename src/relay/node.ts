import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { RelayHandler } from './index.js';

/**
 * Serves a relay from Node's `http` module or Express (DESIGN DC-20):
 *
 *   http.createServer(toNodeHandler(relay)).listen(8787);
 *   app.post('/api/chat', toNodeHandler(relay)); // before any body parser
 *
 * When the visitor disconnects, the request's signal aborts, which stops the
 * AI provider's request too.
 */
export const toNodeHandler =
  <Env>(relay: RelayHandler<Env>, env?: Env) =>
  async (req: IncomingMessage, res: ServerResponse) => {
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach(v => headers.append(name, v));
      else if (value !== undefined) headers.set(name, value);
    }
    const withBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request(
      new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`),
      {
        method: req.method,
        headers,
        body: withBody
          ? (Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>)
          : undefined,
        signal: controller.signal,
        // Node needs this for a streamed request body.
        duplex: 'half',
      } as RequestInit
    );

    let response: Response;
    try {
      response = await relay(request, env);
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end();
      return;
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) {
      res.end();
      return;
    }
    const reader = response.body.getReader();
    controller.signal.addEventListener('abort', () => {
      reader.cancel().catch(() => {});
    });
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } catch {
      // The visitor went away; the relay has already stopped the provider.
    }
    res.end();
  };
