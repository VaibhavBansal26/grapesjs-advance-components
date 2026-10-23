import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, exportSiteFiles } from '../src';
import { createTestEditor, mountComponent, runScript, verifyScript } from '../src/testing';

afterEach(() => {
  document.body.innerHTML = '';
});

const result = (el: HTMLElement) => JSON.parse(el.getAttribute('data-result') ?? 'null');

const widget = defineComponent({
  id: 'rt-widget',
  label: 'Widget',
  html: `<div class="rtw"><span class="rtw-name">Ada</span></div>`,
  traits: {
    mode: { type: 'select', options: ['a', 'b'], default: 'a' },
    qty: { type: 'number', default: 1, min: 1 },
    on: { type: 'checkbox', default: false },
    label: { type: 'text', default: 'hi', bind: { text: '.rtw-name' } },
    tone: { type: 'select', options: ['calm', 'loud'], default: 'calm', bind: { class: { loud: 'is-loud' } } },
    pinned: { type: 'checkbox', bind: { classIf: 'is-pinned' } },
    tint: { type: 'color', bind: { cssVar: '--tint' } },
  },
  consts: { allowed: ['a.example'], note: '</script><b>x</b>', n: 2 },
  script({ el, props, consts, inEditor }) {
    el.setAttribute('data-result', JSON.stringify({ props, consts, inEditor }));
  },
});

describe('script props', () => {
  it('are read from the markup and converted to their types', () => {
    const m = mountComponent(widget, { values: { mode: 'b', qty: 5, on: true, label: 'Grace', tone: 'loud', pinned: true } });
    const el = m.el();
    runScript(widget, el);
    expect(result(el).props).toEqual({ mode: 'b', qty: 5, on: true, label: 'Grace', tone: 'loud', pinned: true });
    expect(typeof result(el).props.qty).toBe('number');
    expect(typeof result(el).props.on).toBe('boolean');
  });

  it('fall back to defaults when the markup has no value', () => {
    const editor = createTestEditor();
    widget.installType(editor);
    editor.setComponents('<div class="rtw"><span class="rtw-name"></span></div>');
    const holder = document.createElement('div');
    holder.innerHTML = '<div class="rtw"></div>'; // a bare element, like hand-written HTML
    document.body.append(holder);
    const el = holder.firstElementChild as HTMLElement;
    runScript(widget, el);
    expect(result(el).props).toMatchObject({ mode: 'a', qty: 1, on: false, tone: 'calm' });
  });

  it('read numbers and booleans from raw attributes, ignoring garbage', () => {
    const holder = document.createElement('div');
    holder.innerHTML = '<div class="rtw" data-qty="abc" data-on="nope" data-mode="b"></div>';
    document.body.append(holder);
    const el = holder.firstElementChild as HTMLElement;
    runScript(widget, el);
    expect(result(el).props).toMatchObject({ qty: 1, on: false, mode: 'b' });
  });

  it('leave out style and custom-property traits, which a published page cannot read back', () => {
    const el = mountComponent(widget, { values: { tint: '#0d9488' } }).el();
    runScript(widget, el);
    expect('tint' in result(el).props).toBe(false);
  });
});

describe('consts', () => {
  it('are embedded in the script and available as ctx.consts', () => {
    const el = mountComponent(widget).el();
    runScript(widget, el);
    expect(result(el).consts).toEqual({ allowed: ['a.example'], note: '</script><b>x</b>', n: 2 });
  });

  it('cannot break out of an inline <script>', () => {
    expect(widget.scriptSource).not.toMatch(/<\/script/i);
    expect(widget.scriptSource).toContain('\\u003c/script>');
  });
});

describe('the editor canvas', () => {
  it('does not run the script by default', () => {
    const el = mountComponent(widget).el();
    runScript(widget, el, { inEditor: true });
    expect(el.hasAttribute('data-result')).toBe(false);
  });

  it('runs it with ctx.inEditor set when runInEditor is true', () => {
    const live = defineComponent({
      id: 'rt-live',
      label: 'Live',
      html: '<div class="rtl"></div>',
      runInEditor: true,
      script({ el, inEditor }) {
        el.setAttribute('data-result', JSON.stringify({ inEditor }));
      },
    });
    const outside = mountComponent(live).el();
    runScript(live, outside);
    expect(result(outside)).toEqual({ inEditor: false });
    const inside = mountComponent(live).el();
    runScript(live, inside, { inEditor: true });
    expect(result(inside)).toEqual({ inEditor: true });
  });
});

describe('ctx.emit', () => {
  const emitter = defineComponent({
    id: 'rt-emit',
    label: 'Emit',
    html: '<div class="rte"></div>',
    script({ el, emit }) {
      const plain = emit('rte:plain', { n: 1 });
      const cancelable = emit('rte:cancel', { n: 2 }, true);
      el.setAttribute('data-result', JSON.stringify({ plain, cancelable }));
    },
  });

  it('dispatches bubbling events with a detail, and reports preventDefault only for cancelable ones', () => {
    const el = mountComponent(emitter).el();
    const seen: string[] = [];
    document.body.addEventListener('rte:plain', (e) => (e.preventDefault(), seen.push(`plain:${(e as CustomEvent).detail.n}`)));
    document.body.addEventListener('rte:cancel', (e) => (e.preventDefault(), seen.push(`cancel:${(e as CustomEvent).detail.n}`)));
    runScript(emitter, el);
    expect(seen).toEqual(['plain:1', 'cancel:2']); // bubbled to the body
    expect(result(el)).toEqual({ plain: true, cancelable: false });
  });
});

describe('script source forms', () => {
  const run = (script: never) => {
    const def = defineComponent({ id: 'rt-form', label: 'F', html: '<div class="rtf"></div>', script });
    verifyScript(def);
    const el = mountComponent(def).el();
    runScript(def, el);
    return el.getAttribute('data-ok');
  };

  it('accepts a method, an arrow, a function expression and an async function', () => {
    expect(run({ script({ el }: { el: HTMLElement }) { el.setAttribute('data-ok', 'method'); } }.script as never)).toBe('method');
    expect(run((({ el }: { el: HTMLElement }) => el.setAttribute('data-ok', 'arrow')) as never)).toBe('arrow');
    expect(run(function ({ el }: { el: HTMLElement }) { el.setAttribute('data-ok', 'function'); } as never)).toBe('function');
    expect(run((async ({ el }: { el: HTMLElement }) => { el.setAttribute('data-ok', 'async'); }) as never)).toBe('async');
  });
});

describe('verifyScript', () => {
  it('passes a self-contained script', () => {
    expect(() => verifyScript(widget)).not.toThrow();
  });

  it('catches a variable captured from outside the function', () => {
    const outside = 'captured';
    const leaky = defineComponent({
      id: 'rt-leaky',
      label: 'L',
      html: '<div class="rtk"></div>',
      script({ el }) {
        el.setAttribute('data-x', outside);
      },
    });
    expect(() => verifyScript(leaky)).toThrow(/does not exist on a published page \(outside is not defined\)/);
    expect(() => verifyScript(leaky)).toThrow(/Pass shared values through "consts"/);
  });

  it('rejects a component that has no script', () => {
    expect(() => verifyScript(defineComponent({ id: 'rt-none', label: 'N', html: '<div class="rtn"></div>' }))).toThrow(/has no script/);
  });
});

describe('the published page', () => {
  it('runs the script GrapesJS exports, with props read from the markup', () => {
    const editor = createTestEditor();
    widget.installType(editor);
    const [c] = editor.addComponents({ type: 'rt-widget' });
    widget.set(c!, 'qty', 4);
    widget.set(c!, 'label', 'Hopper');
    const holder = document.createElement('div');
    holder.innerHTML = c!.toHTML();
    document.body.append(holder);
    const js = editor.getJs();
    expect(js).toContain('aacRead');
    new Function(js)();
    const el = holder.firstElementChild as HTMLElement;
    expect(result(el).props).toMatchObject({ qty: 4, label: 'Hopper', mode: 'a' });
  });

  it('is written to the external script file of an exported page, with no inline code', () => {
    const editor = createTestEditor();
    widget.installType(editor);
    editor.Pages.getAll()[0]!.getMainComponent().append({ type: 'rt-widget' });
    const files = exportSiteFiles(editor, { assets: 'external' });
    expect(files['index.js']).toContain('aacRead');
    expect(files['index.html']).toContain('<script src="index.js" defer></script>');
    expect(files['index.html']).not.toMatch(/<script>/);
  });
});
