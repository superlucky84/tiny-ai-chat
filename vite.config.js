import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import lithentVitePlugin from '@lithent/lithent-vite';

// The widget bundle: dist/tiny-ai-chat.js for a <script> tag, and
// dist/tiny-ai-chat.mjs for pages and bundlers that use ES modules.
const fileName = 'tiny-ai-chat';

// How index.html loads the widget during development.
const DEV_SCRIPT = '<script type="module" src="/src/widget/main.ts"></script>';

/**
 * Writes dist/index.html: the same host page as in development, but loading
 * the built bundle with a plain <script> tag, the way a customer's page will.
 */
const hostPage = () => ({
  name: 'widget-host-page',
  apply: 'build',
  generateBundle(output) {
    if (output.format !== 'iife') return;
    const html = readFileSync(
      resolve(import.meta.dirname, 'index.html'),
      'utf8'
    );
    if (!html.includes(DEV_SCRIPT)) {
      this.error(`index.html must load the widget with ${DEV_SCRIPT}`);
    }
    // Types for `import 'tiny-ai-chat'` (the element, its props and events).
    this.emitFile({
      type: 'asset',
      fileName: `${fileName}.d.ts`,
      source: readFileSync(
        resolve(import.meta.dirname, 'src/widget/element.d.ts'),
        'utf8'
      ),
    });
    this.emitFile({
      type: 'asset',
      fileName: 'index.html',
      source: html.replace(
        DEV_SCRIPT,
        `<script src="./${fileName}.js"></script>`
      ),
    });
  },
});

/**
 * `pnpm dev` serves a relay at /api/chat, built from src/ so edits apply on
 * the next request. It uses the demo provider unless .env (gitignored) sets
 * PROVIDER=openai|gemini|anthropic, MODEL and that provider's API key.
 */
const devRelay = () => ({
  name: 'tiny-ai-chat-dev-relay',
  apply: 'serve',
  configureServer(server) {
    const env = loadEnv(server.config.mode, import.meta.dirname, '');
    server.middlewares.use('/api/chat', async (req, res) => {
      const load = path => server.ssrLoadModule(path);
      const { createRelay } = await load('/src/relay/index.ts');
      const { toNodeHandler } = await load('/src/relay/node.ts');
      const name = env.PROVIDER || 'fake';
      const factory = (await load(`/src/relay/${name}.ts`))[name];
      const provider = factory({
        model: env.MODEL,
        apiKey: env[`${name.toUpperCase()}_API_KEY`],
      });
      const relay = createRelay({
        provider,
        system: env.SYSTEM_PROMPT,
        allowedOrigins: '*',
        allowNoOrigin: true,
      });
      toNodeHandler(relay)(req, res);
    });
  },
});

export default defineConfig({
  plugins: [
    // Hot-swaps edited components. A custom element cannot be defined twice,
    // so edits to main.ts, the props or the CSS reload the page instead.
    lithentVitePlugin(),
    hostPage(),
    devRelay(),
    !process.env.VITEST &&
      checker({
        typescript: true,
        eslint: {
          useFlatConfig: true,
          lintCommand: 'eslint "src/**/*.{ts,tsx}"',
        },
      }),
  ],
  build: {
    // Customer pages run on browsers you do not choose: keep the target low.
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/widget/main.ts'),
      formats: ['iife', 'es'],
      name: 'tinyAiChat',
      fileName: format =>
        format === 'es' ? `${fileName}.mjs` : `${fileName}.js`,
    },
  },
  test: {
    // Relay and protocol tests run in Node. Widget tests opt into a DOM with
    // a `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    open: '/',
  },
});
