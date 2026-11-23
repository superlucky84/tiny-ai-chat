/**
 * Breaks one safeguard at a time and checks that the tests notice
 * (IMPLEMENT Phase 7). Each mutation edits a source file, runs the tests
 * that guard it, and restores the file. A mutation the tests survive fails
 * this script.
 *
 *   pnpm test:mutations
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const mutations = [
  {
    name: 'parser stops holding back a split CRLF',
    file: 'src/shared/protocol.ts',
    from: "const held = buffer.endsWith('\\r');",
    to: 'const held = false;',
    tests: ['src/shared/protocol.test.ts'],
  },
  {
    name: 'relay lets every origin in',
    file: 'src/relay/index.ts',
    from: "? allowedOrigins === '*' || allowedOrigins.includes(origin)",
    to: '? true',
    tests: ['src/relay/relay.test.ts'],
  },
  {
    name: 'relay keeps the provider running after the visitor cancels',
    file: 'src/relay/index.ts',
    from: 'clearInterval(timer);\n        stopUpstream();',
    to: 'clearInterval(timer);',
    tests: ['src/relay/relay.test.ts'],
  },
  {
    name: 'relay shows provider error details to visitors',
    file: 'src/relay/index.ts',
    from: 'message: messages.upstream_error,',
    to: 'message: String(error),',
    tests: ['src/relay/relay.test.ts'],
  },
  {
    name: 'relay lets a conversation start with the assistant',
    file: 'src/relay/index.ts',
    from: "while (history[0].role !== 'user') history.shift();",
    to: '',
    tests: ['src/relay/relay.test.ts'],
  },
  {
    name: 'relay reads a body of any size',
    file: 'src/relay/index.ts',
    from: 'if (text.length > limit) {',
    to: 'if (false) {',
    tests: ['src/relay/relay.test.ts', 'src/relay/node.test.ts'],
  },
  {
    name: 'node adapter keeps the request open after a disconnect',
    file: 'src/relay/node.ts',
    from: 'if (!res.writableFinished) controller.abort();',
    to: '',
    tests: ['src/relay/node.test.ts'],
  },
  {
    name: 'Claude refusals end as "stop"',
    file: 'src/relay/anthropic.ts',
    from: "stop === 'refusal'",
    to: 'false',
    tests: ['src/relay/adapters.test.ts'],
  },
  {
    name: 'markdown links accept any URL',
    file: 'src/widget/markdown.tsx',
    from: 'const SAFE_URL = /^(?:https?:|mailto:)/i;',
    to: 'const SAFE_URL = /^/;',
    tests: ['src/widget/markdown.test.tsx'],
  },
  {
    name: 'widget leaves the sent text in the input',
    file: 'src/widget/ChatWidget.tsx',
    from: "if (input.value) input.value.value = '';",
    to: '',
    tests: ['src/widget/ChatWidget.test.ts'],
  },
  {
    name: 'widget sends while an IME is composing',
    file: 'src/widget/ChatWidget.tsx',
    from: '!event.isComposing &&',
    to: '',
    tests: ['src/widget/ChatWidget.test.ts'],
  },
];

const vitest = resolve(root, 'node_modules/.bin/vitest');
const survivors = [];

for (const mutation of mutations) {
  const path = resolve(root, mutation.file);
  const original = readFileSync(path, 'utf8');
  if (original.split(mutation.from).length !== 2) {
    console.error(
      `FAIL ${mutation.name}: the text to change is not in ${mutation.file} exactly once`
    );
    survivors.push(mutation.name);
    continue;
  }
  writeFileSync(path, original.replace(mutation.from, mutation.to));
  try {
    const run = spawnSync(vitest, ['run', ...mutation.tests], {
      cwd: root,
      encoding: 'utf8',
    });
    const caught = run.status !== 0;
    console.log(`${caught ? 'caught  ' : 'SURVIVED'} ${mutation.name}`);
    if (!caught) survivors.push(mutation.name);
  } finally {
    writeFileSync(path, original);
  }
}

if (survivors.length) {
  console.error(`\n${survivors.length} mutation(s) survived the tests.`);
  process.exit(1);
}
console.log(`\nAll ${mutations.length} mutations caught.`);
