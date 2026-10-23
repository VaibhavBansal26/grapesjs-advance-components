/**
 * GrapesJS parses HTML through the DOM, so Node needs one before it is imported.
 * `jsdom` is an optional peer dependency: it is only needed by `generate` and `build`.
 */
export async function ensureDom(): Promise<void> {
  if (typeof (globalThis as { document?: unknown }).document !== 'undefined') return;
  let JSDOM: typeof import('jsdom').JSDOM;
  try {
    ({ JSDOM } = await import('jsdom'));
  } catch {
    throw new Error('This command needs jsdom. Install it with: npm i -D jsdom');
  }
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const g = globalThis as Record<string, unknown>;
  g.window = dom.window;
  g.document = dom.window.document;
  for (const key of ['DOMParser', 'Node', 'Element', 'HTMLElement', 'CustomEvent', 'XMLSerializer', 'Event']) {
    g[key] ??= (dom.window as unknown as Record<string, unknown>)[key];
  }
}
