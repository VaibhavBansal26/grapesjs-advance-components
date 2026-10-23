import { describe, expect, it } from 'vitest';
import { assertSafe, redactMatch, redactSecrets, scanFiles, SecurityError } from '../src/security/scan';

// Fake secrets are assembled at runtime so no secret-shaped literal is ever committed
// (GitHub push protection rightly blocks those, even when they are fake).
const j = (...parts: string[]) => parts.join('');
const rep = (c: string, n: number) => c.repeat(n);
const FAKE = {
  anthropic: j('sk', '-', 'ant', '-', 'api03', '-', rep('x', 40)),
  openai: j('sk', '-', rep('a', 40)),
  stripeLive: j('sk', '_', 'live', '_', rep('4', 24)),
  stripeRestricted: j('rk', '_', 'test', '_', rep('9', 24)),
  stripeWebhook: j('whsec', '_', rep('b', 32)),
  github: j('ghp', '_', rep('c', 36)),
  aws: j('AKIA', rep('Q', 16)),
  slack: j('xoxb', '-', rep('1', 12), '-', rep('z', 12)),
  google: j('AIza', rep('Y', 35)),
  jwt: j('eyJ', rep('h', 12), '.', 'eyJ', rep('p', 12), '.', rep('s', 12)),
  privateKey: j('-----BEGIN ', 'RSA ', 'PRIVATE KEY', '-----'),
  publishable: j('pk', '_', 'live', '_', rep('5', 24)),
};

const scan = (content: string, file = 'index.html', allow?: string[]) => scanFiles({ [file]: content }, { allow });
const rules = (content: string, file?: string) => scan(content, file).map((f) => f.rule);

describe('secret formats', () => {
  it.each([
    ['anthropic-key', FAKE.anthropic],
    ['openai-key', FAKE.openai],
    ['stripe-secret-key', FAKE.stripeLive],
    ['stripe-secret-key', FAKE.stripeRestricted],
    ['stripe-webhook-secret', FAKE.stripeWebhook],
    ['github-token', FAKE.github],
    ['aws-access-key', FAKE.aws],
    ['slack-token', FAKE.slack],
    ['private-key', FAKE.privateKey],
  ])('flags %s as high severity', (rule, secret) => {
    const found = scan(`<script>var x="${secret}";</script>`);
    const hit = found.find((f) => f.rule === rule);
    expect(hit, rule).toBeDefined();
    expect(hit!.severity).toBe('high');
  });

  it('flags Google keys and JWTs as medium', () => {
    expect(scan(FAKE.google).find((f) => f.rule === 'google-api-key')?.severity).toBe('medium');
    expect(scan(FAKE.jwt).find((f) => f.rule === 'jwt')?.severity).toBe('medium');
  });

  it('never reports or prints the full secret', () => {
    const findings = scan(`token ${FAKE.anthropic} end`);
    expect(JSON.stringify(findings)).not.toContain(FAKE.anthropic);
    expect(findings[0]!.match).toBe(redactMatch(FAKE.anthropic));
    let message = '';
    try {
      assertSafe({ 'index.html': FAKE.stripeLive });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/Blocked/);
    expect(message).not.toContain(FAKE.stripeLive);
  });

  it('does not flag Stripe publishable keys, price ids or ordinary text', () => {
    expect(rules(`<p>${FAKE.publishable} price_1Abc2Def3Ghi4Jkl5Mno desk-clean task-based approach</p>`)).toEqual([]);
  });

  it('reports the correct line number and sorts high severity first', () => {
    const f = scan(`line one\nline two\n<a href="http://insecure.example/x">x</a>\n${FAKE.github}`);
    expect(f[0]!.severity).toBe('high');
    expect(f[0]!.line).toBe(4);
    expect(f.find((x) => x.rule === 'mixed-content')!.line).toBe(3);
  });
});

describe('secrets carried by URLs', () => {
  it.each([
    'https://api.example.com/hook?api_key=abcdef123456',
    'https://example.com/x?token=abcdef123456&y=1',
    'https://example.com/x?y=1&secret=abcdef123456',
    'https://example.com/x?access_token=abcdef123456',
  ])('flags %s', (url) => {
    expect(rules(`<form action="${url}"></form>`)).toContain('url-secret-param');
  });

  it('flags credentials inside a URL', () => {
    expect(rules('<a href="https://admin:hunter2pass@db.example.com/">x</a>')).toContain('url-credentials');
  });

  it('treats an n8n webhook URL as a public bearer capability', () => {
    const hook = 'https://n8n.example.com/webhook/6f1e2d3c-intake';
    const f = scan(`<form action="${hook}"></form>`);
    expect(f.find((x) => x.rule === 'public-webhook-url')?.severity).toBe('low');
    expect(scan('https://n8n.example.com/webhook-test/abc123').find((x) => x.rule === 'webhook-test-url')?.severity).toBe('medium');
  });

  it('does not flag harmless query strings', () => {
    expect(rules('<a href="/search?q=candles&page=2">x</a><a href="https://buy.stripe.com/test_abc">buy</a>')).toEqual([]);
  });
});

describe('risky markup', () => {
  it('flags inline handlers, javascript: URLs and insecure forms', () => {
    expect(rules('<img src="a.png" onerror="alert(1)">')).toContain('inline-event-handler');
    expect(rules('<a href="javascript:alert(1)">x</a>')).toContain('javascript-url');
    expect(rules('<form action="http://api.example.com/x"></form>')).toContain('insecure-form-action');
    expect(rules('<form action="http://localhost:3000/x"></form>')).not.toContain('insecure-form-action');
  });

  it('flags third-party and inline scripts, but not our external script', () => {
    expect(rules('<script src="https://cdn.example.com/lib.js"></script>')).toContain('third-party-script');
    expect(rules('<script>doThing()</script>')).toContain('inline-script');
    expect(rules('<script src="index.js" defer></script>')).toEqual([]);
  });

  it('flags eval in scripts only', () => {
    expect(rules('eval("1+1")', 'app.js')).toContain('dynamic-eval');
    expect(rules('<p>we eval( uate things</p>', 'page.html')).not.toContain('dynamic-eval');
  });

  it('skips non-text files and honours explicit allow-lists', () => {
    expect(scanFiles({ 'photo.png': FAKE.github })).toEqual([]);
    expect(scan(FAKE.github, 'x.html', ['github-token'])).toEqual([]);
  });

  it('caps the report so a pathological file cannot flood it', () => {
    expect(scan(rep(`${FAKE.github}\n`, 2000)).length).toBeLessThanOrEqual(501);
  });
});

describe('assertSafe', () => {
  it('blocks high severity by default and lists redacted findings', () => {
    expect(() => assertSafe({ 'a.html': FAKE.openai })).toThrow(SecurityError);
    try {
      assertSafe({ 'a.html': `x ${FAKE.openai}` });
    } catch (e) {
      expect((e as SecurityError).findings[0]!.rule).toBe('openai-key');
    }
  });

  it('lets medium and low through unless the threshold is lowered', () => {
    const files = { 'a.html': '<img onerror="x()"><script>go()</script>' };
    expect(() => assertSafe(files)).not.toThrow();
    expect(() => assertSafe(files, { threshold: 'medium' })).toThrow(SecurityError);
    expect(() => assertSafe(files, { threshold: 'low' })).toThrow(SecurityError);
  });

  it('returns the non-blocking findings for display', () => {
    expect(assertSafe({ 'a.html': '<script>go()</script>' }).map((f) => f.rule)).toEqual(['inline-script']);
  });
});

describe('redactSecrets', () => {
  it('removes literal values and known formats from text', () => {
    const env = 'my-super-secret-env-value-123';
    const out = redactSecrets(`failed with ${env} and ${FAKE.anthropic} and ${FAKE.stripeLive}`, [env]);
    expect(out).not.toContain(env);
    expect(out).not.toContain(FAKE.anthropic);
    expect(out).not.toContain(FAKE.stripeLive);
    expect(out).toContain('[redacted]');
  });

  it('redacts secret query parameters', () => {
    expect(redactSecrets('GET https://x.example/hook?token=abcdef123456&a=1')).toBe('GET https://x.example/hook?token=[redacted]&a=1');
  });

  it('ignores short or missing literals instead of blanking the text', () => {
    expect(redactSecrets('hello world', ['a', undefined, ''])).toBe('hello world');
  });
});

describe('source and config files', () => {
  it('scans common source and key file types, not just web assets', () => {
    for (const file of ['config.ts', 'app.py', 'deploy.sh', 'server.pem', 'settings.toml', 'component.vue', '.env']) {
      expect(scan(`KEY=${FAKE.stripeLive}`, file).map((f) => f.rule), file).toContain('stripe-secret-key');
    }
    expect(scanFiles({ 'image.png': FAKE.stripeLive, 'archive.zip': FAKE.stripeLive })).toEqual([]);
  });
});
