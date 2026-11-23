# tiny-ai-chat relay for Cloudflare Workers

Keeps your AI provider's API key in a Worker secret and streams answers to the
`<tiny-ai-chat>` widget.

1. Install and log in:

   ```bash
   npm install
   npx wrangler login
   ```

2. Edit `wrangler.toml`: set `ALLOWED_ORIGINS` to your site, `SYSTEM_PROMPT`
   to what the chat should do, and `MODEL`. Leave `PROVIDER = "fake"` for a
   first try without a key.
3. Deploy: `npm run deploy`. Wrangler prints the Worker's URL.
4. Put the widget on your site:

   ```html
   <script src="https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js"></script>
   <tiny-ai-chat endpoint="https://tiny-ai-chat-relay.<you>.workers.dev"></tiny-ai-chat>
   ```

5. Go live with Claude: add the key as a secret, remove `PROVIDER = "fake"`,
   deploy again.

   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY
   npm run deploy
   ```

OpenAI or Gemini instead: see the comment at the top of `src/index.ts`, and
install `openai` or `@google/genai` in place of `@anthropic-ai/sdk`.

## Before you go public

- Set a monthly spend limit in your provider's console. `ALLOWED_ORIGINS`
  stops other websites, but not scripts that fake the `Origin` header.
- Add rate limiting (Cloudflare's rate limiting rules, or `onRequest` in
  `createRelay`, which can return a `429` response).
- Do not put secrets in `SYSTEM_PROMPT`: visitors can get the model to
  repeat it.
