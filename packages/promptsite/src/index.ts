import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { formatFindings, redactSecrets, scanFiles, type Finding } from 'grapesjs-advance-components';
import { collectAuditFiles } from './collect';
import { childEnvironment, display, missingEnv, nodeMajor, planDeploy, spawnRunner, type Runner } from './deploy';
import { startEditor } from './edit';
import { checkToken, startApi } from './serve';
import { exportProject, generateSite, validateOptions, type SiteOptions } from './generate';
import { resolveProvider, type Provider } from './provider';
import { readConfig, saveSite, writeFiles, type SavedConfig } from './site';
import { getTemplate, TEMPLATES } from './templates';

const HELP = `promptsite: generate, edit and build sites with GrapesJS

  promptsite generate "<brief>" [options]   Draft a multi-page site with AI and write it to a folder
  promptsite edit <dir> [options]           Open the visual editor on a generated site (localhost only)
  promptsite build <dir>                    Re-export <dir>/project.json to <dir>/public
  promptsite serve --root <dir>             HTTP API for n8n, Zapier or cron (needs PROMPTSITE_API_TOKEN)
  promptsite audit <dir>                    Scan a site or project folder for leaked secrets and unsafe markup
  promptsite deploy <dir> --to <host>       Audit, then publish to Cloudflare Pages or Netlify
  promptsite templates                      List the templates

generate options
  --template <id>        landing (default), local-business or shop
  --out <dir>            output folder (default ./site)
  --name <text>          business name (otherwise the model chooses)
  --accent <#hex>        brand colour
  --theme light|dark
  --payment-link <url>   Stripe Payment Link: pricing buttons become checkout buttons
  --form-endpoint <url>  where the contact form posts
  --force                overwrite an existing project
  --allow <rule,rule>    scanner rules to ignore (use sparingly; secrets stay blocked otherwise)

model options (generate and edit)
  --provider anthropic|endpoint|mock   default anthropic, which reads ANTHROPIC_API_KEY
  --endpoint <url>       your own backend (POST { prompt, system } -> { html })
  --model <id>           model id (default claude-sonnet-5-5, or PROMPTSITE_MODEL)

edit options
  --port <n>             default 4173

serve options
  --root <dir>           folder that holds one sub-folder per site (default ./sites)
  --port <n>             default 8787
  --host <addr>          default 127.0.0.1; other addresses need TLS in front
  --max-per-hour <n>     generations per hour (default 30)
  The bearer token comes from the PROMPTSITE_API_TOKEN environment variable (24+ characters), never a flag.

audit options
  --strict               also fail on medium findings (default: fail on high)
  --json                 machine-readable output

deploy options (the audit runs first and a high-severity finding stops the deploy)
  --to cloudflare|netlify   where to publish
  --project <name>       Cloudflare: Pages project name. Netlify: site ID (or NETLIFY_SITE_ID)
  --branch <name>        Cloudflare: branch to deploy; the project's production branch goes live
  --prod                 Netlify: deploy to production (default is a draft URL)
  --dry-run              show the command and what is missing, deploy nothing
  --strict / --allow     as for audit
  Cloudflare reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, Netlify reads NETLIFY_AUTH_TOKEN, from the
  environment. Tokens are never flags, so they stay out of shell history and process lists. Both hosts' tools need Node 22+.

Your API key is read from the environment and is never written anywhere.`;

interface Args {
  _: string[];
  flags: Record<string, string | true>;
}

const BOOLEAN_FLAGS = new Set(['force', 'help', 'version', 'strict', 'json', 'prod', 'dry-run']);

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];
      if (inline !== undefined) out.flags[key] = inline;
      else if (BOOLEAN_FLAGS.has(key)) out.flags[key] = true;
      else {
        const next = argv[++i];
        if (next === undefined || next.startsWith('--')) throw new Error(`--${key} needs a value.`);
        out.flags[key] = next;
      }
    } else out._.push(a);
  }
  return out;
}

const str = (a: Args, key: string): string | undefined => (typeof a.flags[key] === 'string' ? (a.flags[key] as string) : undefined);

const siteFrom = (a: Args, saved: SavedConfig = {}): SiteOptions => ({
  formEndpoint: str(a, 'form-endpoint') ?? saved.formEndpoint,
  paymentLink: str(a, 'payment-link') ?? saved.paymentLink,
  siteName: saved.siteName,
  description: saved.description,
  allow: str(a, 'allow')?.split(',').map((x) => x.trim()).filter(Boolean),
});

const providerFrom = (a: Args): Provider =>
  resolveProvider({ provider: str(a, 'provider'), endpoint: str(a, 'endpoint'), model: str(a, 'model') });

async function generate(a: Args) {
  const brief = a._[1];
  if (!brief) throw new Error('Describe the site, e.g. promptsite generate "bakery in Leeds with online orders".');
  const out = resolve(str(a, 'out') ?? './site');
  if (existsSync(join(out, 'project.json')) && !a.flags.force) throw new Error(`${out} already has a project. Use --force to overwrite it.`);

  const template = str(a, 'template') ?? 'landing';
  const site = siteFrom(a);
  const accent = str(a, 'accent');
  const theme = str(a, 'theme') as 'light' | 'dark' | undefined;
  validateOptions({ ...site, accent, theme });
  const provider = providerFrom(a);

  console.log(`Writing copy with ${provider.label}…`);
  const result = await generateSite({ brief, template, provider, name: str(a, 'name'), accent, theme, ...site });

  const config: SavedConfig = { ...site, template, brief, siteName: result.copy.name, description: result.copy.tagline, accent, theme };
  delete config.allow; // a one-off override must not silently persist
  await saveSite(out, { project: result.project, files: result.files, config });

  console.log(`\nCreated "${result.copy.name}" (${template}) in ${out}`);
  console.log(`  pages:   ${result.pages.join(', ')}`);
  console.log(`  project: ${join(out, 'project.json')}   (edit with: promptsite edit ${a.flags.out ?? './site'})`);
  console.log(`  site:    ${join(out, 'public')}   (${Object.keys(result.files).length} static files, host anywhere)`);
  const notes: string[] = [];
  if (!site.formEndpoint) notes.push('The contact form has no endpoint yet. Re-run with --form-endpoint <url> (your API or a form service).');
  const needs = getTemplate(template).needs;
  if (needs.includes('pricing') && !site.paymentLink) notes.push('Pricing buttons link to the contact page. Add --payment-link <Stripe Payment Link> to sell directly.');
  const placeholders = ['pricing', 'testimonials'].filter((k) => needs.includes(k as never));
  if (placeholders.length) notes.push(`${placeholders.join(' and ')} ${placeholders.length > 1 ? 'are' : 'is'} AI placeholder text. Replace ${placeholders.length > 1 ? 'them' : 'it'} before you publish.`);
  if (result.findings.length) notes.push(`The security scan has ${result.findings.length} non-blocking note(s). Run: promptsite audit ${a.flags.out ?? './site'}`);
  if (notes.length) console.log(`\nBefore you publish:\n${notes.map((n) => `  - ${n}`).join('\n')}`);
}

async function build(a: Args) {
  const dir = resolve(a._[1] ?? '.');
  if (!existsSync(join(dir, 'project.json'))) throw new Error(`No project.json in ${dir}. Run promptsite generate first.`);
  const saved = await readConfig(dir);
  const site = siteFrom(a, saved);
  validateOptions(site);
  const files = await exportProject(JSON.parse(await readFile(join(dir, 'project.json'), 'utf8')), site);
  await writeFiles(join(dir, 'public'), files);
  console.log(`Wrote ${Object.keys(files).length} files to ${join(dir, 'public')}`);
}

async function scan(a: Args, target: string) {
  const files = await collectAuditFiles(target);
  if (!Object.keys(files).length) throw new Error(`No text files to scan in ${target}.`);
  const findings: Finding[] = scanFiles(files, { allow: str(a, 'allow')?.split(',').map((x) => x.trim()).filter(Boolean) });
  const hasHtml = Object.keys(files).some((f) => f.endsWith('.html'));
  if (hasHtml && !Object.keys(files).some((f) => f.endsWith('_headers'))) {
    findings.push({ severity: 'low', rule: 'no-security-headers', file: '(site)', line: 0, message: 'No _headers file: add one with promptsite build to get a strict Content-Security-Policy', match: '' });
  }
  const failOn = a.flags.strict ? ['high', 'medium'] : ['high'];
  return { files, findings, failing: findings.filter((f) => failOn.includes(f.severity)) };
}

async function audit(a: Args): Promise<number> {
  const target = resolve(a._[1] ?? '.');
  const { files, findings, failing } = await scan(a, target);
  const count = (sev: string) => findings.filter((f) => f.severity === sev).length;
  if (a.flags.json) {
    console.log(JSON.stringify({ scanned: Object.keys(files).length, summary: { high: count('high'), medium: count('medium'), low: count('low') }, passed: !failing.length, findings }, null, 2));
  } else {
    console.log(`Scanned ${Object.keys(files).length} files in ${target}`);
    console.log(findings.length ? formatFindings(findings) : '  no findings');
    console.log(`\n${count('high')} high, ${count('medium')} medium, ${count('low')} low. ${failing.length ? 'FAILED' : 'Passed'}${a.flags.strict ? ' (strict)' : ''}.`);
  }
  return failing.length ? 1 : 0;
}

const TOKEN_FLAGS = ['token', 'api-token', 'auth-token', 'auth', 'key', 'api-key'];

/** Audit, then hand the folder to the host's own CLI. A leak blocks the deploy; credentials come from the environment only. */
/** What `deploy` needs from outside; tests replace both. */
export interface Deps {
  runner?: Runner;
  /** The running Node's major version. */
  nodeMajor?: number;
}

async function deploy(a: Args, deps: Deps): Promise<number> {
  const bad = TOKEN_FLAGS.find((f) => f in a.flags);
  if (bad) throw new Error(`--${bad} is not accepted: a token on the command line ends up in shell history and process lists. Set CLOUDFLARE_API_TOKEN or NETLIFY_AUTH_TOKEN in the environment instead.`);
  const dir = a._[1] ?? '.';
  const plan = planDeploy({ dir, to: str(a, 'to'), project: str(a, 'project') ?? str(a, 'site'), branch: str(a, 'branch'), prod: !!a.flags.prod });

  const auditRoot = resolve(dir);
  const { files, findings, failing } = await scan(a, auditRoot);
  console.log(`Audit: scanned ${Object.keys(files).length} files, ${findings.filter((f) => f.severity === 'high').length} high, ${findings.filter((f) => f.severity === 'medium').length} medium, ${findings.filter((f) => f.severity === 'low').length} low.`);
  if (failing.length) {
    console.log(formatFindings(failing));
    console.error(`Deploy stopped: ${failing.length} blocking finding(s). Fix them, or run promptsite audit ${dir} for details.`);
    return 1;
  }

  const missing = missingEnv(plan);
  console.log(`\n${a.flags['dry-run'] ? 'Would deploy' : 'Deploying'} ${plan.publicDir} to ${plan.label}${plan.production ? ' (PRODUCTION)' : ''}`);
  console.log(`  ${display(plan)}`);
  console.log(`  credentials from the environment: ${plan.requiredEnv.map((k) => `${k} ${missing.includes(k) ? '(not set)' : '(set)'}`).join(', ')}`);
  if (a.flags['dry-run']) {
    console.log('\nDry run: nothing was deployed.');
    return missing.length ? 1 : 0;
  }
  if (missing.length) throw new Error(`Set ${missing.join(' and ')} in the environment, then run again. Create the token in your ${plan.label} account settings.`);
  const node = deps.nodeMajor ?? nodeMajor();
  if (node < plan.minNode) throw new Error(`${plan.label}'s command line tool needs Node ${plan.minNode} or newer; this is Node ${node}.`);

  const code = await (deps.runner ?? spawnRunner)(plan.command, plan.args, childEnvironment(plan));
  console.log(code === 0 ? `\nDeployed to ${plan.label}.` : `\n${plan.label} deploy failed (exit ${code}).`);
  return code === 0 ? 0 : 1;
}

async function serve(a: Args) {
  const token = checkToken(process.env.PROMPTSITE_API_TOKEN);
  const root = resolve(str(a, 'root') ?? './sites');
  const port = Number(str(a, 'port') ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be a port number.');
  const maxPerHour = Number(str(a, 'max-per-hour') ?? 30);
  if (!Number.isInteger(maxPerHour) || maxPerHour < 1) throw new Error('--max-per-hour must be a positive integer.');
  const host = str(a, 'host') ?? '127.0.0.1';
  const provider = providerFrom(a);
  const { url } = await startApi({ root, port, host, token, provider, maxPerHour, allow: str(a, 'allow')?.split(',').map((x) => x.trim()).filter(Boolean) });
  console.log(`promptsite API on ${url}   sites in ${root}   model: ${provider.label}`);
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) console.log(`Warning: listening on ${host}. Put TLS (a reverse proxy) in front, and firewall the port.`);
  console.log('Authenticate with: Authorization: Bearer $PROMPTSITE_API_TOKEN\nCtrl+C to stop.');
}

async function edit(a: Args) {
  const dir = resolve(a._[1] ?? '.');
  if (!existsSync(join(dir, 'project.json'))) throw new Error(`No project.json in ${dir}. Run promptsite generate first.`);
  const site = siteFrom(a, await readConfig(dir));
  validateOptions(site);
  const port = Number(str(a, 'port') ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be a port number.');

  let provider: Provider | undefined;
  try {
    provider = providerFrom(a);
  } catch (err) {
    console.log(`AI is off in the editor (${(err as Error).message})`);
  }
  const { url } = await startEditor({ dir, port, site, provider });
  console.log(`Editing ${dir}\n  ${url}\n\nChanges save to project.json automatically. Press Publish in the editor to write ${join(dir, 'public')}.\nCtrl+C to stop.`);
}

export async function main(argv: string[], deps: Deps = {}): Promise<number> {
  try {
    const a = parseArgs(argv);
    const cmd = a._[0];
    if (a.flags.version) {
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
      console.log(pkg.version);
      return 0;
    }
    if (!cmd || a.flags.help || cmd === 'help') {
      console.log(HELP);
      return cmd || a.flags.help ? 0 : 1;
    }
    if (cmd === 'templates') {
      for (const t of TEMPLATES) console.log(`${t.id.padEnd(16)} ${t.description}`);
      return 0;
    }
    if (cmd === 'audit') return await audit(a);
    if (cmd === 'deploy') return await deploy(a, deps);
    if (cmd === 'generate') await generate(a);
    else if (cmd === 'build') await build(a);
    else if (cmd === 'edit' || cmd === 'serve') {
      await (cmd === 'edit' ? edit(a) : serve(a));
      return -1; // keep the server running
    } else throw new Error(`Unknown command "${cmd}". Run promptsite --help.`);
    return 0;
  } catch (err) {
    // Nothing that reaches the terminal may contain a key, even if an upstream error echoed one.
    console.error(`promptsite: ${redactSecrets((err as Error).message, [process.env.ANTHROPIC_API_KEY, process.env.PROMPTSITE_API_TOKEN, process.env.CLOUDFLARE_API_TOKEN, process.env.NETLIFY_AUTH_TOKEN])}`);
    return 1;
  }
}

