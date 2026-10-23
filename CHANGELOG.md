# Changelog

From v2.0.0 onwards releases are generated automatically; see [GitHub Releases](https://github.com/VaibhavBansal26/grapesjs-advance-components/releases).

## 2.0.0

### Added
- AI block generation (`ai.generate`, bring your own provider), `createFetchGenerator`, `aac:ai-generate` command and toolbar button, allowlist HTML sanitizer.
- TypeScript source and published types; ESM, CJS and browser builds via tsup.
- Quote, Header and Footer blocks; h1–h6 heading blocks.
- Tests (vitest) and GitHub Actions CI.

### Changed
- **Breaking:** `grapesjs` is a peer dependency (`>=0.21`) and is no longer bundled.
- **Breaking:** browser build is `dist/index.global.js`.
- FAQ uses `<details>` (it previously had no way to open); slider is responsive CSS scroll-snap; progress bar is a real component driven by traits and ARIA-aware.
- Blocks use inline SVG icons instead of Font Awesome and no longer ship `console.log` scripts.
- Form blocks: unique ids, correct `label for`, escaped option values.

### Removed
- Default entries that never registered a block: countdown, imageFeature, tab, form, checkout, icon.
