import type { AiGenerate } from '../types';

/**
 * Build an `ai.generate` function that POSTs to YOUR backend.
 *
 * Request body: `{ prompt, system, mode, currentHtml }`.
 * Response: `{ "html": "<p>…</p>" }` (or a plain-text body containing the HTML).
 *
 * The model API key stays on your server. `init` lets you add auth headers or credentials.
 */
export function createFetchGenerator(url: string, init: RequestInit = {}): AiGenerate {
  return async ({ prompt, system, mode, currentHtml, signal }) => {
    const res = await fetch(url, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
      body: JSON.stringify({ prompt, system, mode, currentHtml }),
      signal,
    });
    if (!res.ok) throw new Error(`AI endpoint responded ${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (type.includes('application/json')) {
      const data = (await res.json()) as { html?: string };
      if (typeof data.html !== 'string') throw new Error('AI endpoint JSON is missing "html".');
      return data.html;
    }
    return res.text();
  };
}
