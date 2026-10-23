import { describe, expect, it } from 'vitest';
import { defineComponent } from '../src/define';
import { queryAll } from '../src/define/selector';
import { createTestEditor, mountComponent } from '../src/testing';

const faq = defineComponent({
  id: 'ed-faq',
  label: 'FAQ',
  html: `<div class="edf"><h3 class="edf-title">Title</h3><div class="edf-list"><div class="edf-item"><p class="edf-q">Q</p><div class="edf-a"><span>A</span> <b>x</b></div></div></div><p class="edf-note">note</p></div>`,
  locked: true,
  editable: ['.edf-title', '.edf-q', '.edf-a'],
  repeat: ['.edf-item'],
});

const one = (root: Parameters<typeof queryAll>[0], sel: string) => queryAll(root, sel)[0]!;
const flags = (c: ReturnType<typeof one>) => ({ draggable: c.get('draggable'), removable: c.get('removable'), copyable: c.get('copyable'), droppable: c.get('droppable') });
const LOCKED = { draggable: false, removable: false, copyable: false, droppable: false };

describe('editable', () => {
  it('makes the chosen children rich-text editable, even a div holding inline elements', () => {
    const { component } = mountComponent(faq);
    expect(one(component, '.edf-title').get('type')).toBe('text');
    expect(one(component, '.edf-q').get('type')).toBe('text');
    expect(one(component, '.edf-a').get('type')).toBe('text');
  });

  it('does not leave data-gjs attributes in the exported HTML', () => {
    expect(mountComponent(faq).html()).not.toContain('data-gjs');
  });
});

describe('locked', () => {
  it('stops children being dragged, removed, copied or dropped into', () => {
    const { component } = mountComponent(faq);
    expect(flags(one(component, '.edf-note'))).toEqual(LOCKED);
    expect(flags(one(component, '.edf-title'))).toEqual(LOCKED); // editable text, but the structure is fixed
    expect(flags(one(component, '.edf-q'))).toEqual(LOCKED); // inside a repeat item, still fixed
  });

  it('is reapplied when saved HTML is loaded again', () => {
    const a = mountComponent(faq);
    const editor = createTestEditor();
    faq.installType(editor);
    editor.setComponents(a.html());
    const root = editor.getWrapper()!.components().at(0)!;
    expect(root.get('type')).toBe('ed-faq');
    expect(flags(one(root, '.edf-note'))).toEqual(LOCKED);
    expect(flags(one(root, '.edf-item'))).toMatchObject({ draggable: true, removable: true, copyable: true });
  });

  it('leaves everything free when not set', () => {
    const free = defineComponent({ id: 'ed-free', label: 'F', html: '<div class="edfree"><p class="x">x</p></div>' });
    const { component } = mountComponent(free);
    expect(one(component, '.x').get('draggable')).not.toBe(false);
    expect(one(component, '.x').get('removable')).not.toBe(false);
    expect(component.get('droppable')).not.toBe(false);
  });
});

describe('repeat', () => {
  it('lets users add, copy, remove and reorder the repeated parts', () => {
    const { component } = mountComponent(faq);
    expect(flags(one(component, '.edf-item'))).toMatchObject({ draggable: true, removable: true, copyable: true });
  });

  it('makes the parent accept only that kind of child', () => {
    const { component } = mountComponent(faq);
    expect(one(component, '.edf-list').get('droppable')).toBe('.edf-item');
    expect(component.get('droppable')).not.toBe(false); // the root can still hold its parts: repeat opens it up
  });

  it('gives a copy of an item the same rules', () => {
    const { component, editor } = mountComponent(faq);
    const item = one(component, '.edf-item');
    const copy = item.clone();
    one(component, '.edf-list').append(copy);
    expect(queryAll(component, '.edf-item')).toHaveLength(2);
    expect(flags(copy)).toMatchObject({ draggable: true, removable: true, copyable: true });
    expect(editor.getHtml().match(/edf-item/g)).toHaveLength(2);
  });

  it('combines several selectors on one container', () => {
    const multi = defineComponent({
      id: 'ed-multi',
      label: 'M',
      html: '<div class="edm"><div class="edm-list"><div class="edm-a">a</div><div class="edm-b">b</div></div></div>',
      repeat: ['.edm-a', '.edm-b'],
    });
    const { component } = mountComponent(multi);
    expect(one(component, '.edm-list').get('droppable')).toBe('.edm-a,.edm-b');
  });

  it('works without locked: only the repeat rules apply', () => {
    const loose = defineComponent({
      id: 'ed-loose',
      label: 'L',
      html: '<ul class="edl"><li class="edl-i">1</li><li class="edl-i">2</li></ul>',
      repeat: ['.edl-i'],
    });
    const { component } = mountComponent(loose);
    expect(component.get('droppable')).toBe('.edl-i');
    expect(one(component, '.edl-i').get('draggable')).toBe(true);
  });
});

describe('root flags', () => {
  const root = (extra: Record<string, unknown>) => mountComponent(defineComponent({ id: 'ed-root', label: 'R', html: '<div class="edr"><p>x</p></div>', ...extra })).component;

  it('pass droppable, removable and copyable through to the component', () => {
    const c = root({ droppable: false, removable: false, copyable: false });
    expect([c.get('droppable'), c.get('removable'), c.get('copyable')]).toEqual([false, false, false]);
  });

  it('accept a selector for droppable', () => {
    expect(root({ droppable: '.ok' }).get('droppable')).toBe('.ok');
  });

  it('close the root when locked and nothing is repeatable', () => {
    expect(root({ locked: true }).get('droppable')).toBe(false);
  });
});
