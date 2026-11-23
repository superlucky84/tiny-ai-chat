/**
 * Runs the relay templates against the built package (run after `pnpm build`):
 *
 * - templates/node: starts server.mjs with the demo provider, then checks the
 *   stream, the origin check and the demo page.
 * - templates/cloudflare-worker: type-checks src/index.ts against the
 *   package's published types, then calls its fetch handler in Node with
 *   PROVIDER=fake.
 *
 * Each template is copied to a temporary folder whose node_modules links
 * tiny-ai-chat to this repository, the way an installed copy would resolve.
 */
import { spawn } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const SITE = 'https://site.example';
const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

const copyTemplate = name => {
  const dir = mkdtempSync(join(tmpdir(), `tac-${name}-`));
  cpSync(join(root, 'templates', name), dir, { recursive: true });
  const link = (pkg, target) => {
    const path = join(dir, 'node_modules', pkg);
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(target, path, 'dir');
  };
  link('tiny-ai-chat', root);
  return { dir, link };
};

const readStream = async response => {
  const { readEventStream } = await import(
    pathToFileURL(join(root, 'dist/shared/protocol.js'))
  );
  let text = '';
  let end = '';
  await readEventStream(response.body, (name, data) => {
    if (name === 'delta') text += JSON.parse(data).text;
    if (name === 'done') end = JSON.parse(data).reason;
  });
  return { text, end };
};

const ask = (url, origin = SITE) =>
  fetch(url, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
  });

// ---- templates/node ------------------------------------------------------

{
  const { dir } = copyTemplate('node');
  const server = spawn(process.execPath, ['server.mjs'], {
    cwd: dir,
    env: { ...process.env, PROVIDER: 'fake', PORT: '0', ALLOWED_ORIGINS: SITE },
  });
  try {
    const url = await new Promise((resolveUrl, reject) => {
      const timer = setTimeout(
        () => reject(new Error('server did not start')),
        10000
      );
      let output = '';
      server.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/http:\/\/localhost:(\d+)\/api\/chat/);
        if (match) {
          clearTimeout(timer);
          resolveUrl(`http://127.0.0.1:${match[1]}`);
        }
      });
      server.stderr.on('data', chunk => (output += chunk));
      server.on('exit', code =>
        reject(new Error(`server exited ${code}: ${output}`))
      );
    });
    const response = await ask(`${url}/api/chat`);
    const { text, end } = await readStream(response);
    check(
      response.status === 200 && end === 'stop',
      'node: streams a reply that ends with done'
    );
    check(
      text.startsWith('You said: *hello*'),
      'node: the demo provider echoes the message'
    );
    check(
      (await ask(`${url}/api/chat`, 'https://evil.example')).status === 403,
      'node: refuses other origins'
    );
    const page = await fetch(`${url}/`);
    check(
      page.status === 200 &&
        (await page.text()).includes('<tiny-ai-chat endpoint="/api/chat"'),
      'node: serves the demo page'
    );
    check(
      (await fetch(`${url}/nope`)).status === 404,
      'node: 404 for other paths'
    );
  } catch (error) {
    check(false, `node: ${error.message}`);
  } finally {
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- templates/cloudflare-worker ----------------------------------------

{
  const { dir, link } = copyTemplate('cloudflare-worker');
  link('@anthropic-ai/sdk', join(root, 'node_modules/@anthropic-ai/sdk'));
  try {
    const entry = join(dir, 'src/index.ts');
    const program = ts.createProgram([entry], {
      strict: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
      types: [],
      skipLibCheck: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    check(
      diagnostics.length === 0,
      `worker: src/index.ts type-checks against the package types${
        diagnostics.length
          ? `\n${ts.formatDiagnostics(diagnostics, {
              getCanonicalFileName: f => f,
              getCurrentDirectory: () => dir,
              getNewLine: () => '\n',
            })}`
          : ''
      }`
    );

    const { outputText } = ts.transpileModule(
      (await import('node:fs')).readFileSync(entry, 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }
    );
    const compiled = join(dir, 'src/index.mjs');
    writeFileSync(compiled, outputText);
    const worker = (await import(pathToFileURL(compiled))).default;
    const env = {
      PROVIDER: 'fake',
      MODEL: 'm',
      ANTHROPIC_API_KEY: '',
      ALLOWED_ORIGINS: SITE,
    };
    const response = await worker.fetch(
      new Request('https://relay.example/', {
        method: 'POST',
        headers: { origin: SITE },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
        }),
      }),
      env
    );
    const { text, end } = await readStream(response);
    check(
      response.status === 200 && end === 'stop' && text.startsWith('You said'),
      'worker: fetch streams a reply with PROVIDER=fake'
    );
  } catch (error) {
    check(false, `worker: ${error.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(`\n${failures.length} template check(s) failed.`);
  process.exit(1);
}
console.log('\nAll template checks passed.');
