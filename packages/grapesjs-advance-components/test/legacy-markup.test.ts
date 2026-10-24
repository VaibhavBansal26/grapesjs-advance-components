import { describe, expect, it } from 'vitest';
import plugin from '../src';
import { form } from '../src/builtin';
import { pricing } from '../src/sections';
import { createTestEditor } from '../src/testing';

// Markup written by earlier versions must still load and export without errors.
describe('markup from earlier versions', () => {
  it('a pricing card without the amount span still loads and keeps its checkout button', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    const html =
      '<section class="aac-pricing"><h3>Pro</h3><p class="aac-pricing-price">$19<small>/month</small></p><ul><li>One</li></ul>' +
      '<button type="button" class="aac-button aac-checkout" data-mode="link" data-url="https://buy.stripe.com/x">Buy</button></section>';
    const [card] = editor.addComponents(html);
    expect(card!.get('type')).toBe('aac-pricing');
    expect(card!.toHTML()).toContain('data-url="https://buy.stripe.com/x"');
    expect(card!.toHTML()).toContain('$19');
    expect(() => pricing.set(card!, 'price', '$29')).not.toThrow();
    expect(card!.toHTML()).toContain('$19'); // nothing to write into, so the old text is left alone
  });

  it('a form without data attributes loads with the default settings and keeps its action', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    const [f] = editor.addComponents('<form class="aac-form" method="post" action="https://api.example.com/c"><input name="a"></form>');
    expect(f!.get('type')).toBe('aac-form');
    expect(form.get(f!, 'action')).toBe('https://api.example.com/c');
    expect(form.get(f!, 'encoding')).toBe('json');
    expect(f!.toHTML()).toContain('action="https://api.example.com/c"');
  });

  it('project JSON from 2.2 forms keeps the endpoint', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    const [f] = editor.addComponents({
      type: 'aac-form',
      attributes: { class: 'aac-form', method: 'post', action: '/api/old' },
      encoding: 'form',
      successMessage: 'Old message',
      components: '<input name="a">',
    } as never);
    expect(form.get(f!, 'action')).toBe('/api/old');
    expect(f!.toHTML()).toContain('action="/api/old"');
  });
});
