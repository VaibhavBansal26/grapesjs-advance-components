# grapesjs-advance-components

A monorepo with two npm packages that work together.

| Package | What it is | Install |
|---|---|---|
| [`grapesjs-advance-components`](packages/grapesjs-advance-components) | GrapesJS plugin: 36 accessible blocks, forms that submit, Stripe checkout, multi-page export, bring-your-own-model AI | `npm i grapesjs grapesjs-advance-components` |
| [`promptsite`](packages/promptsite) | CLI: generate a multi-page site from one sentence, edit it visually, audit it for leaks, serve an API for n8n | `npx promptsite generate "Family bakery in Leeds"` |

📖 **[Documentation](https://vaibhavbansal26.github.io/grapesjs-advance-components/)** · 🧪 **[Playground](https://vaibhavbansal26.github.io/grapesjs-advance-components/playground.html)** · 🎨 **[Block showcase](https://vaibhavbansal26.github.io/grapesjs-advance-components/showcase.html)**

![Generate a site from one sentence, edit it visually, publish it](https://raw.githubusercontent.com/VaibhavBansal26/grapesjs-advance-components/main/docs/assets/demo.gif)

*Real recording of the CLI and editor, using the offline `--provider mock` so no API key is needed. With a key, the model writes the copy.*

**Embedding an editor in your own app?** Use the plugin.
**Want a finished site from a prompt, or an automation (n8n, CI)?** Use `promptsite`.
`promptsite` depends on the plugin; the plugin never depends on it, so embedders carry no CLI or server code.

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
