# Changelog

## 0.1.0

First release.

- `<tiny-ai-chat>`: a chat widget registered as a Custom Element with
  lithent, about 8.9 KB brotli for the script-tag bundle. Streaming replies,
  stop, retry, clear, conversation kept per tab, safe Markdown, keyboard and
  screen reader support, full screen on phones, `chat-*` events, CSS
  variables and parts, `inline` and corner positions, light and dark themes.
- `tiny-ai-chat/relay`: `createRelay`, a standard `fetch` handler with
  allowed origins, conversation and output limits, an `onRequest` hook,
  keep-alive and abort on disconnect.
- Adapters on the official SDKs: `tiny-ai-chat/relay/openai` (Responses
  API), `/gemini`, `/anthropic` (server-side fallback on by default), plus
  `/fake` (no key) and `/node` (`toNodeHandler` for Node and Express).
- `tiny-ai-chat/protocol`: the widget–relay protocol types and helpers.
- Templates for Cloudflare Workers and Node.
