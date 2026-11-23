/**
 * Builds the demo site into demo-dist/ (run after `vite build`): the demo
 * page, its in-browser stand-in for a relay, and the widget bundle exactly as
 * a site would load it. GitHub Pages serves demo-dist/ (DESIGN DC-17).
 */
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'demo-dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const file of ['index.html', 'fake-relay.js']) {
  copyFileSync(resolve(root, 'demo', file), resolve(out, file));
}
copyFileSync(
  resolve(root, 'dist/tiny-ai-chat.js'),
  resolve(out, 'tiny-ai-chat.js')
);
console.log('Demo built in demo-dist/.');
