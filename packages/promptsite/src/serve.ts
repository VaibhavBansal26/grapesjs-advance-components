import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createZip, redactSecrets, scanFiles, SecurityError, type Finding } from 'grapesjs-advance-components';
import { collectAuditFiles } from './collect';
import { exportProject, generateSite, validateOptions } from './generate';
import { getTemplate } from './templates';
import type { Provider } from './provider';
import { confined, readConfig, saveSite, writeFiles, type SavedConfig } from './site';

/**
 * HTTP API so workflow tools (n8n, Zapier, Make, a cron job) can generate, build and audit sites.
 * It can spend model credits and write files, so it is closed by default: a strong bearer token
 * is mandatory, it listens on loopback unless told otherwise, it refuses browser requests, and
 * every site lives in its own folder under one root.
 */

const MAX_BODY = 64 * 1024;
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MIN_TOKEN = 24;

class HttpError extends Error {
  constructor(public status: number, message: string, public headers: Record<string, string> = {}) {
    super(message);
  }
}

export interface ApiOptions {
  root: string;
  port: number;
  /** Interface to listen on. Default loopback. Anything else needs TLS in front of it. */
  host?: string;
  /** Bearer token. Read it from the environment, never from a command-line flag. */
  token: string;
  provider: Provider;
  /** Scanner rule ids to ignore. Applies to every request. */
  allow?: string[];
  /** Generations allowed per rolling hour. Default 30. */
  maxPerHour?: number;
}

const digest = (s: string) => createHash('sha256').update(s).digest();

export function checkToken(token: string | undefined): string {
  if (!token || token.length < MIN_TOKEN) {
    throw new Error(`PROMPTSITE_API_TOKEN must be set to a random secret of at least ${MIN_TOKEN} characters (try: openssl rand -hex 24).`);
  }
  return token;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'Send application/json');
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Body too large');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

function reply(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers });
  res.end(JSON.stringify(body));
}

const optString = (v: unknown, name: string, max: number): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.length > max) throw new HttpError(400, `${name} must be a string of at most ${max} characters`);
  return v;
};

const slugOf = (body: Record<string, unknown>): string => {
  const slug = body.slug;
  if (typeof slug !== 'string' || !SLUG.test(slug)) throw new HttpError(400, 'slug must be 1-63 characters of a-z, 0-9 and hyphens, starting with a letter or digit');
  return slug;
};

const brief = (f: Finding) => ({ severity: f.severity, rule: f.rule, file: f.file, line: f.line, message: f.message, match: f.match });

export async function startApi(o: ApiOptions): Promise<{ url: string; server: Server; close: () => Promise<void> }> {
  const token = digest(checkToken(o.token));
  const host = o.host ?? '127.0.0.1';
  const maxPerHour = o.maxPerHour ?? 30;
  const failures = new Map<string, { count: number; since: number }>();
  const generations: number[] = [];
  let busy = false;

  const authorize = (req: IncomingMessage) => {
    const ip = req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    const f = failures.get(ip);
    if (f && now - f.since < 60_000 && f.count >= 5) throw new HttpError(429, 'Too many failed attempts', { 'retry-after': '60' });
    const given = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1] ?? '';
    if (!timingSafeEqual(digest(given), token)) {
      if (failures.size > 1000) failures.clear(); // bound memory under a distributed guessing attempt
      failures.set(ip, !f || now - f.since >= 60_000 ? { count: 1, since: now } : { count: f.count + 1, since: f.since });
      throw new HttpError(401, 'Unauthorized', { 'www-authenticate': 'Bearer' });
    }
    failures.delete(ip);
  };

  /** One model-spending job at a time, and a rolling hourly cap, so a leaked token cannot run up a bill quickly. */
  const exclusive = async <T>(count: boolean, job: () => Promise<T>): Promise<T> => {
    if (busy) throw new HttpError(429, 'Another job is running', { 'retry-after': '5' });
    const cutoff = Date.now() - 3_600_000;
    while (generations.length && generations[0]! < cutoff) generations.shift();
    if (count && generations.length >= maxPerHour) throw new HttpError(429, 'Hourly generation limit reached', { 'retry-after': '600' });
    busy = true;
    if (count) generations.push(Date.now());
    try {
      return await job();
    } finally {
      busy = false;
    }
  };

  const siteDir = (slug: string) => confined(o.root, slug);
  const exists = (p: string) => stat(p).then(() => true, () => false);

  const guardFindings = (err: unknown): never => {
    if (err instanceof SecurityError) throw new HttpError(422, err.message);
    throw err;
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? 'GET';
    const path = (req.url ?? '/').split('?')[0]!;

    if (method === 'GET' && path === '/health') return reply(res, 200, { ok: true });

    if (req.headers.origin !== undefined) throw new HttpError(403, 'Browser requests are not accepted');
    authorize(req);

    if (method === 'GET' && path === '/v1/sites') {
      const names = (await readdir(o.root, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory() && SLUG.test(e.name));
      const sites = [];
      for (const e of names) if (await exists(join(o.root, e.name, 'project.json'))) sites.push({ slug: e.name, name: (await readConfig(join(o.root, e.name))).siteName ?? e.name });
      return reply(res, 200, { sites });
    }

    const bundle = /^\/v1\/sites\/([a-z0-9-]+)\/bundle\.zip$/.exec(path);
    if (method === 'GET' && bundle) {
      if (!SLUG.test(bundle[1]!)) throw new HttpError(404, 'Not found');
      const files = await collectPublic(siteDir(bundle[1]!));
      if (!files) throw new HttpError(404, 'Site not found');
      const zip = createZip(files);
      res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${bundle[1]}.zip"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return void res.end(Buffer.from(zip));
    }

    if (method !== 'POST') throw new HttpError(404, 'Not found');

    if (path === '/v1/generate') {
      const body = await readJson(req);
      const slug = slugOf(body);
      const dir = siteDir(slug);
      const text = optString(body.brief, 'brief', 2000);
      if (!text) throw new HttpError(400, 'brief is required');
      const template = optString(body.template, 'template', 40) ?? 'landing';
      try {
        getTemplate(template);
      } catch (err) {
        throw new HttpError(400, (err as Error).message);
      }
      const site = {
        formEndpoint: optString(body.formEndpoint, 'formEndpoint', 500),
        paymentLink: optString(body.paymentLink, 'paymentLink', 500),
      };
      const accent = optString(body.accent, 'accent', 9);
      const theme = optString(body.theme, 'theme', 5) as 'light' | 'dark' | undefined;
      try {
        validateOptions({ ...site, accent, theme });
      } catch (err) {
        throw new HttpError(400, (err as Error).message);
      }
      if ((await exists(join(dir, 'project.json'))) && body.force !== true) throw new HttpError(409, 'Site already exists; send "force": true to overwrite');

      const result = await exclusive(true, () =>
        generateSite({ brief: text, template, provider: o.provider, name: optString(body.name, 'name', 80), accent, theme, allow: o.allow, ...site }).catch(guardFindings),
      );
      const config: SavedConfig = { ...site, template, brief: text, siteName: result.copy.name, description: result.copy.tagline, accent, theme };
      await saveSite(dir, { project: result.project, files: result.files, config });
      return reply(res, 200, { slug, name: result.copy.name, pages: result.pages, files: Object.keys(result.files), findings: result.findings.map(brief), bundle: `/v1/sites/${slug}/bundle.zip` });
    }

    if (path === '/v1/build') {
      const slug = slugOf(await readJson(req));
      const dir = siteDir(slug);
      if (!(await exists(join(dir, 'project.json')))) throw new HttpError(404, 'Site not found');
      const files = await exclusive(false, async () => {
        const saved = await readConfig(dir);
        const project = JSON.parse(await readFile(join(dir, 'project.json'), 'utf8'));
        return exportProject(project, { ...saved, allow: o.allow }).catch(guardFindings);
      });
      await writeFiles(join(dir, 'public'), files);
      return reply(res, 200, { slug, files: Object.keys(files), bundle: `/v1/sites/${slug}/bundle.zip` });
    }

    if (path === '/v1/audit') {
      const slug = slugOf(await readJson(req));
      const dir = siteDir(slug);
      if (!(await exists(join(dir, 'project.json')))) throw new HttpError(404, 'Site not found');
      const files = await collectAuditFiles(dir);
      const findings = scanFiles(files, { allow: o.allow });
      const count = (s: string) => findings.filter((f) => f.severity === s).length;
      return reply(res, 200, { slug, scanned: Object.keys(files).length, passed: count('high') === 0, summary: { high: count('high'), medium: count('medium'), low: count('low') }, findings: findings.map(brief) });
    }

    throw new HttpError(404, 'Not found');
  };

  const server = createServer((req, res) => {
    handle(req, res)
      .then(() => console.log(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode}`))
      .catch((err) => {
        const status = err instanceof HttpError ? err.status : 500;
        if (!res.headersSent) reply(res, status, { error: status === 500 ? 'Server error' : err.message }, err instanceof HttpError ? err.headers : {});
        console.log(`${req.method} ${(req.url ?? '').split('?')[0]} ${status}`);
        // Server-side detail for the operator, with anything secret-shaped removed.
        if (status === 500) console.error(redactSecrets(String(err?.stack ?? err), [process.env.ANTHROPIC_API_KEY, process.env.PROMPTSITE_API_TOKEN]));
      });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port, host, resolve);
  });
  const { port } = server.address() as AddressInfo;
  return { url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`, server, close: () => new Promise<void>((r) => {
      server.close(() => r());
      server.closeAllConnections(); // a request stuck in a model call must not keep shutdown waiting
    }) };
}

async function collectPublic(dir: string): Promise<Record<string, string> | undefined> {
  const files = await collectAuditFiles(dir);
  const pub = Object.fromEntries(Object.entries(files).filter(([n]) => n.startsWith('public/')).map(([n, c]) => [n.slice('public/'.length), c]));
  return Object.keys(pub).length ? pub : undefined;
}
