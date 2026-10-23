import { defineComponent } from './define';
import type { ComponentDefinition } from './define';
import { ICONS } from './ui';

export const DEFAULT_ALLOWED_HOSTS = ['checkout.stripe.com', 'buy.stripe.com'];
export const CHECKOUT_TYPE = 'aac-checkout-button';

/**
 * The built-in blocks that are made with the same `defineComponent` API as your own. Their CSS stays in
 * `baseCss` so the stylesheet can be turned off as a whole (`injectStyles: false`).
 */

/** A container with an inner bar. The width and colour live in the bar's style, so exported HTML needs no script. */
export const progressBar = defineComponent({
  id: 'aac-progress-bar',
  label: 'Progress Bar',
  category: 'Custom',
  icon: ICONS.progress,
  html: '<div class="aac-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="65"><div class="aac-progress-inner"></div></div>',
  detect: '.aac-progress',
  locked: true,
  droppable: false,
  traits: {
    percentage: {
      type: 'number',
      label: 'Percentage',
      min: 0,
      max: 100,
      default: 65,
      bind: [{ style: 'width', unit: '%', on: '.aac-progress-inner' }, { attr: 'aria-valuenow' }],
    },
    // Empty means: use the --aac-accent theme token.
    color: { type: 'color', label: 'Colour', default: '', bind: { style: 'background-color', on: '.aac-progress-inner' } },
  },
  block: { id: 'progress-bar-block' },
});

export const quote = defineComponent({
  id: 'aac-quote',
  label: 'Quote',
  category: 'Text',
  icon: ICONS.quote,
  html: '<blockquote class="aac-quote">A short, memorable quote goes here.<cite>— Someone Notable</cite></blockquote>',
  detect: '.aac-quote',
  extend: 'text',
  block: { id: 'quote-block' },
});

export const hero = defineComponent({
  id: 'aac-hero',
  label: 'Hero',
  category: 'Sections',
  icon: ICONS.hero,
  html: '<section class="aac-hero"><h1>A headline that says what you do</h1><p>One or two sentences that explain who it is for and why it is worth their time.</p><div class="aac-hero-actions"><a class="aac-button" href="#">Get started</a><a class="aac-button aac-button--outline" href="#">Learn more</a></div></section>',
  detect: '.aac-hero',
  editable: ['h1', 'p'],
  block: { id: 'hero-block' },
});

/**
 * Checkout button for Stripe-hosted payment pages. Card data never touches the page or this
 * package: the button only redirects to a Stripe Payment Link, or asks YOUR backend to create a
 * Checkout Session and redirects to the URL it returns. Secret keys stay on your server.
 *
 * Its settings are `data-*` attributes, so a saved page keeps them. The redirect allow-list is
 * embedded in the script. It emits cancelable `aac:checkout` and `aac:checkout-error` events so
 * host pages can add analytics or take over the redirect.
 */
export function checkoutButton(allowedHosts: string[] = DEFAULT_ALLOWED_HOSTS) {
  return defineComponent({
    id: 'aac-checkout-button',
    label: 'Checkout',
    category: 'Commerce',
    icon: ICONS.card,
    html: '<button type="button" class="aac-button aac-checkout">Buy now</button>',
    detect: '.aac-checkout',
    extend: 'text',
    droppable: false,
    traits: {
      mode: {
        type: 'select',
        label: 'Mode',
        default: 'link',
        options: [
          { value: 'link', label: 'Payment Link' },
          { value: 'session', label: 'Backend session' },
        ],
      },
      url: { type: 'text', label: 'Payment Link URL', placeholder: 'https://buy.stripe.com/…', default: '' },
      endpoint: { type: 'text', label: 'Session endpoint', placeholder: '/api/checkout', default: '' },
      priceId: { type: 'text', label: 'Price ID', placeholder: 'price_…', default: '' },
      quantity: { type: 'number', label: 'Quantity', min: 1, default: 1 },
    },
    consts: { allowedHosts },
    block: { id: 'checkout-button-block' },
    script({ el, props, consts, inEditor, emit }) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        // Inside the GrapesJS canvas the button must stay inert while editing.
        if (inEditor) return;
        if (el.getAttribute('aria-busy') === 'true') return;

        const fail = (message: string) => {
          el.setAttribute('data-error', message);
          emit('aac:checkout-error', { message });
        };
        const go = (target: string) => {
          let ok = false;
          try {
            const u = new URL(target, window.location.href);
            ok = u.protocol === 'https:' && ((consts.allowedHosts as string[]) || []).indexOf(u.hostname) > -1;
          } catch (_) {
            ok = false;
          }
          if (!ok) return fail('Blocked checkout redirect to an unapproved host.');
          if (emit('aac:checkout', { url: target }, true)) window.location.assign(target);
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
  });
}

export type BuiltinDefinition = ComponentDefinition<any>;
