import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { startEditor } from './edit';
import { exportProject, generateSite, validateOptions, type SiteOptions } from './generate';
import { resolveProvider, type Provider } from './provider';
import { getTemplate, TEMPLATES } from './templates';

const HELP = `aac: generate, edit and build GrapesJS sites

  aac generate "<brief>" [options]   Draft a multi-page site with AI and write it to a folder
  aac edit <dir> [options]           Open the visual editor on a generated site (localhost only)
  aac build <dir>                    Re-export <dir>/project.json to <dir>/public
  aac templates                      List the templates

generate options
  --template <id>        landing (default), local-business or shop
  --out <dir>            output folder (default ./site)
  --name <text>          business name (otherwise the model chooses)
  --accent <#hex>        brand colour
  --theme light|dark
  --payment-link <url>   Stripe Payment Link: pricing buttons become checkout buttons
  --form-endpoint <url>  where the contact form posts
  --force                overwrite an existing project

model options (generate and edit)
  --provider anthropic|endpoint|mock   default anthropic, which reads ANTHROPIC_API_KEY
  --endpoint <url>       your own backend (POST { prompt, system } -> { html })
  --model <id>           model id (default claude-sonnet-5-5, or AAC_MODEL)

edit options
  --port <n>             default 4173

Your API key is read from the environment and is never written anywhere.`;

interface Args {
  _: string[];
  flags: Record<string, string | true>;
}

const BOOLEAN_FLAGS = new Set(['force', 'help', 'version']);

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

interface SavedConfig extends SiteOptions {
  template?: string;
  brief?: string;
  accent?: string;
  theme?: string;
}

async function readConfig(dir: string): Promise<SavedConfig> {
  try {
    return JSON.parse(await readFile(join(dir, 'aac.json'), 'utf8')) as SavedConfig;
  } catch {
    return {};
  }
}

const siteFrom = (a: Args, saved: SavedConfig = {}): SiteOptions => ({
  formEndpoint: str(a, 'form-endpoint') ?? saved.formEndpoint,
  paymentLink: str(a, 'payment-link') ?? saved.paymentLink,
  siteName: saved.siteName,
  description: saved.description,
});

const providerFrom = (a: Args): Provider =>
  resolveProvider({ provider: str(a, 'provider'), endpoint: str(a, 'endpoint'), model: str(a, 'model') });

async function writeFiles(dir: string, files: Record<string, string>) {
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
}

async function generate(a: Args) {
  const brief = a._[1];
  if (!brief) throw new Error('Describe the site, e.g. aac generate "bakery in Leeds with online orders".');
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

  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'project.json'), JSON.stringify(result.project, null, 2));
  await writeFile(join(out, 'aac.json'), JSON.stringify({ ...site, template, brief, siteName: result.copy.name, description: result.copy.tagline, accent, theme }, null, 2));
  await writeFiles(join(out, 'public'), result.files);

  console.log(`\nCreated "${result.copy.name}" (${template}) in ${out}`);
  console.log(`  pages:   ${result.pages.join(', ')}`);
  console.log(`  project: ${join(out, 'project.json')}   (edit with: aac edit ${a.flags.out ?? './site'})`);
  console.log(`  site:    ${join(out, 'public')}   (${Object.keys(result.files).length} static files, host anywhere)`);
  const notes: string[] = [];
  if (!site.formEndpoint) notes.push('The contact form has no endpoint yet. Re-run with --form-endpoint <url> (your API or a form service).');
  const needs = getTemplate(template).needs;
  if (needs.includes('pricing') && !site.paymentLink) notes.push('Pricing buttons link to the contact page. Add --payment-link <Stripe Payment Link> to sell directly.');
  const placeholders = ['pricing', 'testimonials'].filter((k) => needs.includes(k as never));
  if (placeholders.length) notes.push(`${placeholders.join(' and ')} ${placeholders.length > 1 ? 'are' : 'is'} AI placeholder text. Replace ${placeholders.length > 1 ? 'them' : 'it'} before you publish.`);
  if (notes.length) console.log(`\nBefore you publish:\n${notes.map((n) => `  - ${n}`).join('\n')}`);
}

async function build(a: Args) {
  const dir = resolve(a._[1] ?? '.');
  if (!existsSync(join(dir, 'project.json'))) throw new Error(`No project.json in ${dir}. Run aac generate first.`);
  const saved = await readConfig(dir);
  const site = siteFrom(a, saved);
  validateOptions(site);
  const files = await exportProject(JSON.parse(await readFile(join(dir, 'project.json'), 'utf8')), site);
  await writeFiles(join(dir, 'public'), files);
  console.log(`Wrote ${Object.keys(files).length} files to ${join(dir, 'public')}`);
}

async function edit(a: Args) {
  const dir = resolve(a._[1] ?? '.');
  if (!existsSync(join(dir, 'project.json'))) throw new Error(`No project.json in ${dir}. Run aac generate first.`);
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

export async function main(argv: string[]): Promise<number> {
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
    if (cmd === 'generate') await generate(a);
    else if (cmd === 'build') await build(a);
    else if (cmd === 'edit') {
      await edit(a);
      return -1; // keep the server running
    } else throw new Error(`Unknown command "${cmd}". Run aac --help.`);
    return 0;
  } catch (err) {
    console.error(`aac: ${(err as Error).message}`);
    return 1;
  }
}

