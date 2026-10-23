import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { defineComponent } from '../src';
import { createTestEditor, mountComponent } from '../src/testing';

afterEach(() => vi.restoreAllMocks());

const base = { id: 'in-thing', label: 'Thing', html: '<div class="inthing" role="note"><span class="t">x</span></div>' };
const def = (extra: Record<string, unknown> = {}) => defineComponent({ ...base, ...extra } as never);
const blockOf = (editor: ReturnType<typeof createTestEditor>, id = 'in-thing-block') => editor.Blocks.get(id)!;

describe('the block', () => {
  it('is registered with a default id, the label, the category and an icon', () => {
    const editor = createTestEditor();
    def({ category: 'Mine' }).install(editor);
    const block = blockOf(editor);
    expect(block.getLabel()).toContain('<svg');
    expect(block.getLabel()).toContain('Thing</div>');
    expect(block.getCategoryLabel()).toBe('Mine');
    expect(block.getContent()).toEqual({ type: 'in-thing' });
  });

  it('can be named, labelled and categorised by the spec, then overridden at install', () => {
    const editor = createTestEditor();
    const d = def({ block: { id: 'custom-id', label: 'Pretty', category: 'A' } });
    d.installType(editor);
    d.installBlock(editor, { label: 'Override', category: 'B' });
    expect(blockOf(editor, 'custom-id').getLabel()).toContain('Override');
    expect(blockOf(editor, 'custom-id').getCategoryLabel()).toBe('B');
    expect(editor.Blocks.get('in-thing-block')).toBeUndefined();
  });

  it('is skipped with block: false, while the type still works', () => {
    const editor = createTestEditor();
    const d = def({ block: false });
    d.install(editor);
    expect(editor.Blocks.getAll().length).toBe(0);
    expect(mountComponent(d, { editor }).component.get('type')).toBe('in-thing');
  });

  it('is only added once', () => {
    const editor = createTestEditor();
    const d = def();
    d.installType(editor);
    d.installBlock(editor);
    d.installBlock(editor);
    expect(editor.Blocks.getAll().length).toBe(1);
  });

  it('shows an SVG icon as is, an emoji as escaped text, and escapes the label', () => {
    const editor = createTestEditor();
    const svg = '<svg viewBox="0 0 1 1" data-mine="1"></svg>';
    def({ icon: svg, label: '<script>alert(1)</script>' }).install(editor);
    expect(blockOf(editor).getLabel()).toContain('data-mine="1"');
    expect(blockOf(editor).getLabel()).toContain('&lt;script&gt;');
    expect(blockOf(editor).getLabel()).not.toContain('<script>');

    const e2 = createTestEditor();
    def({ icon: '★' }).install(e2);
    expect(blockOf(e2).getLabel()).toMatch(/<span[^>]*>★<\/span>/);
  });

  it('creates a working component when dropped', () => {
    const editor = createTestEditor();
    const d = def({ traits: { note: { type: 'text', default: 'hi' } } });
    d.install(editor);
    const [c] = editor.addComponents(blockOf(editor).getContent() as never);
    expect(c!.get('type')).toBe('in-thing');
    expect(d.get(c!, 'note' as never)).toBe('hi');
  });
});

describe('the type', () => {
  it('takes its tag and attributes from the root element of html, and its children from the rest', () => {
    const editor = createTestEditor();
    def({ html: '<section class="inthing" role="region" aria-label="x"><span class="t">kid</span></section>' }).installType(editor);
    const [c] = editor.addComponents({ type: 'in-thing' });
    expect(c!.get('tagName')).toBe('section');
    expect(c!.getAttributes()).toMatchObject({ role: 'region', 'aria-label': 'x', class: 'inthing' });
    expect(editor.getHtml()).toMatch(/<section[^>]*class="inthing"[\s\S]*<span class="t">kid<\/span>/);
  });

  it('names the component in the layer manager after its label', () => {
    expect(mountComponent(def()).component.get('name')).toBe('Thing');
  });

  it('is recognised again from saved HTML by the root class, a selector or a function', () => {
    const byClass = def();
    const bySelector = def({ id: 'in-attr', html: '<div data-kind="widget" class="x"></div>', detect: '[data-kind=widget]' });
    const byFunction = def({ id: 'in-fn', html: '<div class="y" data-z="1"></div>', detect: (el: Element) => el.hasAttribute('data-z') });
    const editor = createTestEditor();
    for (const d of [byClass, bySelector, byFunction]) d.installType(editor);
    editor.setComponents('<div class="inthing"></div><div data-kind="widget" class="x"></div><div class="y" data-z="1"></div><div class="plain"></div>');
    const types = editor.getWrapper()!.components().map((c: { get(key: string): unknown }) => c.get('type'));
    expect(types.slice(0, 3)).toEqual(['in-thing', 'in-attr', 'in-fn']);
    expect(['in-thing', 'in-attr', 'in-fn']).not.toContain(types[3]); // the plain div is left alone
  });

  it('can extend a GrapesJS type, so the root itself is editable text', () => {
    const d = def({ id: 'in-text', html: '<button class="intxt">Buy now</button>', extend: 'text' });
    expect(mountComponent(d).component.get('editable')).toBe(true);
  });

  it('shows traits in the panel with labels, options, ranges and placeholders', () => {
    const d = def({
      traits: {
        priceId: { type: 'text', placeholder: 'price_…' },
        mode: { type: 'select', label: 'Mode', options: ['a', { value: 'b', label: 'Bee' }] },
        qty: { type: 'number', min: 1, max: 9, step: 2 },
        agree: { type: 'checkbox' },
        hidden: { type: 'text', ui: false },
        colour: { type: 'color', bind: { cssVar: '--c' } },
      },
    });
    const { component } = mountComponent(d);
    const traits = component.getTraits();
    expect(traits.map((t) => t.get('name'))).toEqual(['data-price-id', 'data-mode', 'data-qty', 'data-agree', 'aac_colour']);
    const byName = (n: string) => traits.find((t) => t.get('name') === n)!;
    expect(byName('data-price-id').get('label')).toBe('Price Id');
    expect(byName('data-price-id').get('placeholder')).toBe('price_…');
    expect(byName('data-mode').get('label')).toBe('Mode');
    expect(byName('data-mode').get('options')).toEqual([{ id: 'a', label: 'a' }, { id: 'b', label: 'Bee' }]);
    expect([byName('data-qty').get('min'), byName('data-qty').get('max'), byName('data-qty').get('step')]).toEqual([1, 9, 2]);
    expect(byName('data-agree').get('valueTrue')).toBe('true');
    expect(byName('aac_colour').get('changeProp')).toBe(true);
    expect(byName('data-qty').get('changeProp')).toBeFalsy();
    expect(d.get(component, 'hidden' as never)).toBeUndefined(); // stored, just not shown
  });

  it('does not collide with GrapesJS properties when a trait is called name or content', () => {
    const d = def({ traits: { name: { type: 'text', default: 'n', bind: { text: '.t' } }, content: { type: 'text', default: 'c', bind: { attr: 'title', on: '.t' } } } });
    const m = mountComponent(d);
    m.set('name' as never, 'Ada');
    m.set('content' as never, 'Bio');
    expect(m.component.get('name')).toBe('Thing'); // GrapesJS's own property is untouched
    expect(m.component.get('content')).toBeFalsy();
    expect(m.html()).toContain('Ada');
    expect(m.html()).toContain('title="Bio"');
  });
});

describe('css', () => {
  it('is registered once the component is installed, and exported only for pages that use it', () => {
    const editor = createTestEditor();
    const d = def({ css: '.inthing{margin:24px 0}' });
    d.install(editor);
    expect(editor.Css.getRule('.inthing')).toBeTruthy();
    expect(editor.getCss()).not.toMatch(/\.inthing/); // no component on the page, so GrapesJS leaves the rule out
    editor.addComponents({ type: 'in-thing' });
    expect(editor.getCss()).toMatch(/\.inthing\{margin(-top)?:24px/); // jsdom keeps the shorthand, a browser expands it
  });

  it('warns about shorthand var() but still installs it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = createTestEditor();
    def({ css: '.inthing{background:var(--x)}' }).install(editor);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('in-thing'));
    expect(warn.mock.calls[0]![0]).toMatch(/background.*longhand/);
  });

  it('warns when two components declare the same selector', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = createTestEditor();
    def({ css: '.shared{color:red}' }).install(editor);
    def({ id: 'in-other', html: '<div class="other"></div>', css: '.shared{color:blue}' }).install(editor);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/\.shared is also declared by "in-thing"/));
  });

  it('is not added twice when the same definition is installed twice', () => {
    const editor = createTestEditor();
    const d = def({ css: '.inthing{margin:1px}' });
    d.install(editor);
    const before = editor.Css.getAll().length;
    d.install(editor);
    expect(editor.Css.getAll().length).toBe(before);
  });
});

describe('the plugin option', () => {
  it('installs every definition in custom, with its block', () => {
    const one = def();
    const two = def({ id: 'in-two', html: '<div class="intwo"></div>' });
    const editor = createTestEditor((ed) => plugin(ed, { custom: [one, two] }));
    expect(editor.Blocks.get('in-thing-block')).toBeTruthy();
    expect(editor.Blocks.get('in-two-block')).toBeTruthy();
    expect(editor.Components.getType('in-two')).toBeTruthy();
  });

  it('leaves the built-in blocks alone', () => {
    const editor = createTestEditor((ed) => plugin(ed, { custom: [def()] }));
    expect(editor.Blocks.get('faq-block')).toBeTruthy();
    expect(editor.Blocks.get('hero-block')).toBeTruthy();
  });

  it('works from your own plugin function too', () => {
    const d = def();
    const editor = createTestEditor((ed) => d.install(ed));
    expect(editor.Blocks.get('in-thing-block')).toBeTruthy();
  });
});
