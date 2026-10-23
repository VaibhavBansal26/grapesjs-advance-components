import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRequire } from 'node:module';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SiteOptions } from './generate';
import type { Provider } from './provider';

const MAX_BODY = 25 * 1024 * 1024;
const FILE_NAME = /^[a-z0-9][a-z0-9-]*\.(html|css|js)$/;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function resolveGrapesDist(): string {
  for (const base of [import.meta.url, `file://${process.cwd()}/`]) {
    try {
      return join(dirname(createRequire(base).resolve('grapesjs/package.json')), 'dist');
    } catch {
      /* try the next location */
    }
  }
  throw new Error('grapesjs is not installed. Run: npm i grapesjs');
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(req: IncomingMessage): Promise<any> {
  try {
    return JSON.parse(await readBody(req));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'Invalid JSON');
  }
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const pageHtml = (config: unknown) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>aac edit</title>
<link rel="stylesheet" href="/assets/grapes.min.css">
<style>html,body{margin:0;height:100%}</style>
</head>
<body>
<div id="gjs"></div>
<script src="/assets/grapes.min.js"></script>
<script src="/assets/plugin.js"></script>
<script>
const config = ${JSON.stringify(config).replace(/</g, '\\u003c')};
const api = (path, method, body) =>
  fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(new Error(e.error || r.statusText)))));

api('/project', 'GET').then((project) => {
  const aac = GrapesjsAdvanceComponents;
  const options = {
    components: [
      { label: 'Contact form', name: 'form', category: 'Form', componentType: 'form', formAction: config.formEndpoint ? { endpoint: config.formEndpoint } : {} },
      { label: 'Newsletter', name: 'newsletter', category: 'Form', componentType: 'newsletter', formAction: config.formEndpoint ? { endpoint: config.formEndpoint } : {} },
    ],
    payments: { allowedHosts: ['checkout.stripe.com', 'buy.stripe.com'].concat(config.paymentHost ? [config.paymentHost] : []) },
  };
  if (config.ai) options.ai = { generate: aac.createFetchGenerator('/ai') };

  const editor = grapesjs.init({
    container: '#gjs', height: '100%', storageManager: false, projectData: project,
    plugins: [(ed) => aac.default(ed, options)],
  });

  const setLabel = (id, text) => { const b = editor.Panels.getButton('options', id); if (b) b.set('label', text); };
  let timer;
  editor.on('update', () => {
    clearTimeout(timer);
    setLabel('aac-save', 'Saving…');
    timer = setTimeout(() => api('/project', 'PUT', editor.getProjectData())
      .then(() => setLabel('aac-save', 'Saved ✓'))
      .catch((e) => setLabel('aac-save', 'Save failed: ' + e.message)), 600);
  });

  editor.onReady(() => {
    editor.Panels.addButton('options', { id: 'aac-save', label: 'Saved ✓', command: () => {}, togglable: false });
    editor.Panels.addButton('options', {
      id: 'aac-publish', label: 'Publish ⬆', togglable: false,
      command: () => {
        setLabel('aac-publish', 'Publishing…');
        api('/publish', 'POST', { files: aac.exportSiteFiles(editor, { assets: 'external', siteName: config.siteName || undefined, description: config.description || undefined }) })
          .then((r) => setLabel('aac-publish', 'Published ' + r.written.length + ' files ✓'))
          .catch((e) => setLabel('aac-publish', 'Failed: ' + e.message))
          .then(() => setTimeout(() => setLabel('aac-publish', 'Publish ⬆'), 3000));
      },
    });
  });
});
</script>
</body>
</html>`;

export interface EditorServerOptions {
  dir: string;
  port: number;
  site: SiteOptions;
  /** Server-side model access for the ✨ button. Omit to disable AI in the editor. */
  provider?: Provider;
  /** Path of the browser build of the plugin. Defaults to `index.global.js` next to the CLI. */
  pluginAsset?: string;
}

/**
 * Local editor for a generated site. It can write files and spend your API key, so it only
 * binds to 127.0.0.1 and rejects any request whose Host or Origin is not this server.
 */
export async function startEditor(o: EditorServerOptions): Promise<{ url: string; server: Server; close: () => Promise<void> }> {
  const gjsDist = resolveGrapesDist();
  const assets: Record<string, [string, string]> = {
    '/assets/grapes.min.js': [join(gjsDist, 'grapes.min.js'), 'text/javascript'],
    '/assets/grapes.min.css': [join(gjsDist, 'css', 'grapes.min.css'), 'text/css'],
    '/assets/plugin.js': [o.pluginAsset ?? fileURLToPath(new URL('./index.global.js', import.meta.url)), 'text/javascript'],
  };
  const projectFile = join(o.dir, 'project.json');
  const publicDir = join(o.dir, 'public');
  const hosts = new Set<string>(); // filled once the real port is known (port 0 = any free port)
  const config = {
    formEndpoint: o.site.formEndpoint ?? '',
    paymentHost: o.site.paymentLink ? new URL(o.site.paymentLink).hostname : '',
    siteName: o.site.siteName ?? '',
    description: o.site.description ?? '',
    ai: !!o.provider,
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!hosts.has(req.headers.host ?? '')) throw new HttpError(403, 'Forbidden host');
    const method = req.method ?? 'GET';
    const path = (req.url ?? '/').split('?')[0]!;

    if (method !== 'GET' && method !== 'HEAD') {
      let originHost = '';
      try {
        originHost = new URL(req.headers.origin ?? '').host;
      } catch {
        /* missing or malformed */
      }
      if (!hosts.has(originHost)) throw new HttpError(403, 'Forbidden origin');
      if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'JSON only');
    }

    if (method === 'GET' && path === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return void res.end(pageHtml(config));
    }
    if (method === 'GET' && assets[path]) {
      const [file, type] = assets[path]!;
      res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
      return void res.end(await readFile(file));
    }
    if (method === 'GET' && path === '/project') return json(res, 200, JSON.parse(await readFile(projectFile, 'utf8')));

    if (method === 'PUT' && path === '/project') {
      const data = await readJson(req);
      if (!data || typeof data !== 'object' || !Array.isArray(data.pages)) throw new HttpError(400, 'Not a GrapesJS project');
      const tmp = `${projectFile}.tmp`;
      await writeFile(tmp, JSON.stringify(data, null, 2));
      await rename(tmp, projectFile);
      return json(res, 200, { ok: true });
    }

    if (method === 'POST' && path === '/publish') {
      const { files } = ((await readJson(req)) ?? {}) as { files?: Record<string, unknown> };
      const entries = Object.entries(files ?? {});
      if (!entries.length) throw new HttpError(400, 'No files');
      for (const [name, content] of entries) {
        if (!FILE_NAME.test(name) || typeof content !== 'string') throw new HttpError(400, `Rejected file name: ${name}`);
      }
      await mkdir(publicDir, { recursive: true });
      for (const [name, content] of entries) await writeFile(join(publicDir, name), content as string);
      return json(res, 200, { written: entries.map(([n]) => n) });
    }

    if (method === 'POST' && path === '/ai') {
      if (!o.provider) throw new HttpError(404, 'AI is not configured');
      const { prompt, system, mode, currentHtml } = ((await readJson(req)) ?? {}) as Record<string, unknown>;
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) throw new HttpError(400, 'Invalid prompt');
      const user = mode === 'replace' && typeof currentHtml === 'string' ? `Current HTML:\n${currentHtml.slice(0, 20000)}\n\nRewrite it as requested:\n${prompt}` : prompt;
      const html = await o.provider.complete(typeof system === 'string' ? system.slice(0, 4000) : '', user);
      return json(res, 200, { html });
    }

    throw new HttpError(404, 'Not found');
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (!res.headersSent) json(res, status, { error: status === 500 ? 'Server error' : err.message });
      if (status === 500) console.error(err);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  hosts.add(`127.0.0.1:${port}`).add(`localhost:${port}`);
  return {
    url: `http://127.0.0.1:${port}/`,
    server,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
