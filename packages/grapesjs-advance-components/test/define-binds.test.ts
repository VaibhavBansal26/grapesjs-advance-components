import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/define';
import { queryAll } from '../src/define/selector';
import { createTestEditor, mountComponent, testRoundTrip } from '../src/testing';

const card = defineComponent({
  id: 'bind-card',
  label: 'Card',
  html: `<div class="bc"><h3 class="bc-title">Title</h3><a class="bc-link" href="#">Go</a><div class="bc-bar"></div></div>`,
  traits: {
    title: { type: 'text', default: 'Title', bind: { text: '.bc-title' } },
    href: { type: 'text', default: '#', bind: { attr: 'href', on: '.bc-link' } },
    layout: { type: 'select', options: ['plain', 'card', 'wide'], default: 'plain', bind: { class: { card: 'is-card', wide: 'is-wide is-big' } } },
    featured: { type: 'checkbox', default: false, bind: { classIf: 'is-featured' } },
    percent: { type: 'number', min: 0, max: 100, default: 50, bind: [{ style: 'width', unit: '%', on: '.bc-bar' }, { attr: 'aria-valuenow', on: '.bc-bar' }] },
    tint: { type: 'color', bind: { cssVar: '--tint' } },
    note: { type: 'text', default: 'hello' },
    count: { type: 'number', min: 1, max: 10, default: 3 },
    agree: { type: 'checkbox', default: true },
  },
});

const bar = (m: ReturnType<typeof mountComponent>) => queryAll(m.component, '.bc-bar')[0]!;

describe('defaults', () => {
  it('reads defaults from the markup, or writes them into it', () => {
    const m = mountComponent(card);
    expect(m.get('title')).toBe('Title'); // from the markup
    expect(m.get('href')).toBe('#');
    expect(m.get('layout')).toBe('plain'); // no class means the default
    expect(m.get('featured')).toBe(false);
    expect(m.get('percent')).toBe(50); // not in the markup, so the default is written
    expect(m.get('tint')).toBeUndefined();
    expect(m.get('note')).toBe('hello');
    expect(m.get('count')).toBe(3);
    expect(m.get('agree')).toBe(true);
    expect(m.html()).toContain('data-note="hello"');
    expect(m.html()).toContain('data-count="3"');
    expect(m.html()).toContain('data-agree="true"');
    expect(m.html()).toContain('aria-valuenow="50"');
    expect(m.css()).toMatch(/width:50%/);
  });

  it('lets the markup win over the default when it carries a value', () => {
    const editor = createTestEditor();
    card.installType(editor);
    editor.setComponents('<div class="bc is-card"><h3 class="bc-title">Different</h3><a class="bc-link" href="/x">Go</a><div class="bc-bar"></div></div>');
    const root = editor.getWrapper()!.components().at(0)!;
    expect(card.get(root, 'title')).toBe('Different');
    expect(card.get(root, 'href')).toBe('/x');
    expect(card.get(root, 'layout')).toBe('card');
  });

  it('fills in an attribute that is missing from saved HTML', () => {
    const editor = createTestEditor();
    card.installType(editor);
    editor.setComponents('<div class="bc"><h3 class="bc-title">T</h3><a class="bc-link" href="#">Go</a><div class="bc-bar"></div></div>');
    expect(editor.getHtml()).toContain('data-note="hello"');
  });
});

describe('text binds', () => {
  it('writes escaped text, never markup', () => {
    const m = mountComponent(card);
    m.set('title', '<img src=x onerror=alert(1)> & co');
    expect(m.html()).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; co');
    expect(m.html()).not.toContain('<img');
    expect(m.get('title')).toBe('<img src=x onerror=alert(1)> & co');
  });

  it('clears the text when set to empty', () => {
    const m = mountComponent(card);
    m.set('title', '');
    expect(queryAll(m.component, '.bc-title')[0]!.components().length).toBe(0);
  });
});

describe('attr binds on a child', () => {
  it('writes the attribute, and removes it when emptied', () => {
    const m = mountComponent(card);
    m.set('href', '/pricing');
    expect(m.html()).toContain('href="/pricing"');
    m.set('href', '');
    expect(m.html()).not.toContain('href=');
  });
});

describe('class binds', () => {
  const classes = (m: ReturnType<typeof mountComponent>) => m.component.getClasses() as string[];

  it('switches the mapped class, supporting several classes per option', () => {
    const m = mountComponent(card);
    m.set('layout', 'wide');
    expect(classes(m)).toEqual(expect.arrayContaining(['bc', 'is-wide', 'is-big']));
    expect(classes(m)).not.toContain('is-card');
    m.set('layout', 'card');
    expect(classes(m)).toEqual(['bc', 'is-card']);
    m.set('layout', 'plain');
    expect(classes(m)).toEqual(['bc']);
    expect(m.get('layout')).toBe('plain');
  });

  it('toggles a class from a checkbox', () => {
    const m = mountComponent(card);
    m.set('featured', true);
    expect(classes(m)).toContain('is-featured');
    expect(m.get('featured')).toBe(true);
    m.set('featured', false);
    expect(classes(m)).not.toContain('is-featured');
  });
});

describe('style and cssVar binds', () => {
  it('writes a style with its unit, and mirrors it into an aria attribute', () => {
    const m = mountComponent(card);
    m.set('percent', 72);
    expect(m.css()).toMatch(/width:72%/);
    expect(m.html()).toContain('aria-valuenow="72"');
    expect(m.get('percent')).toBe(72);
  });

  it('clamps numbers to min and max', () => {
    const m = mountComponent(card);
    m.set('percent', 250);
    expect(m.get('percent')).toBe(100);
    expect(m.css()).toMatch(/width:100%/);
    m.set('percent', -5);
    expect(m.get('percent')).toBe(0);
    expect(m.css()).toMatch(/width:0%/);
  });

  it('removes the style when the value is cleared, and a cleared number falls back to its default', () => {
    const m = mountComponent(card);
    m.set('percent', '');
    expect(bar(m).getStyle()).toEqual({});
    expect(m.html()).not.toContain('aria-valuenow');
    expect(m.get('percent')).toBe(50);
  });

  it('writes a custom property on the root, and removes it', () => {
    const m = mountComponent(card);
    m.set('tint', '#0d9488');
    expect(m.css()).toMatch(/--tint:#0d9488/);
    expect(m.get('tint')).toBe('#0d9488');
    m.set('tint', '');
    expect(m.css()).not.toMatch(/--tint/);
  });

  it('clamps a value typed in the trait panel (a string) as well', () => {
    const m = mountComponent(card);
    m.component.set('aac_percent', '250' as never);
    expect(m.get('percent')).toBe(100);
    expect(m.css()).toMatch(/width:100%/);
  });
});

describe('plain attribute traits (the default storage)', () => {
  it('stores typed values as data attributes', () => {
    const m = mountComponent(card);
    m.set('note', 'bye');
    m.set('count', 7);
    m.set('agree', false);
    expect(m.html()).toContain('data-note="bye"');
    expect(m.html()).toContain('data-count="7"');
    expect(m.html()).toContain('data-agree="false"');
    expect([m.get('note'), m.get('count'), m.get('agree')]).toEqual(['bye', 7, false]);
  });

  it('clamps numbers and falls back to the default for garbage', () => {
    const m = mountComponent(card);
    m.set('count', 99);
    expect(m.html()).toContain('data-count="10"');
    m.set('count', 0);
    expect(m.html()).toContain('data-count="1"');
    m.set('count', 'abc');
    expect(m.get('count')).toBe(3);
  });

  it('shows up in the trait panel as a GrapesJS attribute trait', () => {
    const m = mountComponent(card);
    const names = m.component.getTraits().map((t) => t.get('name'));
    expect(names).toEqual(expect.arrayContaining(['data-note', 'data-count', 'data-agree']));
    m.component.getTrait('data-count')!.setValue('8' as never);
    expect(card.get(m.component, 'count')).toBe(8);
  });
});

describe('round trips', () => {
  it('survive HTML + CSS export and project JSON with every trait changed', () => {
    const { html, css } = testRoundTrip(card, { title: 'Hi there', href: '/x', layout: 'wide', featured: true, percent: 80, tint: '#123456', note: 'n', count: 7, agree: false });
    expect(html).toContain('Hi there');
    expect(css).toMatch(/--tint:#123456/);
  });

  it('survive with defaults only', () => {
    expect(() => testRoundTrip(card)).not.toThrow();
  });

  it('survive awkward values', () => {
    expect(() => testRoundTrip(card, { title: 'a <b> & "c"', note: "it's \"quoted\" & <tagged>" })).not.toThrow();
  });
});

describe('block values', () => {
  it('give the dropped component its own starting values, for plain and bound traits', () => {
    const editor = createTestEditor();
    card.installType(editor);
    card.installBlock(editor, { values: { note: 'from block', title: 'Block title', percent: 25 } });
    const [c] = editor.addComponents(editor.Blocks.get('bind-card-block')!.getContent() as never);
    expect(card.get(c!, 'note')).toBe('from block');
    expect(card.get(c!, 'title')).toBe('Block title');
    expect(card.get(c!, 'percent')).toBe(25);
    expect(editor.getHtml()).toContain('data-note="from block"');
    expect(editor.getHtml()).toContain('Block title');
    expect(editor.getHtml()).toContain('class="bc"'); // the root attributes survive the override
  });
});
