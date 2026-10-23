import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { createFetchGenerator, type AiGenerate } from '../src';

let editors: Editor[] = [];

function make(generate: AiGenerate, extra: Record<string, unknown> = {}) {
  const el = document.createElement('div');
  document.body.append(el);
  const editor = grapesjs.init({
    container: el,
    storageManager: false,
    headless: true,
    plugins: [(ed) => plugin(ed, { ai: { generate, ...extra } })],
  });
  editors.push(editor);
  return editor;
}

const html = (e: Editor) => e.getHtml();

afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('AI generation', () => {
  it('inserts sanitized model output and passes the system prompt', async () => {
    const generate = vi.fn<AiGenerate>(async () => '```html\n<h2>Hello</h2><script>alert(1)</script><img src=x onerror=alert(1)>\n```');
    const editor = make(generate);

    await editor.runCommand('aac:ai-generate', { prompt: 'a hero' });

    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0]![0]).toMatchObject({ prompt: 'a hero', mode: 'insert' });
    expect(generate.mock.calls[0]![0].system).toMatch(/HTML fragment/);
    const out = html(editor);
    expect(out).toContain('<h2>Hello</h2>');
    expect(out).not.toMatch(/script|onerror/);
  });

  it('accepts { html } results', async () => {
    const editor = make(async () => ({ html: '<p>from object</p>' }));
    await editor.runCommand('aac:ai-generate', { prompt: 'x' });
    expect(html(editor)).toContain('from object');
  });

  it('inserts after the selected component by default', async () => {
    const editor = make(async () => '<p id="new">new</p>');
    editor.setComponents('<div id="a">a</div><div id="b">b</div>');
    editor.select(editor.getWrapper()!.components().at(0)!);

    await editor.runCommand('aac:ai-generate', { prompt: 'x' });

    const ids = editor.getWrapper()!.components().models.map((c) => c.getId());
    expect(ids).toHaveLength(3);
    expect(editor.getWrapper()!.components().at(1)!.toHTML()).toContain('new');
  });

  it('replaces the selection in replace mode and sends the current HTML', async () => {
    const generate = vi.fn<AiGenerate>(async () => '<p>rewritten</p>');
    const editor = make(generate);
    editor.setComponents('<p>old text</p>');
    editor.select(editor.getWrapper()!.components().at(0)!);

    await editor.runCommand('aac:ai-generate', { prompt: 'rewrite', mode: 'replace' });

    expect(generate.mock.calls[0]![0].currentHtml).toContain('old text');
    expect(html(editor)).toContain('rewritten');
    expect(html(editor)).not.toContain('old text');
  });

  it('can be undone', async () => {
    const editor = make(async () => '<p>added</p>');
    editor.setComponents('<p>base</p>');
    editor.UndoManager.clear();
    await editor.runCommand('aac:ai-generate', { prompt: 'x' });
    expect(html(editor)).toContain('added');
    editor.UndoManager.undo();
    expect(html(editor)).not.toContain('added');
  });

  it('rejects empty prompts, empty output and provider errors without touching the page', async () => {
    const editor = make(async () => '<script>x</script>');
    editor.setComponents('<p>keep</p>');
    await expect(editor.runCommand('aac:ai-generate', { prompt: '   ' }) ?? Promise.reject(new Error('modal'))).rejects.toBeDefined();
    await expect(editor.runCommand('aac:ai-generate', { prompt: 'x' })).rejects.toThrow(/no usable content/);

    const failing = make(async () => {
      throw new Error('boom');
    });
    await expect(failing.runCommand('aac:ai-generate', { prompt: 'x' })).rejects.toThrow('boom');
    expect(html(editor)).toContain('keep');
  });

  it('times out slow providers', async () => {
    const editor = make(() => new Promise(() => {}), { timeoutMs: 20 });
    await expect(editor.runCommand('aac:ai-generate', { prompt: 'x' })).rejects.toThrow(/timed out/);
  });

  it('uses a custom sanitizer when given', async () => {
    const sanitize = vi.fn(() => '<p>custom</p>');
    const editor = make(async () => '<div>raw</div>', { sanitize });
    await editor.runCommand('aac:ai-generate', { prompt: 'x' });
    expect(sanitize).toHaveBeenCalled();
    expect(html(editor)).toContain('custom');
  });

  it('adds a toolbar button to selected components unless disabled', () => {
    const editor = make(async () => '<p/>');
    editor.setComponents('<p>a</p>');
    const cmp = editor.getWrapper()!.components().at(0)!;
    editor.select(cmp);
    const toolbar = cmp.get('toolbar') as Array<{ attributes?: { class?: string } }>;
    expect(toolbar.filter((t) => t.attributes?.class?.includes('aac-ai-toolbar'))).toHaveLength(1);

    editor.select(cmp);
    expect((cmp.get('toolbar') as unknown[]).length).toBe(toolbar.length);

    const off = make(async () => '<p/>', { toolbar: false });
    off.setComponents('<p>a</p>');
    const c2 = off.getWrapper()!.components().at(0)!;
    off.select(c2);
    expect((c2.get('toolbar') as Array<{ attributes?: { class?: string } }>).some((t) => t.attributes?.class?.includes('aac-ai'))).toBe(false);
  });

  it('is absent when no ai option is passed', () => {
    const el = document.createElement('div');
    document.body.append(el);
    const editor = grapesjs.init({ container: el, storageManager: false,
    headless: true, plugins: [(ed) => plugin(ed)] });
    editors.push(editor);
    expect(editor.Commands.has('aac:ai-generate')).toBe(false);
  });
});

describe('createFetchGenerator', () => {
  it('posts to your endpoint and reads { html }', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ html: '<p>ok</p>' }), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const gen = createFetchGenerator('/api/ai', { headers: { Authorization: 'Bearer t' } });
    const out = await gen({ prompt: 'p', system: 's', mode: 'insert' });
    expect(out).toBe('<p>ok</p>');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai');
    expect(JSON.parse(init.body as string)).toMatchObject({ prompt: 'p', system: 's' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');
    vi.unstubAllGlobals();
  });

  it('throws on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 500 })));
    await expect(createFetchGenerator('/x')({ prompt: 'p', system: 's', mode: 'insert' })).rejects.toThrow('500');
    vi.unstubAllGlobals();
  });
});
