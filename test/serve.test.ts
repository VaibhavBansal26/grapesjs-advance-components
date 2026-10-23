import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleCopy } from '../src/cli/copy';
import { mockProvider, type Provider } from '../src/cli/provider';
import { checkToken, startApi } from '../src/cli/serve';

const TOKEN = 'a'.repeat(8) + 'b'.repeat(8) + 'c'.repeat(8) + 'd'.repeat(4);
let root = '';
let port = 0;
let close: () => Promise<void> = async () => {};

async function boot(extra: Partial<Parameters<typeof startApi>[0]> = {}) {
  await close();
  root = root || (await mkdtemp(join(tmpdir(), 'aac-api-')));
  const api = await startApi({ root, port: 0, token: TOKEN, provider: mockProvider(), ...extra });
  close = api.close;
  port = Number(new URL(api.url).port);
}
beforeEach(async () => {
  root = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await boot();
});
afterEach(async () => {
  await close();
  await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

type Res = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer; text: string; json: any };
function call(method: string, path: string, opts: { token?: string | null; headers?: Record<string, string>; body?: unknown; raw?: string | Buffer } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token !== null) headers.authorization = `Bearer ${opts.token ?? TOKEN}`;
  const payload = opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
  if (payload !== undefined && !headers['content-type']) headers['content-type'] = 'application/json';
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const text = body.toString('utf8');
        let json: unknown;
        try { json = JSON.parse(text); } catch { /* not json */ }
        resolve({ status: res.statusCode!, headers: res.headers, body, text, json });
      });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}
const gen = (body: Record<string, unknown> = {}) => call('POST', '/v1/generate', { body: { slug: 'bakery', brief: 'Family bakery in Leeds', template: 'local-business', ...body } });

describe('startup', () => {
  it('refuses to start without a strong token', () => {
    expect(() => checkToken(undefined)).toThrow(/AAC_API_TOKEN/);
    expect(() => checkToken('short')).toThrow(/at least 24/);
    expect(checkToken(TOKEN)).toBe(TOKEN);
    return expect(startApi({ root, port: 0, token: 'tooshort', provider: mockProvider() })).rejects.toThrow(/AAC_API_TOKEN/);
  });

  it('listens on loopback by default', async () => {
    await expect(call('GET', '/health', { token: null })).resolves.toMatchObject({ status: 200 });
  });
});

describe('authentication', () => {
  it('allows /health without a token and nothing else', async () => {
    expect((await call('GET', '/health', { token: null })).status).toBe(200);
    for (const [m, p] of [['GET', '/v1/sites'], ['POST', '/v1/generate'], ['POST', '/v1/build'], ['POST', '/v1/audit'], ['GET', '/v1/sites/x/bundle.zip']]) {
      const r = await call(m!, p!, { token: null, ...(m === 'POST' ? { body: {} } : {}) });
      expect(r.status, `${m} ${p}`).toBe(401);
      expect(r.headers['www-authenticate']).toBe('Bearer');
    }
  });

  it('rejects wrong, empty and malformed tokens without revealing why', async () => {
    for (const token of ['wrong', '', TOKEN.slice(0, -1), TOKEN + 'x']) {
      const r = await call('GET', '/v1/sites', { token });
      expect(r.status).toBe(401);
      expect(r.json).toEqual({ error: 'Unauthorized' });
    }
    const basic = await call('GET', '/v1/sites', { token: null, headers: { authorization: `Basic ${Buffer.from('a:b').toString('base64')}` } });
    expect(basic.status).toBe(401);
  });

  it('throttles repeated failures, even for the right token afterwards', async () => {
    for (let i = 0; i < 5; i++) expect((await call('GET', '/v1/sites', { token: 'bad' + i })).status).toBe(401);
    const blocked = await call('GET', '/v1/sites', { token: 'bad-again' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('60');
    expect((await call('GET', '/v1/sites')).status).toBe(429);
  });

  it('rejects any request that carries an Origin header (browsers)', async () => {
    const r = await call('GET', '/v1/sites', { headers: { origin: 'https://evil.example.com' } });
    expect(r.status).toBe(403);
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never echoes the token and sends no-store', async () => {
    const r = await call('GET', '/v1/sites');
    expect(r.text).not.toContain(TOKEN);
    expect(r.headers['cache-control']).toBe('no-store');
  });
});

describe('input validation', () => {
  it('requires JSON, bounds the body, and rejects malformed JSON', async () => {
    expect((await call('POST', '/v1/generate', { raw: 'x', headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await call('POST', '/v1/generate', { raw: '{nope' })).status).toBe(400);
    expect((await call('POST', '/v1/generate', { raw: '[1,2]' })).status).toBe(400);
    expect((await call('POST', '/v1/generate', { raw: JSON.stringify({ slug: 'x', brief: 'y'.repeat(70_000) }) })).status).toBe(413);
  });

  it.each(['../evil', '..', 'a/b', 'A', '', '-lead', 'x'.repeat(64), 'sp ace', '%2e%2e', 'a\\b'])('rejects slug %j and writes nothing', async (slug) => {
    expect((await gen({ slug })).status).toBe(400);
    expect(await readdir(root)).toEqual([]);
  });

  it('validates fields before spending a model call', async () => {
    const calls = vi.fn(async () => '{}');
    await boot({ provider: { label: 't', complete: calls } });
    expect((await gen({ brief: '' })).status).toBe(400);
    expect((await gen({ brief: 'x'.repeat(2001) })).status).toBe(400);
    expect((await gen({ brief: 42 })).status).toBe(400);
    expect((await gen({ template: 'nope' })).status).toBe(400);
    expect((await gen({ accent: 'red;}' })).status).toBe(400);
    expect((await gen({ paymentLink: 'http://x.example/p' })).status).toBe(400);
    expect((await gen({ formEndpoint: 'javascript:alert(1)' })).status).toBe(400);
    expect(calls).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown routes and methods', async () => {
    expect((await call('GET', '/nope')).status).toBe(404);
    expect((await call('DELETE', '/v1/sites')).status).toBe(404);
    expect((await call('POST', '/v1/nope', { body: {} })).status).toBe(404);
  });
});

describe('generate, build, audit', () => {
  it('generates a site into its own folder and reports files and findings', async () => {
    const r = await gen({ name: 'Crumb & Co', formEndpoint: 'https://api.example.com/contact' });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ slug: 'bakery', name: 'Crumb & Co', pages: ['Home', 'About', 'Contact'], bundle: '/v1/sites/bakery/bundle.zip' });
    expect(r.json.files).toEqual(expect.arrayContaining(['index.html', 'contact.html', '_headers']));
    expect((await readdir(join(root, 'bakery'))).sort()).toEqual(['aac.json', 'project.json', 'public']);
    expect(await readFile(join(root, 'bakery', 'public', 'contact.html'), 'utf8')).toContain('action="https://api.example.com/contact"');
    const saved = JSON.parse(await readFile(join(root, 'bakery', 'aac.json'), 'utf8'));
    expect(saved).toMatchObject({ siteName: 'Crumb & Co', template: 'local-business' });
    expect(JSON.stringify(saved)).not.toContain(TOKEN);
  });

  it('will not overwrite an existing site unless asked', async () => {
    expect((await gen()).status).toBe(200);
    expect((await gen()).status).toBe(409);
    expect((await gen({ force: true })).status).toBe(200);
  });

  it('blocks a leak with 422, redacted, and writes nothing', async () => {
    const r = await gen({ formEndpoint: 'https://hooks.example.com/in?token=abcdef123456789' });
    expect(r.status).toBe(422);
    expect(r.json.error).toMatch(/url-secret-param/);
    expect(r.text).not.toContain('abcdef123456789');
    expect(await readdir(root)).toEqual([]);
  });

  it('blocks a model that echoes a key and never returns it', async () => {
    const key = ['sk', '_', 'live', '_', '3'.repeat(24)].join('');
    await boot({ provider: { label: 'leaky', complete: async () => JSON.stringify({ ...sampleCopy('x'), about: `key ${key}` }) } });
    const r = await gen();
    expect(r.status).toBe(422);
    expect(r.text).not.toContain(key);
    expect(await readdir(root)).toEqual([]);
  });

  it('builds from project.json and audits', async () => {
    await gen();
    await rm(join(root, 'bakery', 'public'), { recursive: true });
    const built = await call('POST', '/v1/build', { body: { slug: 'bakery' } });
    expect(built.status).toBe(200);
    expect(built.json.files).toContain('index.html');
    expect(await readdir(join(root, 'bakery', 'public'))).toContain('index.html');

    const audit = await call('POST', '/v1/audit', { body: { slug: 'bakery' } });
    expect(audit.json).toMatchObject({ passed: true, summary: { high: 0, medium: 0 } });
  });

  it('audit reports a leaked file without echoing it', async () => {
    await gen();
    const key = ['sk', '_', 'live', '_', '8'.repeat(24)].join('');
    await writeFile(join(root, 'bakery', 'public', 'oops.js'), `var k="${key}"`);
    const audit = await call('POST', '/v1/audit', { body: { slug: 'bakery' } });
    expect(audit.json.passed).toBe(false);
    expect(audit.json.summary.high).toBeGreaterThanOrEqual(1);
    expect(audit.text).not.toContain(key);
  });

  it('build refuses a project with a pasted secret', async () => {
    await gen();
    const key = ['sk', '_', 'live', '_', '6'.repeat(24)].join('');
    const file = join(root, 'bakery', 'project.json');
    await writeFile(file, (await readFile(file, 'utf8')).replace('"Home"', `"Home ${key}"`));
    const r = await call('POST', '/v1/build', { body: { slug: 'bakery' } });
    expect(r.status).toBe(422);
    expect(r.text).not.toContain(key);
  });

  it('returns 404 for unknown sites', async () => {
    expect((await call('POST', '/v1/build', { body: { slug: 'ghost' } })).status).toBe(404);
    expect((await call('POST', '/v1/audit', { body: { slug: 'ghost' } })).status).toBe(404);
    expect((await call('GET', '/v1/sites/ghost/bundle.zip')).status).toBe(404);
  });

  it('lists sites and serves a zip bundle of public/', async () => {
    await gen();
    await gen({ slug: 'second-site', name: 'Second' });
    const list = await call('GET', '/v1/sites');
    expect(list.json.sites.map((s: { slug: string }) => s.slug).sort()).toEqual(['bakery', 'second-site']);
    const zip = await call('GET', '/v1/sites/bakery/bundle.zip');
    expect(zip.status).toBe(200);
    expect(zip.headers['content-type']).toBe('application/zip');
    expect(zip.body.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(zip.text).toContain('index.html');
    expect(zip.text).not.toContain('project.json'); // only public/ ships
  });
});

describe('abuse limits', () => {
  it('runs one job at a time', async () => {
    let release: () => void = () => {};
    let entered: () => void = () => {};
    const started = new Promise<void>((resolve) => (entered = resolve));
    const slow: Provider = {
      label: 'slow',
      complete: () =>
        new Promise((res) => {
          release = () => res(JSON.stringify(sampleCopy('x')));
          entered();
        }),
    };
    await boot({ provider: slow });
    const first = gen({ slug: 'one' });
    try {
      // Wait until 'one' is really the running job. Firing both requests back to back would let
      // 'two' win the race on a slow machine, and then the probe itself would hang.
      await started;
      expect((await gen({ slug: 'two' })).status).toBe(429);
    } finally {
      release(); // never leave a request hanging, even if the assertion above fails
    }
    expect((await first).status).toBe(200);
    expect(await readdir(root)).toEqual(['one']);
  });

  it('caps generations per hour', async () => {
    await boot({ maxPerHour: 2 });
    expect((await gen({ slug: 'a' })).status).toBe(200);
    expect((await gen({ slug: 'b' })).status).toBe(200);
    const third = await gen({ slug: 'c' });
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
    expect(await readdir(root)).toEqual(['a', 'b']);
  });

  it('does not count validation failures against the budget', async () => {
    await boot({ maxPerHour: 1 });
    expect((await gen({ slug: '../x' })).status).toBe(400);
    expect((await gen({ slug: 'ok' })).status).toBe(200);
  });
});

describe('shutdown', () => {
  it('does not wait for a request stuck in a model call', async () => {
    let entered: () => void = () => {};
    const started = new Promise<void>((resolve) => (entered = resolve));
    await boot({ provider: { label: 'hung', complete: () => new Promise(() => entered()) } });
    void gen({ slug: 'stuck' }).catch(() => {}); // never resolves: the connection is dropped on close
    await started;
    const t0 = Date.now();
    await close();
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});
