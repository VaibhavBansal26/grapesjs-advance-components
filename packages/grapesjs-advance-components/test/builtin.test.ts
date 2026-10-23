import { describe, expect, it } from 'vitest';
import plugin, { type ComponentDefinition } from '../src';
import { checkoutButton, hero, progressBar, quote } from '../src/builtin';
import { baseCss } from '../src/styles';
import { createTestEditor, mountComponent, testRoundTrip, verifyScript } from '../src/testing';

const all: ComponentDefinition<any>[] = [progressBar, quote, hero, checkoutButton()];

describe.each(all.map((d) => [d.id, d] as const))('%s', (_id, def) => {
  it('survives export, reload and project JSON', () => {
    expect(() => testRoundTrip(def)).not.toThrow();
  });

  it.runIf(checkoutButton().scriptSource !== undefined && def.id === 'aac-checkout-button')('has a script that runs on its own', () => {
    expect(() => verifyScript(def)).not.toThrow();
  });

  it('is styled by the built-in stylesheet', () => {
    const cls = /class="([^" ]+)/.exec(def.spec.html)![1]!;
    expect(baseCss).toContain(`.${cls}`);
  });

  it('adds its block through the plugin', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    expect(editor.Blocks.get(def.spec.block ? (def.spec.block.id as string) : '')).toBeTruthy();
  });
});

describe('quote', () => {
  it('is editable as a whole, citation included', () => {
    const { component } = mountComponent(quote);
    expect(component.get('editable')).toBe(true);
    expect(component.toHTML()).toContain('<cite>');
  });
});

describe('hero', () => {
  it('lets the headline and text be edited, and keeps the buttons as links', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    const [h] = editor.addComponents('<section class="aac-hero"><h1>Hi</h1><p>There</p><a class="aac-button" href="/x">Go</a></section>');
    expect(h!.get('type')).toBe('aac-hero');
    const kids = h!.components();
    expect(kids.at(0)!.get('type')).toBe('text');
    expect(kids.at(2)!.get('type')).toBe('link');
  });
});

describe('progress bar', () => {
  it('reads its state back from saved HTML', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    const [bar] = editor.addComponents('<div class="aac-progress" role="progressbar" aria-valuenow="30"><div class="aac-progress-inner" style="width:30%;background-color:#00f"></div></div>');
    expect(progressBar.get(bar!, 'percentage')).toBe(30);
    expect(progressBar.get(bar!, 'color')).toBe('#00f');
  });
});
