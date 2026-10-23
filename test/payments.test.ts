import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { type PluginOptions } from '../src';

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

/** Mount the component's runtime script on a real button, as a published page would. */
function mount(editor: Editor, props: Record<string, unknown>) {
  const [cmp] = editor.addComponents({ type: 'aac-checkout-button' });
  const script = cmp!.get('script') as (this: HTMLElement, p: unknown) => void;
  const btn = document.createElement('button');
  document.body.append(btn);
  script.call(btn, { allowedHosts: ['checkout.stripe.com', 'buy.stripe.com'], mode: 'link', ...props });
  return { btn, cmp: cmp! };
}

describe('checkout block', () => {
  it('registers checkout and pricing blocks', () => {
    const ids = make().Blocks.getAll().models.map((b) => b.getId());
    expect(ids).toContain('checkout-button-block');
    expect(ids).toContain('pricing-block');
  });

  it('exposes the stripe settings as traits and script props', () => {
    const [cmp] = make().addComponents({ type: 'aac-checkout-button' });
    expect(cmp!.getTraits().map((t) => t.get('name'))).toEqual(['mode', 'url', 'endpoint', 'priceId', 'quantity']);
    expect(cmp!.get('script-props')).toContain('allowedHosts');
    expect(cmp!.get('allowedHosts')).toEqual(['checkout.stripe.com', 'buy.stripe.com']);
  });

  it('honours custom allowedHosts from plugin options', () => {
    const [cmp] = make({ payments: { allowedHosts: ['pay.example.com'] } }).addComponents({ type: 'aac-checkout-button' });
    expect(cmp!.get('allowedHosts')).toEqual(['pay.example.com']);
  });

  it('link mode redirects (via a cancelable event) to an approved host', () => {
    const { btn } = mount(make(), { url: 'https://buy.stripe.com/test_123' });
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
      const { btn } = mount(make(), { url });
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
    const { btn } = mount(make(), { url: '' });
    btn.click();
    expect(btn.getAttribute('data-error')).toMatch(/No Payment Link/);
  });

  it('session mode posts price and quantity to your endpoint and follows the returned url', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })));
    vi.stubGlobal('fetch', fetchMock);
    const { btn } = mount(make(), { mode: 'session', endpoint: '/api/checkout', priceId: 'price_1', quantity: 3 });
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
    const a = mount(make(), { mode: 'session', endpoint: '/api/checkout' });
    a.btn.click();
    await vi.waitFor(() => expect(a.btn.getAttribute('data-error')).toMatch(/500/));

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ url: 'https://phish.example/pay' }))));
    const b = mount(make(), { mode: 'session', endpoint: '/api/checkout' });
    b.btn.click();
    await vi.waitFor(() => expect(b.btn.getAttribute('data-error')).toMatch(/unapproved host/));
  });
});
