import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type DeployTarget = 'cloudflare' | 'netlify';
export const TARGETS: DeployTarget[] = ['cloudflare', 'netlify'];

/** Runs the host's own CLI. Replaced in tests; the default streams the CLI's output to the terminal. */
export type Runner = (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<number>;

export interface DeployPlan {
  target: DeployTarget;
  label: string;
  /** The folder that gets uploaded. */
  publicDir: string;
  command: string;
  args: string[];
  /** Environment variables that must be set; their values are never printed. */
  requiredEnv: string[];
  /** Extra variables the child process gets, built from flags (never secrets). */
  childEnv: Record<string, string>;
  /** Node version the host CLI needs. */
  minNode: number;
  production: boolean;
}

export interface PlanOptions {
  dir: string;
  to: string | undefined;
  /** Cloudflare Pages project name, or a Netlify site ID. */
  project?: string;
  /** Cloudflare: the branch to deploy. The project's production branch makes a production deploy. */
  branch?: string;
  /** Netlify: deploy to production instead of a draft URL. */
  prod?: boolean;
  env?: NodeJS.ProcessEnv;
}

// A name that cannot be read as an option and carries no shell characters (we never use a shell anyway).
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

/** The folder to upload: a generated site's `public/`, or the folder itself if it holds an index.html. */
export function siteDir(dir: string): string {
  const abs = resolve(dir);
  if (existsSync(join(abs, 'project.json')) || existsSync(join(abs, 'public'))) {
    const pub = join(abs, 'public');
    if (!existsSync(join(pub, 'index.html'))) throw new Error(`${pub} has no index.html. Run promptsite build ${dir} first.`);
    return pub;
  }
  if (existsSync(join(abs, 'index.html'))) return abs;
  throw new Error(`Nothing to deploy in ${abs}: no public/ folder and no index.html. Run promptsite generate or build first.`);
}

export function planDeploy(o: PlanOptions): DeployPlan {
  const to = (o.to ?? '').toLowerCase();
  if (!TARGETS.includes(to as DeployTarget)) throw new Error(`Choose where to deploy with --to ${TARGETS.join(' or ')}.`);
  const target = to as DeployTarget;
  const publicDir = siteDir(o.dir);
  const env = o.env ?? process.env;

  if (target === 'cloudflare') {
    const project = o.project ?? env.CLOUDFLARE_PAGES_PROJECT;
    if (!project) throw new Error('Cloudflare needs a Pages project name: --project <name> (or CLOUDFLARE_PAGES_PROJECT).');
    if (!SAFE_NAME.test(project)) throw new Error('--project may only contain letters, digits, dots, dashes and underscores.');
    if (o.branch !== undefined && !SAFE_BRANCH.test(o.branch)) throw new Error('--branch contains characters that are not allowed.');
    if (o.prod) throw new Error('--prod is for Netlify. On Cloudflare Pages, deploy the project\'s production branch with --branch <name> (usually main).');
    return {
      target,
      label: 'Cloudflare Pages',
      publicDir,
      command: 'npx',
      args: ['--yes', 'wrangler@4', 'pages', 'deploy', publicDir, '--project-name', project, ...(o.branch ? ['--branch', o.branch] : [])],
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      childEnv: {},
      minNode: 22,
      production: false,
    };
  }

  const site = o.project ?? env.NETLIFY_SITE_ID;
  if (!site) throw new Error('Netlify needs a site ID: --project <site-id> (or NETLIFY_SITE_ID). Find it under Site configuration.');
  if (!SAFE_NAME.test(site)) throw new Error('--project may only contain letters, digits, dots, dashes and underscores.');
  if (o.branch !== undefined) throw new Error('--branch is for Cloudflare. Netlify makes a draft URL unless you pass --prod.');
  return {
    target,
    label: 'Netlify',
    publicDir,
    command: 'npx',
    args: ['--yes', 'netlify-cli@27', 'deploy', '--dir', publicDir, '--no-build', ...(o.prod ? ['--prod'] : [])],
    requiredEnv: ['NETLIFY_AUTH_TOKEN'],
    childEnv: { NETLIFY_SITE_ID: site },
    minNode: 22,
    production: !!o.prod,
  };
}

/** Names of required environment variables that are missing or empty. */
export function missingEnv(plan: DeployPlan, env: NodeJS.ProcessEnv = process.env): string[] {
  return plan.requiredEnv.filter((k) => !env[k]?.trim());
}

/** The environment the host CLI gets: ours, minus the keys this tool owns, plus the site ID. */
export function childEnvironment(plan: DeployPlan, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env, ...plan.childEnv };
  delete out.ANTHROPIC_API_KEY;
  delete out.PROMPTSITE_API_TOKEN;
  return out;
}

export const nodeMajor = (version = process.versions.node) => Number(version.split('.')[0]);

export const spawnRunner: Runner = (command, args, env) =>
  new Promise((resolveCode, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit' }); // no shell: arguments are never parsed
    child.on('error', (err) => reject(new Error(`Could not start ${command}: ${err.message}`)));
    child.on('exit', (code) => resolveCode(code ?? 1));
  });

/** The command as a person would type it, for --dry-run. Quotes anything that needs it. */
export const display = (plan: DeployPlan) =>
  [plan.command, ...plan.args].map((a) => (/^[\w@./:=-]+$/.test(a) ? a : JSON.stringify(a))).join(' ');
