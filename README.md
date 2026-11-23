# tiny-ai-chat

An AI chat widget for any website in about 10 KB, with a small relay that
keeps your API key on the server and streams answers from OpenAI, Google
Gemini or Anthropic Claude.

> **Status: in development (v0.1).** Nothing is published yet. The plan is in
> [docs/v0.1](./docs/v0.1/REQUIREMENTS.md).

```html
<script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
<tiny-ai-chat endpoint="https://your-relay.example.com"></tiny-ai-chat>
```

- **One script, one tag.** Works on any page: plain HTML, WordPress, React,
  Vue. Styles live in Shadow DOM, so the page and the widget do not affect
  each other.
- **Your key stays on your server.** The widget only talks to your relay. The
  relay is a standard `fetch` handler for Cloudflare Workers or Node.
- **Streaming, stop and retry**, conversation kept across page loads in the
  same tab, keyboard and screen reader support.
- **Bring your own backend.** The widget speaks a small documented protocol
  (JSON in, server-sent events out), so any server can answer it.

## Built with lithent

The widget is a [lithent](https://github.com/superlucky84/lithent) component
registered as a Custom Element with `lithent/element`. lithent and the element
helper are about 5.4 KB of the bundle.

## Development

Requires Node.js 22 and pnpm.

```bash
pnpm install
pnpm dev     # host page with the widget
pnpm test
pnpm build   # also checks the 10 KB brotli budget
```

## License

[MIT](./LICENSE)
