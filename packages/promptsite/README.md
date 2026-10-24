# promptsite

**From one sentence to a deployable website, with your own model and your own files.**

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # your key, read from the environment, never stored

npx promptsite generate "Family bakery in Leeds, sourdough and custom cakes, order online" --template local-business --out ./bakery
npx promptsite edit ./bakery             # polish it visually at http://127.0.0.1:4173, then press Publish
```

You get an editable project plus plain static HTML, CSS and JS (no framework, no inline code, works under a strict CSP): multi-page, with a working contact form, optional Stripe checkout buttons, and a brand colour of your choice. No key yet? Add `--provider mock` to try the whole pipeline offline.

The model writes **validated JSON copy**, not markup. Templates render that copy into the blocks of [`grapesjs-advance-components`](https://www.npmjs.com/package/grapesjs-advance-components) and escape every string, so the output is safe by construction and fully editable afterwards.

📖 **[Documentation](https://vaibhavbansal26.github.io/grapesjs-advance-components/#generate)**

## Commands

| Command | Does |
|---|---|
| `promptsite generate "<brief>"` | Draft a multi-page site and write it to a folder |
| `promptsite edit <dir>` | Visual editor on localhost (autosave, **Publish** writes `public/`) |
| `promptsite build <dir>` | Re-render `project.json` to `public/` (for CI) |
| `promptsite audit <dir>` | Scan a site or any folder for leaked secrets and unsafe markup |
| `promptsite serve --root <dir>` | HTTP API for n8n, Zapier or cron (needs `PROMPTSITE_API_TOKEN`) |
| `promptsite templates` | List the templates |

Templates: `landing` (Home, Pricing, Contact), `local-business` (Home, About, Contact), `small-business` (Home, Services, About, Journal, Contact: testimonials, pricing, FAQ, team and a blog list), `shop` (Home with Stripe buttons, Contact).

Useful flags: `--name`, `--accent "#0d9488"`, `--theme dark`, `--payment-link <Stripe Payment Link>`, `--form-endpoint <url>`, `--provider anthropic|endpoint|mock`, `--endpoint <your backend>`, `--model <id>`. Run `promptsite --help` for all of them.

```
bakery/
  project.json        the editable GrapesJS project
  promptsite.json     your settings (never a secret)
  public/             index.html, about.html, contact.html + .css + .js + _headers (strict CSP)
```

## Security

Nothing reaches disk or a browser that looks like a secret:

- **Keys stay in the environment.** `ANTHROPIC_API_KEY` and `PROMPTSITE_API_TOKEN` are never read from flags or written to files. The editor's ✨ button calls the model through the local server.
- **Fail-closed scan.** Anthropic, OpenAI, Stripe secret, GitHub, AWS and Slack keys, private keys, credentials or secret-looking parameters in URLs, `javascript:` URLs, inline handlers and plain-http forms stop `generate`, `build`, the editor's Save/Publish and the API. Findings are shown redacted. `--allow <rule>` is the explicit opt-out.
- **Redacted logs.** Errors are stripped of key formats and of the exact key values in use.
- **Strict CSP.** Exports include a `_headers` file (Netlify, Cloudflare Pages): no inline script or style, `connect-src` limited to your form endpoint.
- **Closed servers.** `edit` and `serve` listen on loopback only. `serve` needs a 24+ character bearer token, throttles failures, rejects browser requests, caps body size, jobs and hourly volume, and confines each site to its own folder. `edit` rejects any foreign `Host` or `Origin`.

```bash
npx promptsite audit ./bakery --strict   # fail CI on a leak or unsafe markup
```

**What cannot be promised:** everything in a static site is public (form endpoints, Payment Links); a webhook URL, including an n8n one, is a bearer credential; the scanner is heuristic; and your brief goes to the model provider. Details in [SECURITY.md](https://github.com/VaibhavBansal26/grapesjs-advance-components/blob/main/SECURITY.md).

## Automation (n8n, CI)

```bash
export PROMPTSITE_API_TOKEN="$(openssl rand -hex 24)"
npx promptsite serve --root ./sites      # http://127.0.0.1:8787
```

`POST /v1/generate`, `/v1/build`, `/v1/audit`, `GET /v1/sites` and `/v1/sites/<slug>/bundle.zip`, all with `Authorization: Bearer $PROMPTSITE_API_TOKEN`. An importable n8n workflow (webhook → generate → audit → respond) is in [`examples/n8n`](examples/n8n); it is written from n8n's documented formats and structure-tested, but has not been run inside n8n.

```yaml
# CI
- run: npx promptsite build ./site && npx promptsite audit ./site --strict
```

## Honest limits

- The copy is a draft. Prices and testimonials are placeholders the tool tells you to replace, and it never invents facts you did not give it.
- Tested end to end with the mock provider and a fake API server; output quality with a live model depends on the model and your brief.
- Pages have no images yet, and deployment is not included: `public/` is plain files for any static host.
- Needs Node 18 or newer. The first run installs `jsdom` and `grapesjs` (the plugin renders in a headless editor).

## Development

```bash
npm install                        # at the repo root
npm test -w promptsite
npm run build                      # plugin first, then the CLI
```

## License

MIT
