import type { Editor } from 'grapesjs';
import type { PaymentsOptions } from './types';

export const DEFAULT_ALLOWED_HOSTS = ['checkout.stripe.com', 'buy.stripe.com'];
export const CHECKOUT_TYPE = 'aac-checkout-button';

/**
 * Checkout button for Stripe-hosted payment pages. Card data never touches the page or this
 * package: the button only redirects to a Stripe Payment Link, or asks YOUR backend to create a
 * Checkout Session and redirects to the URL it returns. Secret keys stay on your server.
 *
 * The runtime is a plain function exported inline with the page (GrapesJS `script`), so
 * published pages need no extra JS. It emits cancelable `aac:checkout` and `aac:checkout-error`
 * events so host pages can add analytics or take over the redirect.
 */
export function loadPayments(editor: Editor, opts: PaymentsOptions = {}) {
  const allowedHosts = opts.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;

  editor.Components.addType(CHECKOUT_TYPE, {
    extend: 'text',
    isComponent: (el) => (el.classList?.contains('aac-checkout') ? { type: CHECKOUT_TYPE } : undefined),
    model: {
      defaults: {
        name: 'Checkout',
        tagName: 'button',
        attributes: { type: 'button', class: 'aac-button aac-checkout' },
        content: 'Buy now',
        droppable: false,
        mode: 'link',
        url: '',
        endpoint: '',
        priceId: '',
        quantity: 1,
        allowedHosts,
        traits: [
          { type: 'select', name: 'mode', label: 'Mode', changeProp: true, options: [
            { id: 'link', label: 'Payment Link' },
            { id: 'session', label: 'Backend session' },
          ] },
          { type: 'text', name: 'url', label: 'Payment Link URL', placeholder: 'https://buy.stripe.com/…', changeProp: true },
          { type: 'text', name: 'endpoint', label: 'Session endpoint', placeholder: '/api/checkout', changeProp: true },
          { type: 'text', name: 'priceId', label: 'Price ID', placeholder: 'price_…', changeProp: true },
          { type: 'number', name: 'quantity', label: 'Quantity', min: 1, changeProp: true },
        ],
        'script-props': ['mode', 'url', 'endpoint', 'priceId', 'quantity', 'allowedHosts'],
        script: function (props: Record<string, any>) {
          const el = this as unknown as HTMLElement;
          el.addEventListener('click', (e) => {
            e.preventDefault();
            // Inside the GrapesJS canvas the button must stay inert while editing.
            const frame = window.frameElement as HTMLElement | null;
            if (frame && String(frame.className).indexOf('gjs-frame') > -1) return;
            if (el.getAttribute('aria-busy') === 'true') return;

            const fail = (message: string) => {
              el.setAttribute('data-error', message);
              el.dispatchEvent(new CustomEvent('aac:checkout-error', { bubbles: true, detail: { message } }));
            };
            const go = (target: string) => {
              let ok = false;
              try {
                const u = new URL(target, window.location.href);
                ok = u.protocol === 'https:' && (props.allowedHosts || []).indexOf(u.hostname) > -1;
              } catch (_) {
                ok = false;
              }
              if (!ok) return fail('Blocked checkout redirect to an unapproved host.');
              const ev = new CustomEvent('aac:checkout', { bubbles: true, cancelable: true, detail: { url: target } });
              if (el.dispatchEvent(ev)) window.location.assign(target);
            };

            el.removeAttribute('data-error');
            if (props.mode !== 'session') {
              if (!props.url) return fail('No Payment Link configured.');
              return go(props.url);
            }
            if (!props.endpoint) return fail('No checkout endpoint configured.');
            el.setAttribute('aria-busy', 'true');
            fetch(props.endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ priceId: props.priceId, quantity: Number(props.quantity) || 1 }),
            })
              .then((r) => {
                if (!r.ok) throw new Error('Checkout failed (' + r.status + ')');
                return r.json();
              })
              .then((d) => go(d && d.url))
              .catch((err) => fail(err.message))
              .then(() => el.removeAttribute('aria-busy'));
          });
        },
      },
    },
  });
}
