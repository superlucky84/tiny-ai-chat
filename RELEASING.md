# Releasing

## Before the first release

1. Merge the release PR. It sets the version, removes `"private": true` from
   `package.json` and fills in the date in `CHANGELOG.md`.
2. Check locally on the release commit:

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint && pnpm format:check && pnpm type-check
   pnpm test && pnpm test:mutations
   pnpm build && pnpm check:templates && pnpm check:package
   pnpm test:e2e
   ```

3. Publish the first version by hand. npm trusted publishing can only be set
   up for a package that already exists:

   ```bash
   npm login
   npm publish --access public
   ```

4. On npmjs.com, open the package settings and add a trusted publisher for
   this repository's release workflow, so later versions publish from CI
   without a token.
5. Tag the release (`v0.1.0`) and create the GitHub release from the
   CHANGELOG entry.

## After publishing

- Load the widget from `https://cdn.jsdelivr.net/npm/tiny-ai-chat/dist/tiny-ai-chat.js`
  on a test page against a relay (MANUAL_TEST_CHECKLIST M-9).
- Run the Node template from a fresh copy with `npm install` (it depends on
  the published `tiny-ai-chat`).
