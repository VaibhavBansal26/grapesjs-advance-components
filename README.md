# One sentence to an audited, ready-to-deploy website

[![CI](https://github.com/VaibhavBansal26/grapesjs-advance-components/actions/workflows/ci.yml/badge.svg)](https://github.com/VaibhavBansal26/grapesjs-advance-components/actions/workflows/ci.yml)
[![promptsite on npm](https://img.shields.io/npm/v/promptsite?label=promptsite)](https://www.npmjs.com/package/promptsite)
[![grapesjs-advance-components on npm](https://img.shields.io/npm/v/grapesjs-advance-components?label=grapesjs-advance-components)](https://www.npmjs.com/package/grapesjs-advance-components)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Two npm packages that work together:

- **[`promptsite`](packages/promptsite)**, a command line tool. It writes a multi-page site from one sentence with your own model, lets you polish it in a visual editor, **audits it for leaked secrets**, and deploys it to Cloudflare Pages or Netlify.
- **[`grapesjs-advance-components`](packages/grapesjs-advance-components)**, a GrapesJS plugin with 41 accessible, themeable blocks (pricing, testimonials, team, tabs, forms that submit, Stripe checkout and more), `defineComponent` for your own blocks, and multi-page export.

```bash
npx promptsite generate "Family bakery in Leeds, sourdough and custom cakes" --template small-business
npx promptsite edit ./site                  # polish it visually, then press Publish
npx promptsite deploy ./site --to cloudflare --project my-site --dry-run
```

![Generate a site from one sentence, edit it visually, publish it](https://raw.githubusercontent.com/VaibhavBansal26/grapesjs-advance-components/main/docs/assets/demo.gif)

*A real recording using the offline `--provider mock`, so no API key is needed. With a key, your model writes the copy.*

📖 **[Documentation](https://vaibhavbansal26.github.io/grapesjs-advance-components/)** · 🧪 **[Playground](https://vaibhavbansal26.github.io/grapesjs-advance-components/playground.html)** · 🎨 **[Block showcase, three themes](https://vaibhavbansal26.github.io/grapesjs-advance-components/showcase.html)**

**Embedding an editor in your own app?** Use the plugin.
**Want a finished site from a prompt, or an automation (n8n, CI)?** Use `promptsite`.
`promptsite` depends on the plugin; the plugin never depends on it and has no runtime dependencies, so embedders carry no CLI or server code.

## Can I rely on it?

It is a small, single-maintainer project, so here is what is checked instead of asking you to trust it:

- **Tested across versions.** Every change runs the plugin tests on Node 18, 20 and 22, against GrapesJS 0.21, 0.22 and the latest release, and the CLI tests on Node 18, 20 and 22.
- **Releases are traceable.** Both packages are published from GitHub Actions with npm provenance (no long-lived npm token), and each release lists what changed.
- **Leaks are blocked, not just reported.** `promptsite audit` (and `promptsite deploy`, which runs it first) fails on committed API keys and unsafe markup. Credentials are read from the environment and never accepted as flags.
- **Honest limits.** The generated copy is a draft, and `promptsite deploy` is tested with a fake runner but not yet against a live Cloudflare or Netlify account. The docs say so where it applies.
- **MIT licensed**, and [SECURITY.md](SECURITY.md) says how to report a problem.

## Will it clash with my design?

The blocks look finished with no setup, and every colour and the corner radius reads a CSS custom property. One line re-skins them:

```css
:root { --aac-accent: #0ea5e9; --aac-radius: 4px; }   /* brand colour, corners */
/* a dark page: <body data-aac-theme="dark"> */
```

Or turn the stylesheet off (`injectStyles: false`) and style the `.aac-*` classes yourself. See the [showcase](https://vaibhavbansal26.github.io/grapesjs-advance-components/showcase.html) (light, dark and a teal re-skin of the same blocks) and [Theming](https://vaibhavbansal26.github.io/grapesjs-advance-components/#theming).

## How it fits with other GrapesJS plugins

It is meant to sit beside them, not replace them.

| You need | Use |
|---|---|
| Layout columns, basic text, link, image, video | [`grapesjs-blocks-basic`](https://www.npmjs.com/package/grapesjs-blocks-basic) |
| A full editor UI preset | [`grapesjs-preset-webpage`](https://www.npmjs.com/package/grapesjs-preset-webpage) |
| Paste raw HTML or script into a block | [`grapesjs-custom-code`](https://www.npmjs.com/package/grapesjs-custom-code) |
| **Finished marketing sections, forms that post to your endpoint, Stripe checkout, tabs, and a way to build your own tested blocks** | **this plugin** |
| **A whole site from a prompt, audited and deployable** | **`promptsite`** |

## Repository layout

```
packages/grapesjs-advance-components/   the plugin (browser)
packages/promptsite/                    the CLI and API server (Node)
docs/                                   documentation site and playground (GitHub Pages)
.github/workflows/                      CI, docs deploy, release
```

## Development

```bash
npm install            # links both packages into node_modules
npm run build          # plugin first, then the CLI
npm run typecheck
npm test               # both packages
npm run docs           # builds the plugin and copies it into docs/ for local preview
```

## Releases

Each package is versioned and released on its own with [release-please](https://github.com/googleapis/release-please). Commit with [Conventional Commits](https://www.conventionalcommits.org); a Release PR per package opens automatically, and merging it tags, creates the GitHub release and publishes to npm with provenance. See [RELEASING.md](RELEASING.md).

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability and for what is and is not covered.

## License

MIT
