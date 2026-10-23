import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractJson, parseCopy, sampleCopy } from '../src/cli/copy';
import { main, parseArgs } from '../src/cli/index';
import { exportProject, generateSite } from '../src/cli/generate';
import { mockProvider, resolveProvider, type Provider } from '../src/cli/provider';
import { TEMPLATES } from '../src/cli/templates';

const gen = (over: Record<string, unknown> = {}) =>
  generateSite({ brief: 'Bakery in Leeds with online orders', template: 'landing', provider: mockProvider(), ...over } as never);

describe('copy parsing', () => {
  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go: {"a":{"b":2}} Hope that helps.')).toEqual({ a: { b: 2 } });
    expect(() => extractJson('no json here')).toThrow(/no JSON/);
  });

  it('accepts the sample copy for every template', () => {
    for (const t of TEMPLATES) expect(() => parseCopy(sampleCopy('A thing'), t.needs), t.id).not.toThrow();
  });

  it('rejects incomplete replies with a message the model can act on', () => {
    expect(() => parseCopy({ name: 'X', hero: { headline: 'h' } }, ['name', 'hero'])).toThrow(/hero needs headline and subheadline/);
    const c = sampleCopy('x');
    expect(() => parseCopy({ ...c, faq: [c.faq[0]] }, ['faq'])).toThrow(/faq needs at least 3/);
  });

  it('bounds lengths, strips whitespace and ignores non-string values', () => {
    const c = parseCopy({ ...sampleCopy('x'), name: '  A   B  ', tagline: 'x'.repeat(500), about: 42 }, ['name', 'tagline']);
    expect(c.name).toBe('A B');
    expect(c.tagline).toHaveLength(140);
    expect(c.about).toBe('');
  });
});

describe('generateSite', () => {
  it('builds a multi-page landing site from copy', async () => {
    const site = await gen({ name: 'Crumb & Co' });
    expect(site.pages).toEqual(['Home', 'Pricing', 'Contact']);
    expect(Object.keys(site.files).sort()).toEqual(['contact.css', 'contact.html', 'contact.js', 'index.css', 'index.html', 'pricing.css', 'pricing.html']);
    const home = site.files['index.html']!;
    expect(home).toContain('aac-hero');
    expect(home).toContain('Crumb &amp; Co');
    expect(home).toContain('aac-faq');
    expect(home).toContain('href="pricing.html"');
    expect(home).toContain('href="contact.html"');
    expect(home).toContain('<link rel="stylesheet" href="index.css">');
    expect(home).not.toMatch(/<style|<script>/);
    expect(site.project).toHaveProperty('pages');
    expect(home).toContain('<title>Crumb &amp; Co</title>');
    expect(site.files['pricing.html']).toContain('<title>Pricing · Crumb &amp; Co</title>');
    expect(home).toMatch(/<meta name="description" content="[^"]+">/);
  });

  it('puts a working contact form on the contact page', async () => {
    const site = await gen({ formEndpoint: 'https://api.example.com/contact' });
    expect(site.files['contact.html']).toContain('action="https://api.example.com/contact"');
    expect(site.files['contact.html']).toContain('name="_gotcha"');
    expect(site.files['contact.js']).toContain('aac:form-submit');
  });

  it('uses checkout buttons when a payment link is given, contact links otherwise', async () => {
    const withLink = await gen({ paymentLink: 'https://buy.stripe.com/test_abc' });
    expect(withLink.files['pricing.html']).toContain('aac-checkout');
    expect(withLink.files['pricing.js']).toContain('https://buy.stripe.com/test_abc');
    const without = await gen();
    expect(without.files['pricing.html']).not.toContain('aac-checkout');
    expect(without.files['pricing.html']).toContain('href="contact.html"');
    expect(without.files['pricing.js']).toBeUndefined();
  });

  it('allows a custom-domain payment link host at runtime', async () => {
    const site = await gen({ paymentLink: 'https://pay.mybakery.com/p/1' });
    expect(site.files['pricing.js']).toContain('pay.mybakery.com');
  });

  it('applies the accent colour and dark theme', async () => {
    const site = await gen({ accent: '#0d9488', theme: 'dark' });
    expect(site.files['index.css']).toContain('--aac-accent:#0d9488');
    expect(site.files['index.css']).toMatch(/--aac-accent-hover:#[0-9a-f]{6}/);
    expect(site.files['index.html']).toContain('data-aac-theme="dark"');
  });

  it('escapes model text instead of trusting it as HTML', async () => {
    const evil: Provider = {
      label: 'evil',
      complete: async () =>
        JSON.stringify({ ...sampleCopy('x'), name: '<img src=x onerror=alert(1)>', hero: { headline: '<script>alert(1)</script>', subheadline: 'ok', cta: '"><b>go' } }),
    };
    const site = await gen({ provider: evil });
    const all = Object.values(site.files).join('\n');
    expect(all).not.toContain('<script>alert');
    expect(all).not.toContain('<img src=x');
    expect(all).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('retries once when the first reply is unusable', async () => {
    let calls = 0;
    const flaky: Provider = {
      label: 'flaky',
      complete: async (_s, user) => {
        calls++;
        if (calls === 1) return 'sorry, I cannot do that';
        expect(user).toMatch(/previous reply was rejected/);
        return JSON.stringify(sampleCopy('x'));
      },
    };
    await gen({ provider: flaky });
    expect(calls).toBe(2);
  });

  it('gives up after two bad replies', async () => {
    const bad: Provider = { label: 'bad', complete: async () => '{"name":"x"}' };
    await expect(gen({ provider: bad })).rejects.toThrow(/after 2 attempts/);
  });

  it('works for every template', async () => {
    for (const t of TEMPLATES) {
      const site = await gen({ template: t.id });
      expect(site.files['index.html'], t.id).toContain('aac-site');
    }
  });

  it('validates flags and brief up front', async () => {
    await expect(gen({ brief: '  ' })).rejects.toThrow(/Describe the site/);
    await expect(gen({ accent: 'red; } body{display:none' })).rejects.toThrow(/hex colour/);
    await expect(gen({ paymentLink: 'http://buy.stripe.com/x' })).rejects.toThrow(/https/);
    await expect(gen({ formEndpoint: 'javascript:alert(1)' })).rejects.toThrow(/form-endpoint/);
    await expect(gen({ template: 'nope' })).rejects.toThrow(/Unknown template/);
  });

  it('re-exports a saved project to the same files', async () => {
    const site = await gen({ formEndpoint: '/api/contact', paymentLink: 'https://buy.stripe.com/test_abc' });
    const again = await exportProject(site.project, { formEndpoint: '/api/contact', paymentLink: 'https://buy.stripe.com/test_abc' });
    expect(Object.keys(again).sort()).toEqual(Object.keys(site.files).sort());
    expect(again['contact.html']).toContain('action="/api/contact"');
    expect(again['pricing.js']).toContain('https://buy.stripe.com/test_abc');
  });
});

describe('providers', () => {
  let server: Server | undefined;
  afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

  it('talks to the Anthropic Messages API with the key from the environment only', async () => {
    const seen: { key?: string; body?: Record<string, unknown> } = {};
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen.key = req.headers['x-api-key'] as string;
        seen.body = JSON.parse(body);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(sampleCopy('Dog groomer')) }] }));
      });
    }).listen(0);
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/messages`;
    const provider = resolveProvider({ env: { ANTHROPIC_API_KEY: 'sk-test', AAC_ANTHROPIC_URL: url } });
    const site = await generateSite({ brief: 'Dog groomer in Bath', template: 'local-business', provider });
    expect(seen.key).toBe('sk-test');
    expect(seen.body).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 4096 });
    expect(String(seen.body!.system)).toMatch(/ONLY one JSON object/);
    expect(JSON.stringify(seen.body)).toContain('Dog groomer in Bath');
    expect(site.pages).toEqual(['Home', 'About', 'Contact']);
  });

  it('surfaces API failures clearly', async () => {
    server = createServer((_q, res) => res.writeHead(401).end()).listen(0);
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    const provider = resolveProvider({ env: { ANTHROPIC_API_KEY: 'bad', AAC_ANTHROPIC_URL: url } });
    await expect(provider.complete('s', 'u')).rejects.toThrow(/401.*ANTHROPIC_API_KEY/);
  });

  it('works with your own endpoint', async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        expect(JSON.parse(body)).toMatchObject({ mode: 'insert' });
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ html: JSON.stringify(sampleCopy('x')) }));
      });
    }).listen(0);
    const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ai`;
    const site = await generateSite({ brief: 'A shop', template: 'shop', provider: resolveProvider({ endpoint }) });
    expect(site.pages).toEqual(['Home', 'Contact']);
  });

  it('explains how to proceed when no provider is configured', () => {
    expect(() => resolveProvider({ env: {} })).toThrow(/ANTHROPIC_API_KEY.*--provider endpoint.*mock/s);
    expect(() => resolveProvider({ provider: 'endpoint', env: {} })).toThrow(/--endpoint/);
    expect(() => resolveProvider({ provider: 'wat', env: {} })).toThrow(/Unknown provider/);
  });
});

describe('aac commands', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = '';
  });
  const run = async (...args: string[]) => {
    const logs: string[] = [];
    const log = console.log;
    const err = console.error;
    console.log = (...a: unknown[]) => void logs.push(a.join(' '));
    console.error = (...a: unknown[]) => void logs.push(a.join(' '));
    try {
      return { code: await main(args), out: logs.join('\n') };
    } finally {
      console.log = log;
      console.error = err;
    }
  };

  it('parses flags, inline values and booleans', () => {
    const a = parseArgs(['generate', 'a brief', '--template', 'shop', '--accent=#fff', '--force']);
    expect(a._).toEqual(['generate', 'a brief']);
    expect(a.flags).toEqual({ template: 'shop', accent: '#fff', force: true });
    expect(() => parseArgs(['--out'])).toThrow(/needs a value/);
  });

  it('generate writes the project, config and site; build keeps titles and settings', async () => {
    dir = await mkdtemp(join(tmpdir(), 'aac-'));
    const out = join(dir, 'site');
    const gen = await run('generate', 'Candle studio in Bristol', '--template', 'shop', '--provider', 'mock', '--name', 'Wick & Co',
      '--payment-link', 'https://buy.stripe.com/test_1', '--form-endpoint', '/api/contact', '--out', out);
    expect(gen.code).toBe(0);
    expect(gen.out).toContain('Wick & Co');

    const config = JSON.parse(await readFile(join(out, 'aac.json'), 'utf8'));
    expect(config).toMatchObject({ siteName: 'Wick & Co', template: 'shop', formEndpoint: '/api/contact', paymentLink: 'https://buy.stripe.com/test_1' });
    expect(config.description).toBeTruthy();
    expect(JSON.parse(await readFile(join(out, 'project.json'), 'utf8'))).toHaveProperty('pages');
    expect(await readdir(join(out, 'public'))).toContain('index.html');

    await rm(join(out, 'public'), { recursive: true });
    const built = await run('build', out);
    expect(built.code).toBe(0);
    const home = await readFile(join(out, 'public', 'index.html'), 'utf8');
    expect(home).toContain('<title>Wick &amp; Co</title>');
    expect(home).toMatch(/<meta name="description"/);
    expect(await readFile(join(out, 'public', 'index.js'), 'utf8')).toContain('https://buy.stripe.com/test_1');
  });

  it('refuses to overwrite a project without --force', async () => {
    dir = await mkdtemp(join(tmpdir(), 'aac-'));
    const args = ['generate', 'A shop', '--provider', 'mock', '--out', dir];
    expect((await run(...args)).code).toBe(0);
    const again = await run(...args);
    expect(again.code).toBe(1);
    expect(again.out).toMatch(/--force/);
    expect((await run(...args, '--force')).code).toBe(0);
  });

  it('prints helpful errors and non-zero exit codes', async () => {
    expect((await run('generate')).out).toMatch(/Describe the site/);
    expect((await run('generate', 'x', '--provider', 'anthropic', '--out', 'zz-never-written')).out).toMatch(/ANTHROPIC_API_KEY/);
    expect((await run('bogus')).code).toBe(1);
    expect((await run('build', join(tmpdir(), 'aac-does-not-exist'))).out).toMatch(/No project.json/);
    expect((await run('templates')).out).toContain('local-business');
    expect((await run('--help')).code).toBe(0);
  });
});
