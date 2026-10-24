# n8n: prompt-to-site workflow

`site-intake.workflow.json` is an importable workflow: **webhook → generate a site → security audit → respond**.

> Written from n8n's documented node formats. It has not been imported into a running n8n instance by the author, so import it, re-select the two credentials, and run it once with test data before relying on it.

## Setup

1. Run the API where n8n can reach it (same machine or private network):
   ```bash
   export ANTHROPIC_API_KEY=...           # your model key, stays on this machine
   export PROMPTSITE_API_TOKEN="$(openssl rand -hex 24)"
   npx promptsite serve --root ./sites           # http://127.0.0.1:8787
   ```
2. In n8n, **Import from file** and choose `site-intake.workflow.json`.
3. Create two **Header Auth** credentials and select them on the nodes:
   - *promptsite API* (on both HTTP Request nodes): name `Authorization`, value `Bearer <PROMPTSITE_API_TOKEN>`.
   - *Intake webhook* (on the Webhook node): any header name and a different random value.
4. Activate the workflow and call it:
   ```bash
   curl -X POST https://your-n8n.example.com/webhook/site-intake \
     -H "X-Intake-Key: <the intake value>" -H "Content-Type: application/json" \
     -d '{"slug":"bakery","brief":"Family bakery in Leeds, sourdough and custom cakes","template":"local-business"}'
   ```
5. Fetch the result with `GET /v1/sites/bakery/bundle.zip` (same bearer token) and hand the zip to your deploy step.

## Keep it leak-proof

- **The API token never goes in the workflow file or on a web page.** It lives in n8n's encrypted credentials.
- **A webhook URL is public.** Anyone who learns it can call it, so the Webhook node requires its own header credential, and a browser form should post to *your* server, which calls n8n, not to the n8n URL directly.
- **`promptsite serve` is not an internet service.** Keep it on `127.0.0.1` or a private network. If you must expose it, put TLS and a firewall in front.
- `generate` and `build` refuse to write a site that contains a secret (the response is `422` with redacted findings), and `/v1/audit` re-checks any site on demand.

## Publishing the site

The workflow stops at generating and auditing. To publish, add an **Execute Command** node after the audit step (n8n must run on a machine with Node 22+ and `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` or `NETLIFY_AUTH_TOKEN` in its environment):

```
npx promptsite deploy /data/sites/{{ $json.slug }} --to netlify --project {{ $env.NETLIFY_SITE_ID }} --prod
```

`promptsite deploy` audits again and refuses to upload a site with a leaked key. This step is not part of the shipped workflow file and has not been run in a live n8n.
