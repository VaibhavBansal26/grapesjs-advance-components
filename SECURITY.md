# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue. Expect an acknowledgement within a few days. Include what you found, how to reproduce it, and the version.

## What is in scope

Both packages in this repository: `grapesjs-advance-components` (the browser plugin) and `promptsite` (the CLI and API server).

- Secrets or keys written to generated output, `project.json`, `promptsite.json`, or logs
- Bypasses of the output scanner (`promptsite audit`, the gate in `generate`, `build`, `edit` and `serve`)
- Authentication, origin or path-confinement bypasses in `promptsite edit` and `promptsite serve`
- XSS through generated markup, form blocks, the checkout button, or sanitizer bypasses for AI output

## How the package is built to avoid leaks

| Layer | What it does |
|---|---|
| Keys stay in the environment | `ANTHROPIC_API_KEY` and `PROMPTSITE_API_TOKEN` are read from env, never from flags, never written to disk or sent to a browser |
| Fail-closed output scan | A secret-shaped value or exploitable markup in anything about to be written stops the run (`422` over the API); findings are shown redacted |
| Log redaction | Errors are stripped of key formats and of the exact values of the keys in use before they reach the terminal |
| Strict CSP | Exports ship a `_headers` file: no inline script or style, no `unsafe-eval`, `connect-src` limited to the form endpoint |
| Closed-by-default servers | `promptsite edit` and `promptsite serve` bind to loopback; `serve` needs a 24+ character bearer token (constant-time compare), throttles failures, rejects browser requests, caps body size, jobs and hourly volume, and confines every site to one folder |
| Model output is untrusted | The editor's AI results go through an allowlist sanitizer; the CLI never inserts model text as HTML (it escapes it) |

## What cannot be promised

- **Anything in a static site is public.** Form endpoints, Payment Links and publishable keys are visible to every visitor by design. The scanner warns about URLs that look like credentials, but it cannot know that an ordinary-looking URL is secret.
- **Webhook URLs (n8n and similar) are bearer capabilities.** Do not point a public form straight at one that triggers privileged work; put your own server in between.
- **The scanner is heuristic.** It recognises common token formats and secret-looking URLs, not every possible secret.
- **Your brief goes to the model provider.** Do not put confidential information in prompts.
- **Supply chain:** releases are published with npm provenance; keep your lockfile and review dependency updates.

## Supported versions

Security fixes go to the latest major version.
