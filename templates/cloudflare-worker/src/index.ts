/**
 * A tiny-ai-chat relay on Cloudflare Workers. Your API key lives in a Worker
 * secret; the widget only ever talks to this Worker.
 *
 * This file uses Claude. For another provider, swap the import and the
 * `provider` line (and install that SDK instead):
 *
 *   import { openai } from 'tiny-ai-chat/relay/openai';
 *   provider: openai({ apiKey: env.OPENAI_API_KEY, model: env.MODEL }),
 *
 *   import { gemini } from 'tiny-ai-chat/relay/gemini';
 *   provider: gemini({ apiKey: env.GEMINI_API_KEY, model: env.MODEL }),
 */
import { createRelay } from 'tiny-ai-chat/relay';
import { anthropic } from 'tiny-ai-chat/relay/anthropic';
import { fake } from 'tiny-ai-chat/relay/fake';

type Env = {
  /** `fake` to try the Worker without a key; anything else uses Claude. */
  PROVIDER?: string;
  MODEL: string;
  ANTHROPIC_API_KEY: string;
  SYSTEM_PROMPT?: string;
  /** Comma-separated origins, e.g. "https://example.com". */
  ALLOWED_ORIGINS: string;
};

export default {
  fetch: createRelay((env: Env) => ({
    provider:
      env.PROVIDER === 'fake'
        ? fake()
        : anthropic({ apiKey: env.ANTHROPIC_API_KEY, model: env.MODEL }),
    system: env.SYSTEM_PROMPT,
    allowedOrigins: env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(Boolean),
  })),
};
