import type { Component } from 'grapesjs';
import { describe, expect, it } from 'vitest';
import { assertSelector, descendants, parseSelector, queryAll } from '../src/define/selector';
import { createTestEditor } from '../src/testing';

const tree = (html: string): Component => {
  const editor = createTestEditor();
  editor.setComponents(html);
  return editor.getWrapper()!.components().at(0)!;
};
const classes = (list: Component[]) => list.map((c) => (c.getClasses() as string[]).join('.') || c.get('tagName'));

const HTML = `<section class="root">
  <header class="head"><h2 class="title">T</h2><a class="link" href="/a" data-kind="x">A</a></header>
  <div class="body"><p class="p one">1</p><p class="p two">2</p><div class="inner"><a class="link" href="/b" data-kind="y">B</a></div></div>
</section>`;

describe('parseSelector', () => {
  it.each(['.a', '#a', 'div', 'a.b#c[d]', '[href]', '[data-x=1]', '[data-x="a b"]', "[data-x='q']", '.a .b', '.a > .b', 'ul li', 'div.a  >  p.b  span'])('accepts %s', (sel) => {
    expect(() => assertSelector(sel)).not.toThrow();
  });

  it.each([
    ['', /empty/],
    ['   ', /empty/],
    ['.a, .b', /","/],
    ['a:hover', /":"/],
    ['a + b', /"\+"/],
    ['a ~ b', /"~"/],
    ['*', /"\*"/],
    ['> a', /cannot start/],
    ['[x', /not closed/],
    ['.', /name after/],
    ['#', /name after/],
    ['[a b c]', /attribute selector/],
  ])('rejects %j with a readable message', (sel, why) => {
    expect(() => parseSelector(sel)).toThrow(why);
    expect(() => parseSelector(sel)).toThrow(/Supported: tag/);
  });

  it('parses compounds and combinators', () => {
    const steps = parseSelector('div.a#i[k=v] > p span');
    expect(steps.map((s) => s.combinator)).toEqual(['', '>', ' ']);
    expect(steps[0]!.compound).toMatchObject({ tag: 'div', id: 'i', classes: ['a'], attrs: [{ name: 'k', value: 'v' }] });
  });
});

describe('queryAll', () => {
  it('finds elements by tag, class, id and attribute', () => {
    const root = tree(HTML);
    expect(queryAll(root, 'h2')).toHaveLength(1);
    expect(classes(queryAll(root, '.p'))).toEqual(['p.one', 'p.two']);
    expect(queryAll(root, '[href]')).toHaveLength(2);
    expect(queryAll(root, '[data-kind=y]')).toHaveLength(1);
    expect(queryAll(root, '[data-kind="x"]')).toHaveLength(1);
    expect(queryAll(root, 'a.link[href]')).toHaveLength(2);
    expect(queryAll(root, '.p.two')).toHaveLength(1);
  });

  it('works in headless mode, where GrapesJS find() returns nothing', () => {
    const root = tree(HTML);
    expect(root.find('.title')).toHaveLength(0); // the reason this matcher exists
    expect(queryAll(root, '.title')).toHaveLength(1);
  });

  it('supports descendant and child combinators', () => {
    const root = tree(HTML);
    expect(queryAll(root, '.body .link')).toHaveLength(1);
    expect(queryAll(root, '.body > .link')).toHaveLength(0);
    expect(queryAll(root, '.inner > .link')).toHaveLength(1);
    expect(queryAll(root, '.head .link')).toHaveLength(1);
    expect(queryAll(root, 'section .link')).toHaveLength(2); // the root can anchor a selector
  });

  it('lets the root anchor a selector, but never returns the root', () => {
    const root = tree(HTML);
    expect(queryAll(root, '.root .title')).toHaveLength(1);
    expect(queryAll(root, '.root > .head')).toHaveLength(1);
    expect(queryAll(root, '.root')).toHaveLength(0);
  });

  it('returns matches in document order and skips text nodes', () => {
    const root = tree(HTML);
    expect(classes(queryAll(root, 'a'))).toEqual(['link', 'link']);
    expect(queryAll(root, 'a').map((a) => (a.getAttributes() as Record<string, string>).href)).toEqual(['/a', '/b']);
    expect(descendants(root).every((c) => c.get('type') !== 'textnode')).toBe(true);
  });

  it('returns an empty list when nothing matches', () => {
    expect(queryAll(tree(HTML), '.missing')).toEqual([]);
  });

  it('matches an id attribute', () => {
    const root = tree('<div class="r"><span id="a">x</span><span id="b">y</span></div>');
    expect(queryAll(root, '#b')).toHaveLength(1);
  });
});
