import { describe, expect, it } from 'vitest';
import plugin, { type ComponentDefinition } from '../src';
import { blog, logos, pricing, pricingInner, sections, team, testimonials } from '../src/sections';
import { baseCss } from '../src/styles';
import { createTestEditor, mountComponent, testRoundTrip } from '../src/testing';

const editorWithPlugin = (opts = {}) => createTestEditor((ed) => plugin(ed, opts));

describe.each(sections.map((d) => [d.id, d as ComponentDefinition<any>] as const))('%s', (_id, def) => {
  it('survives export, reload and project JSON', () => {
    expect(() => testRoundTrip(def)).not.toThrow();
  });

  it('is styled by the built-in stylesheet, for every class it uses', () => {
    const classes = new Set([...def.spec.html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/)));
    for (const cls of classes) if (!cls.startsWith('aac-button') && cls !== 'aac-checkout') expect(baseCss, `.${cls}`).toContain(`.${cls}`);
  });

  it('adds its block through the plugin, in the default list', () => {
    expect(editorWithPlugin().Blocks.get(def.spec.block ? (def.spec.block.id as string) : `${def.id}-block`)).toBeTruthy();
  });

  it('is recognised when saved HTML is loaded', () => {
    const editor = editorWithPlugin();
    const [c] = editor.addComponents(def.spec.html);
    expect(c!.get('type')).toBe(def.id);
  });
});

describe('column and layout settings', () => {
  it.each([['testimonials', testimonials], ['team', team]] as Array<[string, ComponentDefinition<any>]>)('%s switches the grid class', (_name, def) => {
    const m = mountComponent(def, { values: { columns: '2' } });
    expect(m.html()).toContain('aac-cols-2');
    expect(m.html()).not.toContain('aac-cols-3');
    m.set('columns', '1');
    expect(m.html()).toContain('aac-cols-1');
  });

  it('blog switches between list and grid', () => {
    const m = mountComponent(blog, { values: { layout: 'grid' } });
    expect(m.html()).toContain('aac-blog--grid');
    expect(m.html()).not.toContain('aac-blog--list');
  });

  it('logo wall mutes its logos with a checkbox', () => {
    const m = mountComponent(logos);
    expect(m.html()).toContain('aac-logos--muted');
    m.set('muted', false);
    expect(m.html()).not.toContain('aac-logos--muted');
  });
});

describe('lists you can grow', () => {
  it.each([['testimonials', testimonials, '.aac-testimonial'], ['team', team, '.aac-member'], ['blog', blog, '.aac-post'], ['logos', logos, 'li'], ['pricing', pricing, 'li']] as Array<[string, ComponentDefinition<any>, string]>)(
    '%s accepts only its own items',
    (_name, def, item) => {
      const { component } = mountComponent(def);
      const holder = item === 'li' ? component.find?.('ul')[0] ?? component.components().models.find((c) => c.get('tagName') === 'ul') : component;
      expect(holder!.get('droppable')).toBe(item);
    },
  );

  it('keeps the rest of the section fixed', () => {
    const { component } = mountComponent(team);
    const card = component.components().at(0)!;
    expect(card.get('removable')).toBe(true);
    expect(card.components().at(1)!.get('removable')).toBe(false);
  });

  it('lets people edit the text in items', () => {
    const { component } = mountComponent(testimonials);
    const quote = component.components().at(0)!.components().at(0)!;
    expect(quote.get('type')).toBe('text');
  });
});

describe('pricing', () => {
  it('writes price and period into the card', () => {
    const m = mountComponent(pricing, { values: { price: '$49', period: '/year' } });
    expect(m.html()).toContain('$49');
    expect(m.html()).toContain('/year');
    expect(pricing.get(m.component, 'price')).toBe('$49');
  });

  it('carries a checkout button that keeps its own settings', () => {
    const editor = editorWithPlugin();
    const [card] = editor.addComponents(pricing.spec.html);
    const button = card!.components().models.find((c) => c.get('type') === 'aac-checkout-button');
    expect(button).toBeTruthy();
  });

  it('applies the checkoutElement option to the block', () => {
    const editor = editorWithPlugin({
      components: [{ label: 'Plan', name: 'pricing', componentType: 'pricing', checkoutElement: { url: 'https://buy.stripe.com/x', buttonText: 'Buy Pro' } }],
    });
    const [card] = editor.addComponents(editor.Blocks.get('pricing-block')!.get('content') as never);
    expect(card!.toHTML()).toContain('data-url="https://buy.stripe.com/x"');
    expect(card!.toHTML()).toContain('Buy Pro');
  });

  it('escapes the option values it puts into markup', () => {
    expect(pricingInner({ url: '"><script>x</script>', buttonText: '<b>' })).not.toMatch(/<script>|<b>/);
  });
});
