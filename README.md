# grapesjs-advance-components

**From one sentence to a deployable website, with your own model and your own files.**

```bash
npm i -D grapesjs grapesjs-advance-components jsdom
export ANTHROPIC_API_KEY=sk-ant-...      # your key, read from the environment, never stored

npx aac generate "Family bakery in Leeds, sourdough and custom cakes, order online" --template local-business --out ./bakery
npx aac edit ./bakery                    # polish it visually at http://127.0.0.1:4173, then press Publish
```

You get an editable project plus plain static HTML, CSS and JS (no framework, works under a strict CSP): multi-page, with a working contact form, optional Stripe checkout buttons, and a brand colour of your choice. No key yet? Add `--provider mock` to try the whole pipeline offline. The model writes validated JSON copy that templates render into the package's own blocks, so output is safe by construction and fully editable. [How it works and what it does not do](https://vaibhavbansal26.github.io/grapesjs-advance-components/#generate).

Under the CLI is a GrapesJS plugin you can embed in your own app:

Ready-made, accessible [GrapesJS](https://grapesjs.com) blocks and components, with optional **AI block generation** that works with any model provider (bring your own; no API key is ever stored in this package).

- 32 blocks: hero, features, call to action, FAQ, headings h1–h6, paragraph, quote, list, link, button, divider, progress bar, slider, header, footer, map, image, video, form fields, **contact form and newsletter that submit**, **Stripe checkout button and pricing card**
- **Multi-page editing** with one-call export to a standalone static site (.zip)
- No Font Awesome or runtime script needed: the FAQ is native `<details>`, the slider is CSS scroll-snap
- Themeable with CSS custom properties
- TypeScript types, ESM + CJS + browser (`<script>`) builds

📖 **[Documentation](https://vaibhavbansal26.github.io/grapesjs-advance-components/)** · 🧪 **[Playground](https://vaibhavbansal26.github.io/grapesjs-advance-components/playground.html)**

## Install

```bash
npm i grapesjs grapesjs-advance-components
```

```js
import grapesjs from 'grapesjs';
import advanceComponents from 'grapesjs-advance-components';

grapesjs.init({
  container: '#gjs',
  plugins: [advanceComponents],
  pluginsOpts: { [advanceComponents]: { /* options */ } },
});
```

Or from a CDN:

```html
<link href="https://unpkg.com/grapesjs/dist/css/grapes.min.css" rel="stylesheet" />
<script src="https://unpkg.com/grapesjs"></script>
<script src="https://unpkg.com/grapesjs-advance-components"></script>
<script>
  grapesjs.init({ container: '#gjs', plugins: ['grapesjs-advance-components'] });
</script>
```

`grapesjs` (≥ 0.21) is a **peer dependency**: the plugin uses the editor you pass it and never bundles its own copy.

## Blocks

| Block | Block id(s) |
|---|---|
| FAQ (accordion) | `faq-block` |
| Heading | `heading-h1-block` … `heading-h6-block` |
| Paragraph | `paragraph-block` |
| Quote | `quote-block` |
| List | `list-block` |
| Link | `link-block` |
| Button | `button-block` |
| Divider | `divider-block` |
| Progress bar (percentage + colour traits) | `progress-bar-block` |
| Slider | `slider-block` |
| Header / Footer | `header-block`, `footer-block` |
| Map | `map-block` |
| Image / Video | `image-block`, `video-block` |
| Input, checkbox, radio | `input-element-<type>-block` |
| Select | `dropdown-block` |
| Textarea | `textarea-block` |
| Hero, Features, Call to action | `hero-block`, `features-block`, `cta-block` |
| Contact form, Newsletter | `form-block`, `newsletter-block` |
| Stripe checkout button | `checkout-button-block` |
| Pricing card | `pricing-block` |

## Options

```ts
{
  components: ComponentOption[], // add, replace (by `name`) or hide (`visible: false`) blocks
  injectStyles: true,            // set false to ship your own CSS for the .aac-* classes
  i18n: {},                      // extra messages per locale
  ai: { generate },              // see below; omit to disable AI entirely
}
```

```js
components: [
  { label: 'Faq', name: 'faq', componentType: 'faq', visible: false },          // hide
  { label: 'Email', name: 'email', category: 'Form', componentType: 'inputElement',
    formElement: { type: 'email', name: 'email', label: 'Email', placeholder: 'you@example.com' } },
]
```

### Theming

The blocks look finished with no setup; every colour and the corner radius read a CSS custom property:

```css
:root { --aac-accent: #0d9488; --aac-radius: 4px; }   /* re-skin */
```
```html
<body data-aac-theme="dark">   <!-- dark pages: any ancestor works -->
```

Tokens: `--aac-accent`, `--aac-accent-hover`, `--aac-accent-fg`, `--aac-fg`, `--aac-muted`, `--aac-border`, `--aac-bg`, `--aac-surface`, `--aac-track`, `--aac-ring`, `--aac-radius`, `--aac-radius-lg`, `--aac-shadow`. Hover, active and keyboard-focus states, responsive rules and `prefers-reduced-motion` are built in. Typography is inherited from your page. See the [block showcase](https://vaibhavbansal26.github.io/grapesjs-advance-components/showcase.html).

## AI block generation

Describe what you want ("pricing FAQ for a project-management SaaS") and the plugin puts it on the canvas as editable components. It can insert below the selection or rewrite the selected component. Undo works as usual.

You supply the model call, so there is no vendor lock-in and **no key in the browser**:

```js
import advanceComponents, { createFetchGenerator } from 'grapesjs-advance-components';

pluginsOpts: {
  [advanceComponents]: {
    ai: {
      // POSTs { prompt, system, mode, currentHtml } to YOUR server, expects { html }
      generate: createFetchGenerator('/api/ai'),
    },
  },
}
```

[`examples/ai-server.mjs`](examples/ai-server.mjs) is a ~60-line backend that forwards to the Anthropic Messages API (`ANTHROPIC_API_KEY=… node examples/ai-server.mjs`). Any provider works, since all the plugin needs is a function returning HTML:

```js
ai: {
  generate: async ({ prompt, system, mode, currentHtml, signal }) => {
    const html = await myBackend.complete({ system, prompt, currentHtml, signal });
    return html; // string, or { html }
  },
}
```

| `ai` option | Default | |
|---|---|---|
| `generate` | required | `(req) => Promise<string \| { html }>` |
| `sanitize` | built-in allowlist | replace the sanitizer (must return safe HTML) |
| `system` | built-in prompt | system prompt sent with each request |
| `toolbar` | `true` | ✨ button on the toolbar of selected components |
| `commandId` | `aac:ai-generate` | |
| `timeoutMs` | `60000` | |

Open the dialog from your own UI, or generate headlessly:

```js
editor.runCommand('aac:ai-generate');                                   // dialog
await editor.runCommand('aac:ai-generate', { prompt: 'Hero for a coffee shop' });
await editor.runCommand('aac:ai-generate', { prompt: 'Make it shorter', mode: 'replace' });
editor.on('aac:ai:generated', ({ prompt, mode, components }) => {});
```

### Safety

Model output is untrusted. Everything is passed through an allowlist sanitizer before reaching the canvas or exported HTML: `<script>`, `<iframe>`, `<svg>`, event-handler attributes, `javascript:` / `data:` / protocol-relative URLs and CSS `url()` are removed. Pass your own `sanitize` if you need a different policy, and keep the API key and rate limiting on your server.

## Forms that submit

The contact form and newsletter blocks validate, include a honeypot, show live status, and POST JSON (or form-encoded data) to your endpoint or a form service. They fall back to a plain POST without JavaScript, refuse non-https endpoints, and emit cancelable `aac:form-submit` / `aac:form-success` / `aac:form-error` events. See the [docs](https://vaibhavbansal26.github.io/grapesjs-advance-components/#forms).

## Stripe checkout

The checkout button redirects to a Stripe-hosted page (a Payment Link, or a Checkout Session your backend creates). Card data never touches your page and no secret key is involved. Redirects are restricted to `payments.allowedHosts` (default `checkout.stripe.com`, `buy.stripe.com`) and the button emits cancelable `aac:checkout` / `aac:checkout-error` events. See the [docs](https://vaibhavbansal26.github.io/grapesjs-advance-components/#payments).

## Multi-page sites

A Pages button in the editor opens a manager (add, rename, switch, delete, download). Link pages with `href="page:about"`. From code:

```js
import { exportSite, exportSiteFiles, createZip } from 'grapesjs-advance-components';
const files = exportSiteFiles(editor);                        // { 'index.html': '…', 'about.html': '…' }
const strict = exportSiteFiles(editor, { assets: 'external' }); // + .css/.js files, for strict CSP sites
```

## Security and automation

Generated sites are scanned before anything is written: a secret-shaped value (Anthropic, OpenAI, Stripe secret, GitHub, AWS keys, private keys, credentials or tokens in URLs) or exploitable markup stops `generate`, `build`, the editor's Save/Publish and the API, and findings are shown redacted. Exports include a strict-CSP `_headers` file (no inline script or style). Keys are read from the environment only, and errors are redacted before they reach the terminal.

```bash
npx aac audit ./site --strict        # fail CI on a leak or unsafe markup
AAC_API_TOKEN="$(openssl rand -hex 24)" npx aac serve --root ./sites   # HTTP API for n8n, Zapier or cron
```

`aac serve` needs a 24+ character bearer token, listens on loopback, rejects browser requests, and limits jobs and hourly volume. An importable n8n workflow is in [`examples/n8n`](examples/n8n). No tool can promise zero leaks: everything in a static site is public, and a webhook URL is a bearer credential. Read [what is and is not covered](https://vaibhavbansal26.github.io/grapesjs-advance-components/#security) and [SECURITY.md](SECURITY.md).

## Migrating from v1

- `grapesjs` is now a peer dependency; install it yourself.
- Block ids are unchanged. `heading-block` now registers h1–h6 unless `headingType` is set.
- Removed entries that never produced a block (`countdown`, `imageFeature`, `tab`, `form`, `icon`). `checkout` now exists for real.
- FAQ, slider, progress bar, divider and form markup/classes changed (`aac-*`); pages saved with v1 keep their own inline `<style>` and still render.
- The `console.log` placeholder scripts are gone. The `iife` build file is now `dist/index.global.js`.

## Development

```bash
npm i
npm test           # vitest + jsdom (headless GrapesJS)
npm run build      # dist/ (esm, cjs, d.ts, global)
npm run docs                  # builds and copies dist into docs/
python3 -m http.server 8000   # then open /docs/playground.html
```

## License

MIT

## Releases

Releases are automatic. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): a push to `main` publishes `fix:` as a patch, `feat:` as a minor and `feat!:` / `BREAKING CHANGE:` as a major, with npm provenance and GitHub release notes.
