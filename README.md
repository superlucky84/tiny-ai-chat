# tiny-ai-chat

An AI chat widget for any website in under 10 KB, with a small relay that
keeps your API key on your server and streams answers from OpenAI, Google
Gemini or Anthropic Claude.

```html
<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
<tiny-ai-chat endpoint="https://your-relay.example.com/api/chat"></tiny-ai-chat>
```

- **One script, one tag.** Plain HTML, WordPress, React, Vue: anything that
  can hold a tag. Styles live in Shadow DOM, so the page and the widget do not
  affect each other.
- **Your key stays on your server.** The widget only talks to your relay, a
  standard `fetch` handler for Cloudflare Workers or Node.
- **Streaming, stop and retry**, safe Markdown, the conversation kept across
  page loads in the same tab, keyboard and screen reader support, full screen
  on phones.
- **Bring your own backend.** The widget speaks a small documented protocol
  (JSON in, server-sent events out), so any server can answer it.

**[Live demo](https://superlucky84.github.io/tiny-ai-chat/)** (runs without an AI: prepared replies, the real widget)

> Status: v0.1 in development, not published to npm yet. 한국어:
> [README.ko.md](./README.ko.md)

## Quick start

### 1. Run a relay

The relay holds your API key and forwards the conversation to your provider.

**Cloudflare Workers** — copy [`templates/cloudflare-worker`](./templates/cloudflare-worker),
then:

```bash
npm install
npx wrangler secret put ANTHROPIC_API_KEY   # or the key of your provider
npm run deploy
```

**Node** — copy [`templates/node`](./templates/node), then:

```bash
npm install
npm start          # demo provider, no key: open http://localhost:8787
```

Set `PROVIDER`, `MODEL`, the API key and `ALLOWED_ORIGINS` in `.env` to use a
real provider. Both templates start with a key-free demo provider so you can
see everything work first.

### 2. Put the widget on your site

```html
<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
<tiny-ai-chat
  endpoint="https://your-relay.example.com/api/chat"
  heading="Ask us"
  greeting="Hi! Ask me anything about this site."
></tiny-ai-chat>
```

With a bundler: `npm install tiny-ai-chat` and `import 'tiny-ai-chat'`.

## The widget

### Attributes and properties

| Attribute          | Property          | Default         | Notes                                                              |
| ------------------ | ----------------- | --------------- | ------------------------------------------------------------------ |
| `endpoint`         | `endpoint`        | —               | Your relay, or any server that speaks the [protocol](#protocol)    |
| `heading`          | `heading`         | `Chat`          | Panel title                                                        |
| `greeting`         | `greeting`        | —               | First bubble; not sent to the model                                |
| `placeholder`      | `placeholder`     | `Ask anything…` | Input placeholder                                                  |
| `position`         | `position`        | `bottom-right`  | `bottom-right`, `bottom-left` or `inline` (in place, always open)  |
| `open`             | `open`            | `false`         | Start open                                                         |
| `theme`            | `theme`           | `auto`          | `auto` (system), `light` or `dark`                                 |
| `persist`          | `persist`         | `session`       | Keep the conversation in this tab (`sessionStorage`), or `none`    |
| `max-history`      | `maxHistory`      | `20`            | Most recent messages sent with each question                       |
| `with-credentials` | `withCredentials` | `false`         | Send cookies, for your own backend                                 |
| —                  | `labels`          | English         | `{ open, close, send, stop, retry, clear, typing, error }`         |
| —                  | `headers`         | —               | Extra request headers, for your own backend. Never a provider key. |

### Events

All bubble and are composed, so a listener on `document` hears them.

| Event        | `detail`                                                    |
| ------------ | ----------------------------------------------------------- |
| `chat-open`  | —                                                           |
| `chat-close` | —                                                           |
| `chat-send`  | `{ text }` — cancelable: `preventDefault()` keeps it unsent |
| `chat-reply` | `{ text, reason }` — `stop`, `length`, `refusal`, `aborted` |
| `chat-error` | `{ code, message }` — see the error codes below             |

### Styling

CSS custom properties, set on the element or any ancestor: `--tac-accent`,
`--tac-accent-text`, `--tac-bg`, `--tac-text`, `--tac-muted`, `--tac-border`,
`--tac-radius`, `--tac-font`, `--tac-width`, `--tac-height`, `--tac-z-index`.

Parts for anything else: `tiny-ai-chat::part(launcher | panel | header |
messages | message | form | input | send)`.

```css
tiny-ai-chat {
  --tac-accent: #0f766e;
  --tac-font: 'Inter', sans-serif;
}
```

## The relay

```ts
import { createRelay } from 'tiny-ai-chat/relay';
import { anthropic } from 'tiny-ai-chat/relay/anthropic';

export default {
  fetch: createRelay(env => ({
    provider: anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      model: 'claude-opus-5-5',
    }),
    system: 'You answer questions about example.com. Keep answers short.',
    allowedOrigins: ['https://example.com'],
  })),
};
```

| Adapter                        | Install             | Options                                                        |
| ------------------------------ | ------------------- | -------------------------------------------------------------- |
| `tiny-ai-chat/relay/openai`    | `openai`            | `apiKey`, `model`, `extra` (Responses API parameters)          |
| `tiny-ai-chat/relay/gemini`    | `@google/genai`     | `apiKey`, `model`, `extra` (generation config)                 |
| `tiny-ai-chat/relay/anthropic` | `@anthropic-ai/sdk` | `apiKey`, `model`, `effort`, `fallbacks` (default `'default'`) |
| `tiny-ai-chat/relay/fake`      | —                   | `delayMs` — echoes the visitor, for trying things out          |

`model` is required: pick one from your provider's model list. For Claude the
adapter turns on server-side fallback, so when a model declines a request for
safety reasons another model can continue the reply; pass `fallbacks: false`
to turn it off.

| `createRelay` option | Default         | Notes                                                               |
| -------------------- | --------------- | ------------------------------------------------------------------- |
| `provider`           | required        | One of the adapters above, or your own `{ name, stream() }`         |
| `allowedOrigins`     | required        | Exact origins, or `'*'` written out on purpose                      |
| `system`             | —               | Instructions for the model                                          |
| `maxOutputTokens`    | `4096`          | Per reply                                                           |
| `maxMessages`        | `20`            | Older messages are dropped                                          |
| `maxMessageChars`    | `4000`          | Longer messages get `413`                                           |
| `onRequest`          | —               | `(request, env) => Response \| void` — return a `429` to rate-limit |
| `onError`            | `console.error` | Server-side log; visitors see a generic message                     |
| `allowNoOrigin`      | `false`         | Accept requests without `Origin` (curl, server to server)           |
| `allowCredentials`   | `false`         | Pair with the widget's `with-credentials`; not with `'*'`           |
| `keepAliveMs`        | `10000`         | Comment lines that keep idle connections open                       |

On Node or Express, wrap it: `toNodeHandler(relay)` from
`tiny-ai-chat/relay/node`.

### Before you go public

- **Set a spend limit** in your provider's console. `allowedOrigins` stops
  other websites, but not scripts that fake the `Origin` header.
- **Rate-limit** the relay (Cloudflare rate limiting rules, or `onRequest`).
- **No secrets in `system`.** Visitors can get the model to repeat it.

## Protocol

For your own backend. The widget sends:

```
POST {endpoint}
Content-Type: application/json

{ "messages": [{ "role": "user" | "assistant", "content": "..." }, ...] }
```

and reads `text/event-stream`:

```
event: delta
data: {"text":"Hel"}

event: delta
data: {"text":"lo!"}

event: done
data: {"reason":"stop"}
```

`reason` is `stop`, `length` or `refusal`. A failure during the reply is
`event: error` with `data: {"code","message"}`. Before the stream, answer
with a status and `{ "error": { "code", "message" } }`: `bad_request` (400),
`forbidden_origin` (403), `method_not_allowed` (405), `too_large` (413),
`rate_limited` (429), `internal` (500). `tiny-ai-chat/protocol` exports the
types and an `encodeEvent` helper.

## Built with lithent

The widget is a [lithent](https://github.com/superlucky84/lithent) component
registered as a standard Custom Element with `lithent/element`. lithent and
the element helper are about 5.4 KB of the 8.9 KB bundle.

## Development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev              # host page + relay with the demo provider at /api/chat
pnpm test             # unit tests (Vitest)
pnpm build            # widget, relay and types; checks the 10 KB budget
pnpm test:e2e         # Playwright, after pnpm build
pnpm test:mutations   # breaks safeguards one at a time to check the tests
pnpm check:templates  # runs the relay templates against the build
pnpm check:package    # installs the packed package in an empty project
```

To try a real provider during development, create `.env` (gitignored) with
`PROVIDER`, `MODEL` and `OPENAI_API_KEY` / `GEMINI_API_KEY` /
`ANTHROPIC_API_KEY`.

Design and plan: [docs/v0.1](./docs/v0.1/REQUIREMENTS.md).

## License

[MIT](./LICENSE)
