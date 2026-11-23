/**
 * The E2E server: serves the built widget (dist/) and test pages, and runs
 * the built relay with a scripted provider whose reply depends on what the
 * visitor types, so every browser sees the same thing.
 *
 *   node e2e/server.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { createRelay } = await import(join(root, 'dist/relay/index.js'));
const { toNodeHandler } = await import(join(root, 'dist/relay/node.js'));
const port = Number(process.argv[2] || 4179);

const wait = (ms, signal) =>
  new Promise(done => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      done();
    });
  });

export const REPLY =
  'Here is **bold** text.\n\n- first\n- second\n\nRun `npm test` or see [the docs](https://example.com/docs).';

const scripted = {
  name: 'scripted',
  async *stream({ messages, signal }) {
    const said = messages[messages.length - 1].content;
    if (said === 'fail') throw new Error('scripted failure');
    const slow = said === 'slow';
    const words = slow
      ? Array.from({ length: 200 }, (_, i) => `word${i} `)
      : said === 'echo history'
        ? [`I have ${messages.length} messages.`]
        : REPLY.split(/(?<= )/);
    for (const word of words) {
      await wait(slow ? 50 : 5, signal);
      if (signal.aborted) return;
      yield { type: 'text', text: word };
    }
    yield { type: 'end', reason: 'stop' };
  },
};

const chat = toNodeHandler(
  createRelay({
    provider: scripted,
    allowedOrigins: [`http://localhost:${port}`],
  })
);
const forbidden = toNodeHandler(
  createRelay({
    provider: scripted,
    allowedOrigins: ['https://somewhere-else.example'],
  })
);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.map': 'application/json',
};

createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === '/api/chat') return chat(req, res);
  if (path === '/api/forbidden') return forbidden(req, res);
  const file = path.startsWith('/pages/')
    ? join(root, 'e2e', normalize(path))
    : join(root, 'dist', normalize(path === '/' ? '/index.html' : path));
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file)] || 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, () => console.log(`e2e server on http://localhost:${port}`));
