/**
 * Installs the packed package into an empty project and uses it the way a
 * site or relay author would (run after `pnpm build`):
 *
 * - the tarball holds dist/ and nothing from src/ or the dev host page;
 * - every subpath imports in plain Node ESM, the widget entry included
 *   (it must not throw without a DOM), and a relay built from the package
 *   streams a reply;
 * - a TypeScript file using every subpath type-checks with
 *   moduleResolution Bundler and NodeNext.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const dir = mkdtempSync(join(tmpdir(), 'tac-consumer-'));
try {
  const [packed] = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', dir], root)
  );
  const files = packed.files.map(file => file.path);
  check(
    files.includes('dist/tiny-ai-chat.js'),
    'tarball has the script-tag bundle'
  );
  check(
    files.includes('dist/tiny-ai-chat.d.ts'),
    'tarball has the element types'
  );
  check(files.includes('dist/relay/index.d.ts'), 'tarball has the relay types');
  check(
    !files.some(f => f.startsWith('src/') || f === 'dist/index.html'),
    'tarball leaves out sources and the dev host page'
  );
  console.log(
    `     ${files.length} files, ${(packed.size / 1024).toFixed(1)} KB packed`
  );

  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' })
  );
  const sdks = ['openai', '@google/genai', '@anthropic-ai/sdk'].map(name => {
    const version = JSON.parse(
      readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')
    ).version;
    return `${name}@${version}`;
  });
  const typescript = JSON.parse(
    readFileSync(join(root, 'node_modules/typescript/package.json'), 'utf8')
  ).version;
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      join(dir, packed.filename),
      ...sdks,
      `typescript@${typescript}`,
    ],
    dir
  );

  writeFileSync(
    join(dir, 'runtime.mjs'),
    `import 'tiny-ai-chat';
import { createRelay } from 'tiny-ai-chat/relay';
import { fake } from 'tiny-ai-chat/relay/fake';
import { toNodeHandler } from 'tiny-ai-chat/relay/node';
import { openai } from 'tiny-ai-chat/relay/openai';
import { gemini } from 'tiny-ai-chat/relay/gemini';
import { anthropic } from 'tiny-ai-chat/relay/anthropic';
import { readEventStream } from 'tiny-ai-chat/protocol';
for (const make of [openai, gemini, anthropic]) make({ apiKey: 'k', model: 'm' });
if (typeof toNodeHandler(() => {}) !== 'function') throw new Error('toNodeHandler');
const relay = createRelay({ provider: fake({ delayMs: 0 }), allowedOrigins: ['https://a.example'] });
const res = await relay(new Request('https://r.example', { method: 'POST', headers: { origin: 'https://a.example' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) }));
let end = '';
await readEventStream(res.body, name => { if (name === 'done') end = name; });
console.log(end);
`
  );
  check(
    run('node', ['runtime.mjs'], dir).trim() === 'done',
    'every subpath imports in Node ESM and a packaged relay streams'
  );

  writeFileSync(
    join(dir, 'consumer.ts'),
    `import 'tiny-ai-chat';
import type { ChatReplyDetail, TinyAiChatElement } from 'tiny-ai-chat';
import { createRelay, type Provider } from 'tiny-ai-chat/relay';
import { anthropic } from 'tiny-ai-chat/relay/anthropic';
import { openai } from 'tiny-ai-chat/relay/openai';
import { gemini } from 'tiny-ai-chat/relay/gemini';
import { fake } from 'tiny-ai-chat/relay/fake';
import { toNodeHandler } from 'tiny-ai-chat/relay/node';
import { encodeEvent, type ChatRequest } from 'tiny-ai-chat/protocol';

const chat: TinyAiChatElement | null = document.querySelector('tiny-ai-chat');
if (chat) {
  chat.labels = { send: 'Go' };
  chat.maxHistory = 10;
  chat.addEventListener('chat-reply', event => {
    const detail: ChatReplyDetail = event.detail;
    console.log(detail.reason);
  });
  // @ts-expect-error position only takes the documented values
  chat.position = 'top';
}
const providers: Provider[] = [
  anthropic({ apiKey: 'k', model: 'claude-opus-5-5', effort: 'low' }),
  openai({ apiKey: 'k', model: 'm' }),
  gemini({ apiKey: 'k', model: 'm' }),
  fake(),
];
const handler = createRelay<{ KEY: string }>(env => ({
  provider: anthropic({ apiKey: env.KEY, model: 'claude-opus-5-5' }),
  allowedOrigins: ['https://example.com'],
}));
toNodeHandler(handler);
const body: ChatRequest = { messages: [{ role: 'user', content: 'hi' }] };
encodeEvent({ event: 'done', data: { reason: 'stop' } });
console.log(providers.length, body);
`
  );
  for (const [module, resolution] of [
    ['ESNext', 'Bundler'],
    ['NodeNext', 'NodeNext'],
  ]) {
    try {
      run(
        'npx',
        [
          'tsc',
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--lib',
          'ES2022,DOM,DOM.Iterable',
          '--types',
          'node',
          '--module',
          module,
          '--moduleResolution',
          resolution,
          'consumer.ts',
        ],
        dir
      );
      check(true, `types resolve with moduleResolution ${resolution}`);
    } catch (error) {
      check(
        false,
        `types resolve with moduleResolution ${resolution}\n${error.stdout}`
      );
    }
  }
} catch (error) {
  check(false, `${error.message}\n${error.stdout || ''}${error.stderr || ''}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${failures.length} package check(s) failed.`);
  process.exit(1);
}
console.log('\nThe packed package works for a consumer.');
