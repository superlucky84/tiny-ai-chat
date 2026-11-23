/**
 * Checks what the widget bundles must never contain (REQUIREMENTS RQ-5):
 * provider SDK code, API key handling or provider hosts. The widget only
 * talks to the relay. (HTML injection is ruled out in the widget's source by
 * ESLint: lithent itself supports an innerHTML prop, so the bundle has the
 * word.)
 *
 *   pnpm build   # runs this after the size check
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const forbidden = [
  /api\.openai\.com/i,
  /api\.anthropic\.com/i,
  /generativelanguage\.googleapis\.com/i,
  /@anthropic-ai|@google\/genai|from ["']openai["']/,
  /API_KEY|apiKey|x-api-key|anthropic-dangerous/i,
  /\beval\(|new Function\(/,
];

let failed = false;
for (const file of ['dist/tiny-ai-chat.js', 'dist/tiny-ai-chat.mjs']) {
  const code = readFileSync(resolve(root, file), 'utf8');
  for (const pattern of forbidden) {
    const match = code.match(pattern);
    if (match) {
      failed = true;
      console.error(`${file} contains ${pattern}: "${match[0]}"`);
    }
  }
}
if (failed) process.exit(1);
console.log('Widget bundles hold no provider code or keys.');
