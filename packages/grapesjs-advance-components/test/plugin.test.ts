import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { type PluginOptions } from '../src';
import { progressBar } from '../src/builtin';

let editors: Editor[] = [];

function make(opts: PluginOptions = {}) {
  const el = document.createElement('div');
  document.body.append(el);
  const editor = grapesjs.init({
    container: el,
    storageManager: false,
    headless: true,
    plugins: [(ed) => plugin(ed, opts)],
  });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
  document.body.innerHTML = '';
});

describe('blocks', () => {
  it('registers the v1 block ids', () => {
    const ids = make().Blocks.getAll().models.map((b) => b.getId());
    for (const id of [
      'faq-block', 'heading-h1-block', 'paragraph-block', 'list-block', 'link-block', 'image-block',
      'video-block', 'divider-block', 'map-block', 'progress-bar-block', 'button-block', 'slider-block',
      'dropdown-block', 'textarea-block', 'input-element-text-block', 'input-element-checkbox-block',
      'input-element-radio-block',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it('registers h1–h6 unless a headingType is chosen', () => {
    const all = make().Blocks.getAll().models.map((b) => b.getId()).filter((id) => id.startsWith('heading-'));
    expect(all).toHaveLength(6);

    const one = make({
      components: [{ label: 'H', name: 'heading', componentType: 'heading', headingType: 'h3' }],
    }).Blocks.getAll().models.map((b) => b.getId()).filter((id: string) => id.startsWith('heading-'));
    expect(one).toEqual(['heading-h3-block']);
  });

  it('lets users hide or replace default blocks by name', () => {
    const editor = make({
      components: [
        { label: 'Faq', name: 'faq', componentType: 'faq', visible: false },
        { label: 'Wide', name: 'divider', componentType: 'divider', category: 'Mine' },
      ],
    });
    expect(editor.Blocks.get('faq-block')).toBeUndefined();
    expect(editor.Blocks.get('divider-block')?.getCategoryLabel()).toBe('Mine');
  });

  it('escapes form values and gives each field a unique id', () => {
    const editor = make({
      components: [
        { label: 'X', name: 'x', componentType: 'inputElement', formElement: { type: 'text', label: '<b>L</b>', placeholder: '"><script>' } },
      ],
    });
    const content = editor.Blocks.get('input-element-text-block')!.getContent() as string;
    expect(content).not.toContain('<script>');
    expect(content).not.toContain('<b>L</b>');
    const a = editor.Blocks.get('input-element-checkbox-block')!.getContent() as string;
    const b = editor.Blocks.get('input-element-radio-block')!.getContent() as string;
    expect(a.match(/id="([^"]+)"/)![1]).not.toBe(b.match(/id="([^"]+)"/)![1]);
  });

  it('FAQ needs no script to open and close', () => {
    const content = make().Blocks.get('faq-block')!.getContent() as string;
    expect(content).toContain('<details');
    expect(content).not.toContain('<script');
  });
});

describe('progress bar', () => {
  it('drives the inner bar from traits and keeps ARIA in sync', () => {
    const editor = make();
    const [bar] = editor.addComponents({ type: 'aac-progress-bar' });
    progressBar.set(bar!, 'percentage', 40);
    progressBar.set(bar!, 'color', '#ff0000');
    expect(bar!.toHTML()).toContain('aria-valuenow="40"');
    expect(bar!.components().at(0)!.getStyle()).toMatchObject({ width: '40%', 'background-color': '#ff0000' });
  });

  it('keeps the themed colour until a colour is chosen', () => {
    const editor = make();
    const [bar] = editor.addComponents({ type: 'aac-progress-bar' });
    progressBar.set(bar!, 'percentage', 30);
    expect(bar!.components().at(0)!.getStyle()).toEqual({ width: '30%' });
    progressBar.set(bar!, 'color', '#ff0000');
    expect(bar!.components().at(0)!.getStyle()).toMatchObject({ 'background-color': '#ff0000' });
    progressBar.set(bar!, 'color', '');
    expect(bar!.components().at(0)!.getStyle()).toEqual({ width: '30%' });
  });

  it('clamps out-of-range values', () => {
    const editor = make();
    const [bar] = editor.addComponents({ type: 'aac-progress-bar' });
    progressBar.set(bar!, 'percentage', 250);
    expect(bar!.components().at(0)!.getStyle()).toMatchObject({ width: '100%' });
  });

  it('is recognised again when saved HTML is loaded', () => {
    const editor = make();
    editor.setComponents('<div class="aac-progress"><div class="aac-progress-inner"></div></div>');
    expect(editor.getWrapper()!.components().at(0)!.get('type')).toBe('aac-progress-bar');
  });
});
