import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { type PluginOptions } from '../src';
import { checkoutButton } from '../src/builtin';
import { runScript } from '../src/testing';

let editors: Editor[] = [];
function make(opts: PluginOptions = {}) {
  const el = document.createElement('div');
  document.body.append(el);
  const editor = grapesjs.init({ container: el, storageManager: false, headless: true, plugins: [(ed) => plugin(ed, opts)] });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** Mount the exported script on a real button, as a published page would. */
function mount(attrs: Record<string, string | number>, hosts?: string[]) {
  const btn = document.createElement('button');
  for (const [k, v] of Object.entries(attrs)) btn.setAttribute(`data-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, String(v));
  document.body.append(btn);
  runScript(checkoutButton(hosts), btn);
  return { btn };
}

describe('checkout block', () => {
  it('registers checkout and pricing blocks', () => {
    const ids = make().Blocks.getAll().models.map((b) => b.getId());
    expect(ids).toContain('checkout-button-block');
    expect(ids).toContain('pricing-block');
  });

  it('exposes the stripe settings as traits stored in data attributes', () => {
    const [cmp] = make().addComponents({ type: 'aac-checkout-button' });
    expect(cmp!.getTraits().map((t) => t.get('label'))).toEqual(['Mode', 'Payment Link URL', 'Session endpoint', 'Price ID', 'Quantity']);
    expect(cmp!.getAttributes()).toMatchObject({ 'data-mode': 'link', 'data-quantity': '1' });
  });

  it('puts the redirect allow-list in the exported script, from the plugin options', () => {
    const stripe = make();
    stripe.addComponents({ type: 'aac-checkout-button' });
    expect(stripe.getJs()).toContain('buy.stripe.com');
    const custom = make({ payments: { allowedHosts: ['pay.example.com'] } });
    custom.addComponents({ type: 'aac-checkout-button' });
    expect(custom.getJs()).toContain('pay.example.com');
    expect(custom.getJs()).not.toContain('buy.stripe.com');
  });

  it('applies checkoutElement options to the block', () => {
    const editor = make({ components: [{ label: 'Pay', name: 'checkout', componentType: 'checkout', checkoutElement: { mode: 'session', endpoint: '/api/pay', priceId: 'price_9', quantity: 2, buttonText: 'Pay now' } }] });
    const [cmp] = editor.addComponents(editor.Blocks.get('checkout-button-block')!.get('content') as never);
    expect(cmp!.getAttributes()).toMatchObject({ 'data-mode': 'session', 'data-endpoint': '/api/pay', 'data-price-id': 'price_9', 'data-quantity': '2' });
    expect(cmp!.toHTML()).toContain('Pay now');
  });

  it('link mode redirects (via a cancelable event) to an approved host', () => {
    const { btn } = mount({ url: 'https://buy.stripe.com/test_123' });
    const seen = vi.fn((e: Event) => e.preventDefault());
    btn.addEventListener('aac:checkout', seen);
    btn.click();
    expect(seen).toHaveBeenCalledOnce();
    expect((seen.mock.calls[0]![0] as CustomEvent).detail.url).toBe('https://buy.stripe.com/test_123');
    expect(btn.hasAttribute('data-error')).toBe(false);
  });

  it.each(['https://evil.com/pay', 'http://buy.stripe.com/x', 'javascript:alert(1)', 'https://buy.stripe.com.evil.com/'])(
    'blocks redirect to %s',
    (url) => {
      const { btn } = mount({ url });
      const redirect = vi.fn();
      const errors = vi.fn();
      btn.addEventListener('aac:checkout', redirect);
      btn.addEventListener('aac:checkout-error', errors);
      btn.click();
      expect(redirect).not.toHaveBeenCalled();
      expect(errors).toHaveBeenCalledOnce();
      expect(btn.getAttribute('data-error')).toMatch(/unapproved host/);
    },
  );

  it('reports a missing Payment Link', () => {
    const { btn } = mount({ url: '' });
    btn.click();
    expect(btn.getAttribute('data-error')).toMatch(/No Payment Link/);
  });

  it('session mode posts price and quantity to your endpoint and follows the returned url', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })));
    vi.stubGlobal('fetch', fetchMock);
    const { btn } = mount({ mode: 'session', endpoint: '/api/checkout', priceId: 'price_1', quantity: 3 });
    const redirect = vi.fn((e: Event) => e.preventDefault());
    btn.addEventListener('aac:checkout', redirect);
    btn.click();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    await vi.waitFor(() => expect(redirect).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/checkout');
    expect(JSON.parse(init.body as string)).toEqual({ priceId: 'price_1', quantity: 3 });
    await vi.waitFor(() => expect(btn.hasAttribute('aria-busy')).toBe(false));
  });

  it('session mode surfaces backend errors and rejects off-list session urls', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 500 })));
    const a = mount({ mode: 'session', endpoint: '/api/checkout' });
    a.btn.click();
    await vi.waitFor(() => expect(a.btn.getAttribute('data-error')).toMatch(/500/));

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ url: 'https://phish.example/pay' }))));
    const b = mount({ mode: 'session', endpoint: '/api/checkout' });
    b.btn.click();
    await vi.waitFor(() => expect(b.btn.getAttribute('data-error')).toMatch(/unapproved host/));
  });
});
