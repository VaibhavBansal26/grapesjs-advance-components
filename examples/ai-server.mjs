// Minimal backend for the AI block generator. The API key lives here, never in the browser.
//
//   ANTHROPIC_API_KEY=sk-ant-... node examples/ai-server.mjs
//
// Then in the editor:
//   ai: { generate: createFetchGenerator('http://localhost:8787/generate') }
//
// Any provider works: all the plugin needs back is `{ "html": "..." }`.
// Add real auth and rate limiting before exposing this beyond localhost.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.AI_MODEL ?? 'claude-sonnet-5-5';
const ORIGIN = process.env.ALLOW_ORIGIN ?? 'http://localhost:8000';
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) throw new Error('Set ANTHROPIC_API_KEY');

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const readJson = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new Error('Body too large');
  }
  return JSON.parse(body);
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (req.method !== 'POST' || req.url !== '/generate') return res.writeHead(404, cors).end();

  try {
    const { prompt, system, mode, currentHtml } = await readJson(req);
    if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('prompt required');

    const user =
      mode === 'replace' && currentHtml
        ? `Current HTML:\n${currentHtml}\n\nRewrite it as requested:\n${prompt}`
        : prompt;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: typeof system === 'string' ? system : undefined,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    const data = await upstream.json();
    const html = data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') ?? '';
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify({ html }));
  } catch (err) {
    res.writeHead(500, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(err.message ?? err) }));
  }
}).listen(PORT, () => console.log(`AI endpoint on http://localhost:${PORT}/generate (model ${MODEL})`));
