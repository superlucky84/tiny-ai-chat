/**
 * The demo has no server. This script answers the widget's requests to
 * /demo-relay in the browser, speaking the same protocol as a real relay
 * (JSON in, server-sent events out), so the widget itself is unchanged.
 */
const replies = [
  {
    match: /size|big|small|light|heavy|bundle|kb|lithent|크기|용량|무게/i,
    text:
      'The whole widget is about **8.9 KB** brotli, and about 5.4 KB of that is ' +
      '[lithent](https://github.com/superlucky84/lithent), the UI library it is built with. ' +
      'Your API key and the provider SDKs never reach the browser: they live in the relay.',
  },
  {
    match: /openai|gpt|gemini|claude|anthropic|provider|model/i,
    text:
      'The relay has adapters for **OpenAI**, **Google Gemini** and **Anthropic Claude**, ' +
      'each on the official SDK. Pick one, set `MODEL` and the key, and answers stream in here. ' +
      'This demo uses none of them: the replies are written in advance.',
  },
  {
    match: /install|get started|set ?up|embed|add it|설치|시작/i,
    text:
      'Two steps:\n\n' +
      '1. Deploy a relay from `templates/cloudflare-worker` or `templates/node`. It keeps your API key on the server.\n' +
      '2. Add the widget to your page:\n\n' +
      '```html\n<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>\n' +
      '<tiny-ai-chat endpoint="https://your-relay.example.com/api/chat"></tiny-ai-chat>\n```',
  },
];

const fallback = said =>
  `You asked: *${said.replace(/[*_`[\]]/g, '').slice(0, 120)}*\n\n` +
  'This demo runs **without an AI**, so it answers from a few prepared replies. ' +
  'With a relay, this is where your model would answer. Try asking:\n\n' +
  '- How do I install it?\n' +
  '- How big is it?\n' +
  '- Which AI providers does it support?';

const event = (name, data) =>
  `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

const realFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.endsWith('/demo-relay')) return realFetch(input, init);

  const { messages } = JSON.parse(init.body);
  const said = messages[messages.length - 1].content;
  const reply = (
    replies.find(r => r.match.test(said)) || { text: fallback(said) }
  ).text;
  const words = reply.split(/(?<= )/);
  const encoder = new TextEncoder();
  let timer;

  const body = new ReadableStream({
    start(controller) {
      init.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.error(new DOMException('Aborted', 'AbortError'));
      });
      let i = 0;
      const next = () => {
        if (i < words.length) {
          controller.enqueue(
            encoder.encode(event('delta', { text: words[i++] }))
          );
          timer = setTimeout(next, 35);
        } else {
          controller.enqueue(encoder.encode(event('done', { reason: 'stop' })));
          controller.close();
        }
      };
      // A short pause first, like a model getting started.
      timer = setTimeout(next, 400);
    },
  });
  return Promise.resolve(
    new Response(body, { headers: { 'content-type': 'text/event-stream' } })
  );
};
