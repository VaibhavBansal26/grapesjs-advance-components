import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { childEnvironment, display, missingEnv, nodeMajor, planDeploy, siteDir, spawnRunner } from '../src/deploy';
import { main } from '../src/index';

const dirs: string[] = [];
async function site(files: Record<string, string> = {}, withProject = true) {
  const dir = await mkdtemp(join(tmpdir(), 'ps-deploy-'));
  dirs.push(dir);
  const pub = withProject ? join(dir, 'public') : dir;
  await mkdir(pub, { recursive: true });
  await writeFile(join(pub, 'index.html'), '<!doctype html><title>x</title><p>hi</p>');
  await writeFile(join(pub, '_headers'), '/*\n  X-Frame-Options: DENY\n');
  if (withProject) await writeFile(join(dir, 'project.json'), '{}');
  for (const [name, body] of Object.entries(files)) await writeFile(join(pub, name), body);
  return dir;
}

const SAVED = { ...process.env };
const TOKEN = 'cf-token-' + 'a'.repeat(30);
beforeEach(() => {
  for (const k of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID', 'CLOUDFLARE_PAGES_PROJECT']) delete process.env[k];
});
afterEach(async () => {
  process.env = { ...SAVED };
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

type Call = [string, string[], NodeJS.ProcessEnv];
const fakeRunner = (code = 0) => vi.fn(async (..._call: Call) => code);

async function run(args: string[], runner = fakeRunner(), nodeMajor = 22) {
  const logs: string[] = [];
  const log = console.log;
  const err = console.error;
  console.log = (...a: unknown[]) => void logs.push(a.join(' '));
  console.error = (...a: unknown[]) => void logs.push(a.join(' '));
  try {
    return { code: await main(args, { runner, nodeMajor }), out: logs.join('\n'), runner };
  } finally {
    console.log = log;
    console.error = err;
  }
}

describe('planDeploy', () => {
  it('builds the wrangler command for Cloudflare Pages', async () => {
    const dir = await site();
    const plan = planDeploy({ dir, to: 'cloudflare', project: 'my-site', branch: 'main' });
    expect(plan.command).toBe('npx');
    expect(plan.args).toEqual(['--yes', 'wrangler@4', 'pages', 'deploy', join(dir, 'public'), '--project-name', 'my-site', '--branch', 'main']);
    expect(plan.requiredEnv).toEqual(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']);
    expect(plan.minNode).toBe(22);
  });

  it('builds the netlify command, with a draft by default and the site ID in the environment', async () => {
    const dir = await site();
    const draft = planDeploy({ dir, to: 'netlify', project: 'abc-123' });
    expect(draft.args).toEqual(['--yes', 'netlify-cli@27', 'deploy', '--dir', join(dir, 'public'), '--no-build']);
    expect(draft.production).toBe(false);
    expect(draft.childEnv).toEqual({ NETLIFY_SITE_ID: 'abc-123' });
    expect(draft.args.join(' ')).not.toContain('abc-123');
    const live = planDeploy({ dir, to: 'netlify', project: 'abc-123', prod: true });
    expect(live.args).toContain('--prod');
    expect(live.production).toBe(true);
  });

  it('takes the project from the environment', async () => {
    const dir = await site();
    expect(planDeploy({ dir, to: 'cloudflare', env: { CLOUDFLARE_PAGES_PROJECT: 'from-env' } }).args).toContain('from-env');
    expect(planDeploy({ dir, to: 'netlify', env: { NETLIFY_SITE_ID: 'site-env' } }).childEnv.NETLIFY_SITE_ID).toBe('site-env');
  });

  it.each([
    [{ to: undefined }, /--to cloudflare or netlify/],
    [{ to: 'vercel' }, /--to cloudflare or netlify/],
    [{ to: 'cloudflare' }, /needs a Pages project name/],
    [{ to: 'netlify' }, /needs a site ID/],
    [{ to: 'cloudflare', project: '--help' }, /may only contain/],
    [{ to: 'cloudflare', project: 'a b' }, /may only contain/],
    [{ to: 'netlify', project: 'x;rm' }, /may only contain/],
    [{ to: 'cloudflare', project: 'p', branch: '--x' }, /branch/],
    [{ to: 'cloudflare', project: 'p', prod: true }, /--prod is for Netlify/],
    [{ to: 'netlify', project: 'p', branch: 'main' }, /--branch is for Cloudflare/],
  ] as const)('refuses %j', async (opts, message) => {
    const dir = await site();
    expect(() => planDeploy({ dir, env: {}, ...opts } as never)).toThrow(message);
  });

  it('finds the folder to upload', async () => {
    const generated = await site();
    expect(siteDir(generated)).toBe(join(generated, 'public'));
    const bare = await site({}, false);
    expect(siteDir(bare)).toBe(bare);
    const empty = await mkdtemp(join(tmpdir(), 'ps-empty-'));
    dirs.push(empty);
    expect(() => siteDir(empty)).toThrow(/Nothing to deploy/);
    const unbuilt = await mkdtemp(join(tmpdir(), 'ps-unbuilt-'));
    dirs.push(unbuilt);
    await writeFile(join(unbuilt, 'project.json'), '{}');
    expect(() => siteDir(unbuilt)).toThrow(/has no index.html/);
  });
});

describe('credentials and environment', () => {
  it('reports which variables are missing, never their values', async () => {
    const plan = planDeploy({ dir: await site(), to: 'cloudflare', project: 'p' });
    expect(missingEnv(plan, {})).toEqual(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']);
    expect(missingEnv(plan, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: '  ' })).toEqual(['CLOUDFLARE_ACCOUNT_ID']);
    expect(missingEnv(plan, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' })).toEqual([]);
  });

  it("keeps this tool's own keys away from the host's CLI", async () => {
    const plan = planDeploy({ dir: await site(), to: 'netlify', project: 's1' });
    const env = childEnvironment(plan, { PATH: '/bin', ANTHROPIC_API_KEY: 'k', PROMPTSITE_API_TOKEN: 't', NETLIFY_AUTH_TOKEN: 'n' });
    expect(env).toMatchObject({ PATH: '/bin', NETLIFY_AUTH_TOKEN: 'n', NETLIFY_SITE_ID: 's1' });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PROMPTSITE_API_TOKEN).toBeUndefined();
  });

  it('reads the Node major version', () => {
    expect(nodeMajor('20.11.1')).toBe(20);
    expect(nodeMajor('22.0.0')).toBe(22);
  });

  it('shows the command as typed', async () => {
    const plan = planDeploy({ dir: await site(), to: 'cloudflare', project: 'p' });
    expect(display(plan)).toMatch(/^npx --yes wrangler@4 pages deploy .+ --project-name p$/);
  });
});

describe('promptsite deploy', () => {
  it('refuses to deploy a site with a leaked secret, and never runs the host CLI', async () => {
    const secret = ['sk', '_', 'live', '_', 'Z'.repeat(26)].join('');
    const dir = await site({ 'app.js': `const k = '${secret}';` });
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' });
    const r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p']);
    expect(r.code).toBe(1);
    expect(r.runner).not.toHaveBeenCalled();
    expect(r.out).toMatch(/Deploy stopped/);
    expect(r.out).toContain('stripe-secret-key');
    expect(r.out).not.toContain(secret);
  });

  it('runs the host CLI after a clean audit, with credentials in the environment and not in the arguments', async () => {
    const dir = await site();
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc1', ANTHROPIC_API_KEY: 'sk-ant-should-not-leak', PROMPTSITE_API_TOKEN: 'x'.repeat(30) });
    const runner = fakeRunner();
    const r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'my-site', '--branch', 'main'], runner);
    expect(r.code).toBe(0);
    expect(runner).toHaveBeenCalledOnce();
    const [command, args, env] = runner.mock.calls[0]!;
    expect(command).toBe('npx');
    expect(args).toContain('wrangler@4');
    expect(args.join(' ')).not.toContain(TOKEN);
    expect(env.CLOUDFLARE_API_TOKEN).toBe(TOKEN);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PROMPTSITE_API_TOKEN).toBeUndefined();
    expect(r.out).toMatch(/Audit: scanned/);
    expect(r.out).toMatch(/Deployed to Cloudflare Pages/);
    expect(r.out).not.toContain(TOKEN);
  });

  it('puts the netlify site ID in the environment and makes a draft unless --prod', async () => {
    const dir = await site();
    process.env.NETLIFY_AUTH_TOKEN = 'nf-' + 'b'.repeat(30);
    const runner = fakeRunner();
    await run(['deploy', dir, '--to', 'netlify', '--project', 'site-1'], runner);
    expect(runner.mock.calls[0]![1]).not.toContain('--prod');
    expect(runner.mock.calls[0]![2].NETLIFY_SITE_ID).toBe('site-1');
    await run(['deploy', dir, '--to', 'netlify', '--project', 'site-1', '--prod'], runner);
    expect(runner.mock.calls[1]![1]).toContain('--prod');
  });

  it('stops with a clear message when a variable is missing, naming it but not guessing a value', async () => {
    const dir = await site();
    process.env.CLOUDFLARE_API_TOKEN = TOKEN;
    const r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Set CLOUDFLARE_ACCOUNT_ID/);
    expect(r.out).not.toContain(TOKEN);
    expect(r.runner).not.toHaveBeenCalled();
  });

  it('rejects tokens passed as flags, without echoing them', async () => {
    const dir = await site();
    for (const flag of ['--token', '--api-token', '--auth', '--key']) {
      const r = await run(['deploy', dir, '--to', 'netlify', '--project', 's', flag, 'SECRETVALUE1234567890']);
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/not accepted/);
      expect(r.out).not.toContain('SECRETVALUE1234567890');
      expect(r.runner).not.toHaveBeenCalled();
    }
  });

  it('--dry-run prints the plan and runs nothing; it fails only while credentials are missing', async () => {
    const dir = await site();
    let r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p', '--dry-run']);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/Would deploy/);
    expect(r.out).toMatch(/CLOUDFLARE_API_TOKEN \(not set\)/);
    expect(r.out).toMatch(/Dry run: nothing was deployed/);
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' });
    r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p', '--dry-run']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/CLOUDFLARE_API_TOKEN \(set\)/);
    expect(r.out).not.toContain(TOKEN);
    expect(r.runner).not.toHaveBeenCalled();
  });

  it.each([18, 20, 21])('stops on Node %i, which the host tools do not support, before running anything', async (node) => {
    const dir = await site();
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' });
    const r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p'], fakeRunner(), node);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(new RegExp(`needs Node 22 or newer; this is Node ${node}`));
    expect(r.runner).not.toHaveBeenCalled();
  });

  it('does not check the Node version for a dry run', async () => {
    const dir = await site();
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' });
    expect((await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p', '--dry-run'], fakeRunner(), 18)).code).toBe(0);
  });

  it('marks a production netlify deploy in the plan', async () => {
    const dir = await site();
    const r = await run(['deploy', dir, '--to', 'netlify', '--project', 's', '--prod', '--dry-run']);
    expect(r.out).toMatch(/\(PRODUCTION\)/);
  });

  it('reports a failing host deploy as a failure', async () => {
    const dir = await site();
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' });
    const r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p'], fakeRunner(7));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/deploy failed \(exit 7\)/);
  });

  it('scans the project file too, so a key in project.json blocks the deploy', async () => {
    const dir = await site();
    const secret = ['sk', '_', 'live', '_', 'Q'.repeat(26)].join('');
    await writeFile(join(dir, 'project.json'), JSON.stringify({ notes: secret }));
    Object.assign(process.env, { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acc' });
    const r = await run(['deploy', dir, '--to', 'cloudflare', '--project', 'p']);
    expect(r.code).toBe(1);
    expect(r.runner).not.toHaveBeenCalled();
  });

  it('is listed in --help', async () => {
    expect((await run(['--help'])).out).toMatch(/promptsite deploy <dir> --to <host>/);
  });
});

describe('spawnRunner', () => {
  it('returns the exit code of the command and passes the environment', async () => {
    expect(await spawnRunner(process.execPath, ['-e', 'process.exit(0)'], process.env)).toBe(0);
    expect(await spawnRunner(process.execPath, ['-e', 'process.exit(3)'], process.env)).toBe(3);
    expect(await spawnRunner(process.execPath, ['-e', 'process.exit(process.env.PS_PROBE === "yes" ? 0 : 9)'], { ...process.env, PS_PROBE: 'yes' })).toBe(0);
  });

  it('does not use a shell, so metacharacters in arguments stay plain text', async () => {
    const code = await spawnRunner(process.execPath, ['-e', 'process.exit(process.argv[1] === "a; exit 5 && b" ? 0 : 4)', 'a; exit 5 && b'], process.env);
    expect(code).toBe(0);
  });

  it('explains a command that cannot start', async () => {
    await expect(spawnRunner('definitely-not-a-command-xyz', [], process.env)).rejects.toThrow(/Could not start/);
  });
});
