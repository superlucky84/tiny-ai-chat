import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
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

export default defineConfig({
  plugins: [
    // Hot-swaps edited components. A custom element cannot be defined twice,
    // so edits to main.ts, the props or the CSS reload the page instead.
    lithentVitePlugin(),
    hostPage(),
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
