# Releasing

## The first release (0.1.0, by hand)

npm can only trust a CI workflow for a package that already exists, so the
first version is published from your machine.

1. Merge the release PR (version `0.1.0`, `"private"` removed).
2. On an up-to-date `main`, run the checks:

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint && pnpm format:check && pnpm type-check
   pnpm test && pnpm test:mutations
   pnpm build && pnpm check:templates && pnpm check:package
   pnpm test:e2e
   ```

3. Publish. `prepublishOnly` builds `dist/` first.

   ```bash
   npm login
   npm publish --access public
   ```

4. On npmjs.com, open **tiny-ai-chat → Settings → Trusted publishing** and
   add GitHub Actions: owner `superlucky84`, repository `tiny-ai-chat`,
   workflow `release.yml`.
5. Create the GitHub release `v0.1.0` from the CHANGELOG entry. Its tag runs
   the release workflow, which sees 0.1.0 already on npm and skips publishing.

## Later releases (from CI)

1. A PR bumps `version` in `package.json` and adds the CHANGELOG entry.
2. After it merges, create the GitHub release `v<version>` on `main`. The
   release workflow checks the tag against `package.json`, runs the checks
   and publishes with trusted publishing. No npm token is stored anywhere.

## After publishing

- Load `https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js` on a
  test page against a relay (MANUAL_TEST_CHECKLIST M-9).
- Copy `templates/node` somewhere fresh, `npm install`, `npm start`, and chat
  with the demo provider at http://localhost:8787 (it installs the published
  package).
