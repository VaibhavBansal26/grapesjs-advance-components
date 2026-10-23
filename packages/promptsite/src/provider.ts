import { sampleCopy } from './copy';

/** Anything that can turn a system + user prompt into text. The CLI never stores a key. */
export interface Provider {
  label: string;
  complete(system: string, user: string, signal?: AbortSignal): Promise<string>;
}

export interface ProviderOptions {
  provider?: string;
  endpoint?: string;
  model?: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
}

const DEFAULT_MODEL = 'claude-sonnet-5-5';

/** Anthropic Messages API, using ANTHROPIC_API_KEY from the environment. `PROMPTSITE_ANTHROPIC_URL` overrides the host (proxies, tests). */
export function anthropicProvider(opts: { apiKey: string; model: string; url?: string; fetch?: typeof fetch }): Provider {
  const doFetch = opts.fetch ?? fetch;
  return {
    label: `anthropic (${opts.model})`,
    async complete(system, user, signal) {
      const res = await doFetch(opts.url ?? 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: opts.model, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] }),
        signal,
      });
      if (!res.ok) throw new Error(`Anthropic API responded ${res.status}${res.status === 401 ? ' (check ANTHROPIC_API_KEY)' : ''}.`);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      if (!text) throw new Error('Anthropic API returned no text.');
      return text;
    },
  };
}

/** Your own backend, with the same contract as the editor's `createFetchGenerator`: POST { prompt, system, mode } -> { html }. */
export function endpointProvider(url: string, doFetch: typeof fetch = fetch): Provider {
  return {
    label: `endpoint (${new URL(url).host})`,
    async complete(system, user, signal) {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: user, system, mode: 'insert' }),
        signal,
      });
      if (!res.ok) throw new Error(`Endpoint responded ${res.status}.`);
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('application/json')) {
        const data = (await res.json()) as { html?: string; text?: string };
        const text = data.html ?? data.text;
        if (typeof text !== 'string') throw new Error('Endpoint JSON has no "html" field.');
        return text;
      }
      return res.text();
    },
  };
}

/** Offline stand-in that writes placeholder copy. For trying the pipeline without a key. */
export function mockProvider(): Provider {
  return {
    label: 'mock (placeholder copy, no model)',
    async complete(_system, user) {
      const brief = user.match(/Brief:\s*([\s\S]*?)(?:\n\nBusiness name:|$)/)?.[1] ?? user;
      const name = user.match(/Business name:\s*(.+)/)?.[1]?.trim();
      return JSON.stringify(sampleCopy(brief, name));
    },
  };
}

export function resolveProvider(o: ProviderOptions = {}): Provider {
  const env = o.env ?? process.env;
  const kind = o.provider ?? (o.endpoint ? 'endpoint' : 'anthropic');
  if (kind === 'mock') return mockProvider();
  if (kind === 'endpoint') {
    if (!o.endpoint) throw new Error('--provider endpoint needs --endpoint <url>.');
    return endpointProvider(o.endpoint, o.fetch);
  }
  if (kind === 'anthropic') {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Set ANTHROPIC_API_KEY, or choose --provider endpoint --endpoint <url>, or try --provider mock.');
    }
    return anthropicProvider({ apiKey, model: o.model ?? env.PROMPTSITE_MODEL ?? DEFAULT_MODEL, url: env.PROMPTSITE_ANTHROPIC_URL, fetch: o.fetch });
  }
  throw new Error(`Unknown provider "${kind}". Use anthropic, endpoint or mock.`);
}
