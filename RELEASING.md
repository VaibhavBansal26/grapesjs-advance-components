# Releasing

Two packages, released independently with [release-please](https://github.com/googleapis/release-please) in manifest mode (`release-please-config.json`, `.release-please-manifest.json`).

## How a release happens

1. Merge changes to `main` using [Conventional Commits](https://www.conventionalcommits.org): `fix:` is a patch, `feat:` a minor, `feat!:` or a `BREAKING CHANGE:` footer a major. `docs:`, `chore:`, `test:` do not release.
2. After tests pass, the **Release** workflow opens or updates one **Release PR per package**: version bump, changelog, manifest.
3. **Merging a Release PR** tags it, creates the GitHub release and publishes that package to npm with provenance. Nothing is published until you merge one.
4. Commits are attributed to a package by the files they touch (`packages/<name>/`). If the plugin changes, the `node-workspace` plugin also updates `promptsite`'s dependency range.

The `promptsite` CLI depends on the plugin, so the plugin is always published first. There is no npm token in this repository.

## The first release (one-time setup)

Publishing uses **npm trusted publishing** (OIDC), so no npm token is stored in GitHub. That only works for packages that already exist on npm, so `promptsite` needs one manual bootstrap publish.

Both packages are forced to their first versions in `release-please-config.json` with `release-as`: the plugin goes 1.0.7 → **2.2.0**, `promptsite` goes 0.0.1 → **0.1.0**. (2.0.0 and 2.1.0 were published automatically from the first two merges, before the packages were split, so the real release starts at 2.2.0. Once 2.2.0 is out, remove both `release-as` lines so versions follow the commits.)

1. **Bootstrap `promptsite` by hand** (once, from your machine):
   ```bash
   npm login
   npm install && npm run build
   npm publish -w promptsite --access public     # publishes 0.0.1
   ```
   `0.0.1` is only the bootstrap. It depends on plugin 2.0.0, which is not published yet, so nobody should install it: you can run `npm deprecate promptsite@0.0.1 "bootstrap build, use 0.1.0 or later"` afterwards.
2. **Create the GitHub environment** `npm` (Settings → Environments). Optionally add yourself as a required reviewer, so every publish waits for your approval.
3. **Configure the trusted publisher on npmjs.com**, for each package (`grapesjs-advance-components` and `promptsite`): package → Settings → Trusted Publisher → GitHub Actions, then enter owner `VaibhavBansal26`, repository `grapesjs-advance-components`, workflow file `release.yml` and environment `npm`. The fields are case-sensitive and must match exactly, or npm refuses with a 403. Then, in each package's publishing settings, turn on "Require two-factor authentication and disallow tokens".
4. **Merge the two Release PRs.** The plugin publishes first, then `promptsite`. The 2.0.0 notes only list commits that touched `packages/`, so paste the descriptions from the earlier PRs into that GitHub release by hand.
5. **Remove `release-as`** from `release-please-config.json` in a follow-up commit, so later versions follow the commits.

If trusted publishing fails (a 403 or "need auth"), the fallback is a token: create an npm *granular* token limited to the two packages, store it as the secret `NPM_TOKEN` in the `npm` environment, and add `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` to the two publish steps. Delete it again once trusted publishing works.

## Things to watch

- **Lockfile:** release-please bumps `package.json` versions but not `package-lock.json`. If `npm ci` complains on a Release PR, run `npm install` on that branch and push the lockfile.
- **Pinned actions:** every action in `.github/workflows` is pinned to a commit SHA. Dependabot proposes updates (with the tag in a comment); the CI on those PRs is the test.
- **A third package** goes in `packages/<name>/`, plus an entry in `release-please-config.json`, the manifest, and the `publish` job.
