import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent } from '../src';
import { createEditor } from '../src/editor';

const els: HTMLElement[] = [];
const mount = () => {
  const el = document.createElement('div');
  document.body.append(el);
  els.push(el);
  return el;
};
afterEach(() => {
  els.splice(0).forEach((e) => e.remove());
  localStorage.clear();
});

const thing = defineComponent({ id: 'ce-thing', label: 'Thing', html: '<div class="ce-thing">x</div>' });

describe('createEditor', () => {
  it('returns an editor with the plugin set up', () => {
    const editor = createEditor({ container: mount(), headless: true, storage: false });
    expect(editor.Blocks.get('hero-block')).toBeTruthy();
    expect(editor.Blocks.get('testimonials-block')).toBeTruthy();
    editor.destroy();
  });

  it('passes plugin options and extra plugins through', () => {
    let seen = false;
    const editor = createEditor({
      container: mount(),
      headless: true,
      storage: false,
      plugin: { custom: [thing], components: [{ label: 'Hero', name: 'hero', componentType: 'hero', visible: false }] },
      plugins: [() => void (seen = true)],
    });
    expect(editor.Blocks.get('ce-thing-block')).toBeTruthy();
    expect(editor.Blocks.get('hero-block')).toBeFalsy();
    expect(seen).toBe(true);
    editor.destroy();
  });

  it('loads a saved project', () => {
    const first = createEditor({ container: mount(), headless: true, storage: false, plugin: { custom: [thing] } });
    first.addComponents({ type: 'ce-thing' });
    const data = first.getProjectData();
    first.destroy();
    const second = createEditor({ container: mount(), headless: true, storage: false, plugin: { custom: [thing] }, projectData: data });
    expect(second.getWrapper()!.components().at(0)!.get('type')).toBe('ce-thing');
    second.destroy();
  });

  it('keeps the project in this browser by default, under the key you choose', () => {
    const editor = createEditor({ container: mount(), headless: true, storageKey: 'my-site' });
    const cfg = editor.StorageManager.getConfig() as { type?: string; options?: { local?: { key?: string } } };
    expect(cfg.type).toBe('local');
    expect(cfg.options?.local?.key).toBe('my-site');
    editor.destroy();
  });

  it('turns storage off, or takes your own storage manager', () => {
    const off = createEditor({ container: mount(), headless: true, storage: false });
    expect(off.StorageManager.getConfig().type).toBeFalsy();
    off.destroy();
    const own = createEditor({ container: mount(), headless: true, storage: { type: 'remote', autosave: false } });
    expect(own.StorageManager.getConfig().type).toBe('remote');
    own.destroy();
  });

  it('calls onReady with the editor once GrapesJS has loaded', () => {
    let got: unknown;
    const editor = createEditor({ container: mount(), headless: true, storage: false, onReady: (e) => (got = e) });
    expect(got).toBeUndefined();
    (editor as unknown as { trigger(e: string): void }).trigger('load'); // a headless editor has no canvas to wait for, so signal it by hand
    expect(got === editor).toBe(true);
    editor.destroy();
  });
});
