# tiny-ai-chat relay for Node

Keeps your AI provider's API key on your server and streams answers to the
`<tiny-ai-chat>` widget.

## Try it without a key

```bash
npm install
npm start
```

Open http://localhost:8787. The chat in the corner talks to this relay, and
the demo provider echoes what you type.

## Connect a provider

1. Install the SDK of the provider you use, only that one:

   ```bash
   npm install openai              # OpenAI
   npm install @google/genai       # Gemini
   npm install @anthropic-ai/sdk   # Claude
   ```

2. Copy `.env.example` to `.env` and set `PROVIDER`, `MODEL`, the matching
   API key, `SYSTEM_PROMPT` and `ALLOWED_ORIGINS` (your site, for example
   `https://example.com`).
3. `npm start`, then put the widget on your site:

   ```html
   <script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
   <tiny-ai-chat endpoint="https://your-relay.example.com/api/chat"></tiny-ai-chat>
   ```

## Before you go public

- Set a monthly spend limit in your provider's console. `ALLOWED_ORIGINS`
  stops other websites, but not scripts that fake the `Origin` header.
- Add rate limiting in front of the relay, or with `onRequest` in
  `createRelay` (it can return a `429` response).
- Do not put secrets in `SYSTEM_PROMPT`: visitors can get the model to
  repeat it.
- Already have an Express app? `app.use('/api/chat', toNodeHandler(relay))`,
  mounted before any body parser.
