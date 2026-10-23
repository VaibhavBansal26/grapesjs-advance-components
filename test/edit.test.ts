import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startEditor } from '../src/cli/edit';
import type { Provider } from '../src/cli/provider';

let dir = '';
let close: () => Promise<void> = async () => {};
let url = '';
let port = 0;

const project = { pages: [{ name: 'Home' }], styles: [], assets: [] };

async function boot(provider?: Provider) {
  dir = await mkdtemp(join(tmpdir(), 'aac-edit-'));
  await writeFile(join(dir, 'project.json'), JSON.stringify(project));
  await writeFile(join(dir, 'plugin.stub.js'), '/* stub */'.repeat(200));
  const s = await startEditor({ dir, port: 0, pluginAsset: join(dir, 'plugin.stub.js'), site: { formEndpoint: '/api/contact', paymentLink: 'https://pay.example.com/p/1' }, provider });
  close = s.close;
  url = s.url;
  port = Number(new URL(url).port);
}
beforeEach(() => boot());
afterEach(async () => {
  await close();
  await rm(dir, { recursive: true, force: true });
});

/** node:http so Host and Origin can be set freely (fetch will not let a test lie about them). */
function call(method: string, path: string, opts: { headers?: Record<string, string>; body?: unknown } = {}) {
  return new Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: opts.headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode!, body, headers: res.headers }));
    });
    req.on('error', reject);
    if (opts.body !== undefined) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}
const goodHeaders = () => ({ host: `127.0.0.1:${port}`, origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json' });

describe('aac edit server', () => {
  it('binds to loopback only', async () => {
    expect(new URL(url).hostname).toBe('127.0.0.1');
  });

  it('serves the editor page and its three assets', async () => {
    const page = await call('GET', '/', { headers: { host: `127.0.0.1:${port}` } });
    expect(page.status).toBe(200);
    expect(page.body).toContain('grapes.min.js');
    expect(page.body).toContain('/ai'); // AI wired to the server-side proxy, never a key in the page
    expect(page.headers['cache-control']).toBe('no-store');
    for (const asset of ['grapes.min.js', 'grapes.min.css', 'plugin.js']) {
      const r = await call('GET', `/assets/${asset}`, { headers: { host: `127.0.0.1:${port}` } });
      expect(r.status, asset).toBe(200);
      expect(r.body.length).toBeGreaterThan(1000);
    }
  });

  it('does not leak config as executable script', async () => {
    const s = await startEditor({ dir, port: 0, pluginAsset: join(dir, 'plugin.stub.js'), site: { formEndpoint: '/x</script><script>alert(1)</script>' } });
    const p = Number(new URL(s.url).port);
    const page = await new Promise<string>((resolve) => {
      request({ host: '127.0.0.1', port: p, path: '/', headers: { host: `127.0.0.1:${p}` } }, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(b));
      }).end();
    });
    await s.close();
    expect(page).not.toContain('</script><script>alert(1)');
    expect(page).toContain('\\u003c/script>');
  });

  it('rejects a foreign Host header (DNS rebinding)', async () => {
    expect((await call('GET', '/project', { headers: { host: 'evil.example.com' } })).status).toBe(403);
    expect((await call('GET', '/', { headers: { host: `evil.example.com:${port}` } })).status).toBe(403);
  });

  it('rejects writes without a matching Origin (CSRF)', async () => {
    const base = { host: `127.0.0.1:${port}`, 'content-type': 'application/json' };
    expect((await call('PUT', '/project', { headers: base, body: project })).status).toBe(403);
    expect((await call('PUT', '/project', { headers: { ...base, origin: 'https://evil.example.com' }, body: project })).status).toBe(403);
    expect((await call('POST', '/publish', { headers: { ...base, origin: 'null' }, body: { files: { 'index.html': 'x' } } })).status).toBe(403);
    expect((await call('POST', '/ai', { headers: { ...base, origin: 'https://evil.example.com' }, body: { prompt: 'x' } })).status).toBe(403);
    expect(JSON.parse(await readFile(join(dir, 'project.json'), 'utf8'))).toEqual(project);
  });

  it('requires JSON bodies', async () => {
    const h = { ...goodHeaders(), 'content-type': 'text/plain' };
    expect((await call('PUT', '/project', { headers: h, body: 'x' })).status).toBe(415);
  });

  it('reads and saves the project, validating its shape', async () => {
    const got = await call('GET', '/project', { headers: { host: `127.0.0.1:${port}` } });
    expect(JSON.parse(got.body)).toEqual(project);

    const next = { ...project, pages: [{ name: 'Home' }, { name: 'About' }] };
    expect((await call('PUT', '/project', { headers: goodHeaders(), body: next })).status).toBe(200);
    expect(JSON.parse(await readFile(join(dir, 'project.json'), 'utf8')).pages).toHaveLength(2);

    expect((await call('PUT', '/project', { headers: goodHeaders(), body: { nope: true } })).status).toBe(400);
    expect((await call('PUT', '/project', { headers: goodHeaders(), body: '{not json' })).status).toBe(400);
    expect((await call('POST', '/publish', { headers: goodHeaders(), body: 'null' })).status).toBe(400);
    expect(JSON.parse(await readFile(join(dir, 'project.json'), 'utf8')).pages).toHaveLength(2); // untouched by bad writes
  });

  it('publishes allowed file names into public/ and nothing else', async () => {
    const ok = await call('POST', '/publish', { headers: goodHeaders(), body: { files: { 'index.html': '<p>hi</p>', 'index.css': 'a{}', 'index.js': '1' } } });
    expect(ok.status).toBe(200);
    expect((await readdir(join(dir, 'public'))).sort()).toEqual(['index.css', 'index.html', 'index.js']);
    expect(await readFile(join(dir, 'public', 'index.html'), 'utf8')).toBe('<p>hi</p>');
  });

  it.each(['../evil.html', '..\\evil.html', '/etc/passwd.html', 'sub/index.html', '.hidden.html', 'index.php', 'index', 'A.html', 'a b.html'])(
    'rejects file name %j and writes nothing',
    async (name) => {
      const r = await call('POST', '/publish', { headers: goodHeaders(), body: { files: { 'ok.html': 'fine', [name]: 'bad' } } });
      expect(r.status).toBe(400);
      expect(await readdir(dir)).not.toContain('public'); // even the valid sibling is not written
    },
  );

  it('rejects empty and non-string publish payloads', async () => {
    expect((await call('POST', '/publish', { headers: goodHeaders(), body: { files: {} } })).status).toBe(400);
    expect((await call('POST', '/publish', { headers: goodHeaders(), body: { files: { 'a.html': 5 } } })).status).toBe(400);
  });

  it('has no AI route unless a provider is configured', async () => {
    expect((await call('POST', '/ai', { headers: goodHeaders(), body: { prompt: 'hello' } })).status).toBe(404);
  });

  it('proxies AI through the server-side provider and validates input', async () => {
    await close();
    await rm(dir, { recursive: true, force: true });
    let seen: { system: string; user: string } | undefined;
    await boot({ label: 't', complete: async (system, user) => ((seen = { system, user }), '<p>generated</p>') });

    const ok = await call('POST', '/ai', { headers: goodHeaders(), body: { prompt: 'Add a hero', system: 'be brief', mode: 'replace', currentHtml: '<h1>Old</h1>' } });
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body)).toEqual({ html: '<p>generated</p>' });
    expect(seen!.system).toBe('be brief');
    expect(seen!.user).toContain('<h1>Old</h1>');
    expect(seen!.user).toContain('Add a hero');

    expect((await call('POST', '/ai', { headers: goodHeaders(), body: { prompt: '   ' } })).status).toBe(400);
    expect((await call('POST', '/ai', { headers: goodHeaders(), body: { prompt: 'x'.repeat(8001) } })).status).toBe(400);
    expect((await call('POST', '/ai', { headers: goodHeaders(), body: { prompt: 42 } })).status).toBe(400);
  });

  it('returns 404 for anything else, including path tricks', async () => {
    const h = { host: `127.0.0.1:${port}` };
    expect((await call('GET', '/nope', { headers: h })).status).toBe(404);
    expect((await call('GET', '/assets/../../etc/passwd', { headers: h })).status).toBe(404);
    expect((await call('GET', '/assets/%2e%2e/package.json', { headers: h })).status).toBe(404);
    expect((await call('DELETE', '/project', { headers: goodHeaders() })).status).toBe(404);
  });
});
