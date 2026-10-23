import { describe, expect, it, vi } from 'vitest';
import { DefineComponentError, defineComponent, type ComponentSpec, type TraitMap } from '../src/define';
import { createTestEditor } from '../src/testing';

const base = { id: 'thing', label: 'Thing', html: '<div class="thing"><span class="t">x</span></div>' } as const;
const make = (extra: Record<string, unknown> = {}, traits?: TraitMap) => defineComponent({ ...base, ...extra, ...(traits ? { traits } : {}) } as ComponentSpec);
const trait = (t: Record<string, unknown>) => ({ x: { type: 'text', ...t } }) as unknown as TraitMap;

describe('defineComponent: spec validation (no DOM needed)', () => {
  it('accepts a minimal spec and exposes its id and spec', () => {
    const def = make();
    expect(def.id).toBe('thing');
    expect(def.spec.label).toBe('Thing');
    expect(def.scriptSource).toBeUndefined();
  });

  it('names the component in every error', () => {
    expect(() => make({ label: '' })).toThrow(DefineComponentError);
    expect(() => make({ label: '' })).toThrow(/^defineComponent\("thing"\): /);
  });

  it.each(['Thing', '1thing', 'my_thing', 'my thing', '', 'thing!'])('rejects id %j', (id) => {
    expect(() => make({ id })).toThrow(/id must be kebab-case/);
  });

  it('requires a label and html with a root element', () => {
    expect(() => make({ label: ' ' })).toThrow(/label is required/);
    expect(() => make({ html: '' })).toThrow(/html is required/);
    expect(() => make({ html: 'just text' })).toThrow(/must start with the root element/);
  });

  it('needs a class on the root, or an explicit detect', () => {
    expect(() => make({ html: '<div><span/></div>' })).toThrow(/needs a class/);
    expect(() => make({ html: '<div data-x="1"></div>', detect: '[data-x]' })).not.toThrow();
    expect(() => make({ html: '<div></div>', detect: () => true })).not.toThrow();
  });

  it('rejects a detect it cannot use', () => {
    expect(() => make({ detect: 'a, b' })).toThrow(/detect: Unsupported selector/);
    expect(() => make({ detect: 42 })).toThrow(/detect must be a selector string or a function/);
  });

  it('checks the extend, css, block, editable and repeat fields', () => {
    expect(() => make({ extend: 3 })).toThrow(/extend must be/);
    expect(() => make({ css: 3 })).toThrow(/css must be a string/);
    expect(() => make({ block: true })).toThrow(/block must be false or an object/);
    expect(() => make({ editable: '.a' })).toThrow(/editable must be a list/);
    expect(() => make({ editable: ['a:hover'] })).toThrow(/editable: Unsupported selector/);
    expect(() => make({ repeat: ['.a', 'b, c'] })).toThrow(/repeat: Unsupported selector/);
  });
});

describe('defineComponent: trait validation', () => {
  it.each(['Name', '1x', 'my-trait', 'my_trait', 'my trait'])('rejects trait name %j', (name) => {
    expect(() => make({}, { [name]: { type: 'text' } })).toThrow(/trait .*camelCase/);
  });

  it('accepts camelCase names', () => {
    expect(() => make({}, { priceId: { type: 'text' }, a1: { type: 'text' } })).not.toThrow();
  });

  it('rejects an unknown type', () => {
    expect(() => make({}, trait({ type: 'textarea' }))).toThrow(/type must be one of text, number, select, checkbox, color/);
  });

  it('validates select options and defaults', () => {
    expect(() => make({}, trait({ type: 'select' }))).toThrow(/a select needs options/);
    expect(() => make({}, trait({ type: 'select', options: [] }))).toThrow(/a select needs options/);
    expect(() => make({}, trait({ type: 'select', options: ['a', 'b'], default: 'c' }))).toThrow(/not one of the options/);
    expect(() => make({}, trait({ type: 'select', options: ['a', { value: 'b', label: 'B' }], default: 'b' }))).not.toThrow();
  });

  it('validates number, checkbox, text and color defaults', () => {
    expect(() => make({}, trait({ type: 'number', min: 5, max: 1 }))).toThrow(/min is greater than max/);
    expect(() => make({}, trait({ type: 'number', default: '3' }))).toThrow(/number default/);
    expect(() => make({}, trait({ type: 'checkbox', default: 'yes' }))).toThrow(/boolean default/);
    expect(() => make({}, trait({ type: 'text', default: 3 }))).toThrow(/string default/);
    expect(() => make({}, trait({ type: 'color', default: 3 }))).toThrow(/string default/);
  });

  it('rejects two traits on the same attribute', () => {
    expect(() => make({}, { a: { type: 'text', bind: { attr: 'data-k' } }, b: { type: 'text', bind: { attr: 'data-k' } } })).toThrow(/already used by another trait/);
  });
});

describe('defineComponent: bind validation', () => {
  const b = (bind: unknown, extra: Record<string, unknown> = {}) => make({}, { x: { type: 'text', bind, ...extra } as never });

  it('needs exactly one bind kind', () => {
    expect(() => b({})).toThrow(/exactly one of attr, text, style, cssVar, class or classIf \(got none\)/);
    expect(() => b({ attr: 'a', text: '.t' })).toThrow(/got attr, text/);
    expect(() => b([])).toThrow(/bind is an empty list/);
  });

  it('checks attribute names and points class and style at their own binds', () => {
    expect(() => b({ attr: 'bad name' })).toThrow(/not a valid attribute name/);
    expect(() => b({ attr: 'class' })).toThrow(/bind a class with \{ class/);
    expect(() => b({ attr: 'style' })).toThrow(/bind a style with \{ style/);
  });

  it('requires custom properties to start with --', () => {
    expect(() => b({ cssVar: 'accent' })).toThrow(/must start with "--"/);
    expect(() => b({ cssVar: '--accent' })).not.toThrow();
  });

  it('only allows a class map on a select and classIf on a checkbox', () => {
    expect(() => b({ class: { a: 'x' } })).toThrow(/only works with a select/);
    expect(() => b({ classIf: 'x' })).toThrow(/only works with a checkbox/);
    expect(() => b({ class: { z: 'x' } }, { type: 'select', options: ['a', 'b'] })).toThrow(/class map key "z" is not one of the options/);
    expect(() => b({ class: { a: 'x' } }, { type: 'select', options: ['a', 'b'] })).not.toThrow();
    expect(() => b({ classIf: 'x' }, { type: 'checkbox' })).not.toThrow();
  });

  it('rejects selectors outside the supported subset', () => {
    expect(() => b({ text: 'a:hover' })).toThrow(/Unsupported selector/);
    expect(() => b({ attr: 'title', on: 'a, b' })).toThrow(/Unsupported selector/);
  });

  it('accepts every valid kind, alone or in a list', () => {
    expect(() => b({ attr: 'title', on: '.t' })).not.toThrow();
    expect(() => b({ text: '.t' })).not.toThrow();
    expect(() => b({ style: 'width', unit: '%', on: '.t' }, { type: 'number' })).not.toThrow();
    expect(() => b([{ style: 'width', unit: '%' }, { attr: 'aria-valuenow' }], { type: 'number' })).not.toThrow();
  });
});

describe('defineComponent: script validation', () => {
  it('requires script to be a function', () => {
    expect(() => make({ script: 'alert(1)' })).toThrow(/script must be a function/);
  });

  it('rejects consts that JSON would change', () => {
    const withConsts = (consts: unknown) => make({ script() {}, consts });
    expect(() => withConsts({ fn: () => 1 })).toThrow(/consts\.fn is not JSON-serialisable \(function\)/);
    expect(() => withConsts({ u: undefined })).toThrow(/consts\.u is not JSON-serialisable/);
    expect(() => withConsts({ n: NaN })).toThrow(/consts\.n is not JSON-serialisable/);
    expect(() => withConsts({ d: new Date() })).toThrow(/consts\.d must be plain data/);
    expect(() => withConsts({ list: ['a', 1, true, null], nested: { ok: 1 } })).not.toThrow();
  });
});

describe('defineComponent: install-time validation (needs a DOM)', () => {
  const install = (extra: Record<string, unknown> = {}, traits?: TraitMap) => make(extra, traits).installType(createTestEditor());

  it('wants exactly one root element', () => {
    expect(() => install({ html: '<div class="thing">a</div><div class="thing">b</div>' })).toThrow(/exactly one root element \(found 2 top-level nodes\)/);
    expect(() => install({ html: '<div class="thing">a</div>  \n' })).not.toThrow();
  });

  it('rejects an inline style on the root', () => {
    expect(() => install({ html: '<div class="thing" style="color:red"></div>' })).toThrow(/put styles for the root in css/);
  });

  it('checks that detect matches the root, and that selectors match something', () => {
    expect(() => install({ detect: '.other' })).toThrow(/detect ".other" does not match the root element/);
    expect(() => install({ editable: ['.nope'] })).toThrow(/editable selector ".nope" matches nothing in html/);
    expect(() => install({ repeat: ['.nope'] })).toThrow(/repeat selector ".nope" matches nothing in html/);
    expect(() => install({}, { x: { type: 'text', bind: { text: '.nope' } } })).toThrow(/trait "x" bind target ".nope" matches nothing in html/);
    expect(() => install({}, { x: { type: 'text', bind: { attr: 'title', on: '.nope' } } })).toThrow(/bind target ".nope" matches nothing/);
  });

  it('refuses an id that is already a GrapesJS type', () => {
    expect(() => install({ id: 'text' })).toThrow(/already a GrapesJS component type/);
    expect(() => install({ id: 'image' })).toThrow(/Choose another id, for example "acme-image"/);
  });

  it('allows installing the same definition twice, but not two different ones with one id', () => {
    const editor = createTestEditor();
    const def = make();
    def.installType(editor);
    expect(() => def.installType(editor)).not.toThrow();
    expect(() => make().installType(editor)).toThrow(/already installed with a different definition/);
  });

  it('warns about CSS that GrapesJS would mangle, and still installs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    install({ css: '.thing{background:var(--x)}' });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/CSS problems[\s\S]*longhand/));
    warn.mockRestore();
  });

  it('rejects unknown traits in block values and in get and set', () => {
    const editor = createTestEditor();
    const def = make({}, { x: { type: 'text' } });
    expect(() => def.installBlock(editor, { values: { nope: 1 } })).toThrow(/unknown trait "nope" \(traits: x\)/);
    def.installType(editor);
    const [c] = editor.addComponents({ type: 'thing' });
    expect(() => def.get(c!, 'nope' as never)).toThrow(/unknown trait "nope"/);
    expect(() => def.set(c!, 'nope' as never, 1)).toThrow(/unknown trait "nope"/);
  });
});
