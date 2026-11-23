/**
 * A tiny-ai-chat relay on Node: it keeps your API key on this server and
 * streams answers to the widget. Settings come from environment variables
 * (see .env.example); `npm start` reads them from .env.
 */
import { createServer } from 'node:http';
import { createRelay } from 'tiny-ai-chat/relay';
import { toNodeHandler } from 'tiny-ai-chat/relay/node';

const {
  PROVIDER = 'fake',
  MODEL,
  OPENAI_API_KEY,
  GEMINI_API_KEY,
  ANTHROPIC_API_KEY,
  SYSTEM_PROMPT,
  ALLOWED_ORIGINS = '',
  PORT = '8787',
} = process.env;

// Only the chosen provider's SDK is loaded, so install just that one.
const provider = async () => {
  switch (PROVIDER) {
    case 'openai': {
      const { openai } = await import('tiny-ai-chat/relay/openai');
      return openai({ apiKey: OPENAI_API_KEY, model: MODEL });
    }
    case 'gemini': {
      const { gemini } = await import('tiny-ai-chat/relay/gemini');
      return gemini({ apiKey: GEMINI_API_KEY, model: MODEL });
    }
    case 'anthropic': {
      const { anthropic } = await import('tiny-ai-chat/relay/anthropic');
      return anthropic({ apiKey: ANTHROPIC_API_KEY, model: MODEL });
    }
    case 'fake': {
      const { fake } = await import('tiny-ai-chat/relay/fake');
      return fake();
    }
    default:
      throw new Error(`Unknown PROVIDER "${PROVIDER}".`);
  }
};

const port = Number(PORT);
const selfOrigin = `http://localhost:${port}`;
const origins = ALLOWED_ORIGINS.split(',').map(origin => origin.trim());

const relay = toNodeHandler(
  createRelay({
    provider: await provider(),
    system: SYSTEM_PROMPT,
    // The demo page below is served from this server, so allow it too.
    allowedOrigins: origins.includes('*')
      ? '*'
      : [selfOrigin, ...origins.filter(Boolean)],
  })
);

// A page to try the widget against this relay: http://localhost:8787
const demoPage = `<!doctype html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>tiny-ai-chat relay</title>
<p>tiny-ai-chat relay is running (provider: ${PROVIDER}). The chat is in the corner.</p>
<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
<tiny-ai-chat endpoint="/api/chat" heading="tiny-ai-chat" open></tiny-ai-chat>
`;

const server = createServer((req, res) => {
  if (req.url === '/api/chat') return relay(req, res);
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(demoPage);
  }
  res.writeHead(404).end();
});

server.listen(port, () => {
  const { port: actual } = server.address();
  console.log(
    `tiny-ai-chat relay on http://localhost:${actual}/api/chat (provider: ${PROVIDER})`
  );
});
