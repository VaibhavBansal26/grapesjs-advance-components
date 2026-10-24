import { defineComponent } from './define';
import type { ComponentDefinition } from './define';
import { ICONS } from './ui';
import { escapeHtml } from './utils';

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

/** The markup of a checkout button, so other blocks (pricing) can carry one with its settings in `data-*` attributes. */
export function checkoutMarkup(
  ce: { mode?: string; url?: string; endpoint?: string; priceId?: string; quantity?: number; buttonText?: string } = {},
  fallbackText = 'Buy now',
): string {
  const a = (k: string, v: string | number) => ` data-${k}="${escapeHtml(v)}"`;
  return `<button type="button" class="aac-button aac-checkout"${a('mode', ce.mode ?? 'link')}${a('url', ce.url ?? '')}${a('endpoint', ce.endpoint ?? '')}${a('price-id', ce.priceId ?? '')}${a('quantity', ce.quantity ?? 1)}>${escapeHtml(ce.buttonText ?? fallbackText)}</button>`;
}

export const FORM_TYPE = 'aac-form';

/**
 * A form that submits to YOUR endpoint (or a form service such as Formspree or Netlify Forms).
 *
 * - Without JavaScript it falls back to a normal POST to `action`.
 * - With JavaScript it validates, blocks bots through a honeypot, sends JSON or form-encoded data
 *   with `fetch`, and reports progress in an `aria-live` status line.
 * - It emits cancelable `aac:form-submit` (take over sending) and `aac:form-success` /
 *   `aac:form-error` events, so host pages can add analytics or their own transport.
 * - Inert inside the editor canvas. The fields are children, added by the block.
 */
export const form = defineComponent({
  id: FORM_TYPE,
  label: 'Form',
  category: 'Form',
  icon: ICONS.mail,
  html: '<form class="aac-form" method="post" action="" data-encoding="json" data-success-message="Thanks! Your message has been sent." data-error-message="Something went wrong. Please try again." data-redirect-url=""></form>',
  detect: '.aac-form',
  traits: {
    action: { type: 'text', label: 'Endpoint URL', placeholder: 'https://… or /api/contact', default: '', bind: { attr: 'action' } },
    encoding: {
      type: 'select',
      label: 'Send as',
      default: 'json',
      options: [
        { value: 'json', label: 'JSON' },
        { value: 'form', label: 'Form-encoded' },
      ],
    },
    successMessage: { type: 'text', label: 'Success message', default: 'Thanks! Your message has been sent.' },
    errorMessage: { type: 'text', label: 'Error message', default: 'Something went wrong. Please try again.' },
    redirectUrl: { type: 'text', label: 'Redirect after success', placeholder: '/thanks.html', default: '' },
  },
  runInEditor: true,
  block: { id: 'form-block' },
  script({ el, props, inEditor, emit }) {
    const form = el as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (inEditor) return; // inert while editing
      if (form.getAttribute('aria-busy') === 'true') return;

      const status = form.querySelector('.aac-form-status');
      const say = (text: string, state: string) => {
        if (!status) return;
        status.textContent = text;
        status.setAttribute('data-state', state);
      };
      // https, or http only on localhost; relative URLs resolve against the page.
      const safeUrl = (raw: string) => {
        try {
          const u = new URL(raw, window.location.href);
          const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
          return u.protocol === 'https:' || (u.protocol === 'http:' && local) ? u.href : '';
        } catch (_) {
          return '';
        }
      };

      if (!form.checkValidity()) {
        form.reportValidity();
        say('Please check the highlighted fields.', 'error');
        return;
      }
      const trap = form.querySelector('[name="_gotcha"]') as HTMLInputElement | null;
      if (trap && trap.value) {
        // A bot filled the hidden field: look successful, send nothing.
        say(props.successMessage, 'success');
        form.reset();
        return;
      }

      const data: Record<string, any> = {};
      new FormData(form).forEach((value, key) => {
        if (key === '_gotcha') return;
        data[key] = key in data ? [].concat(data[key], value as any) : value;
      });

      // An empty action would resolve to this very page, so it counts as not configured.
      const raw = (form.getAttribute('action') || '').trim();
      const target = raw ? safeUrl(raw) : '';
      if (!target) {
        say('This form has no valid endpoint configured.', 'error');
        emit('aac:form-error', { message: 'invalid endpoint', data });
        return;
      }
      if (!emit('aac:form-submit', { data, endpoint: target }, true)) return; // host took over

      form.setAttribute('aria-busy', 'true');
      say('Sending…', 'pending');
      let body: BodyInit;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (props.encoding === 'form') {
        const params = new URLSearchParams();
        Object.keys(data).forEach((k) => [].concat(data[k]).forEach((v) => params.append(k, String(v))));
        body = params;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(data);
      }
      fetch(target, { method: 'POST', headers, body })
        .then((res) => {
          if (!res.ok) throw new Error('Request failed (' + res.status + ')');
          say(props.successMessage, 'success');
          form.reset();
          emit('aac:form-success', { data, endpoint: target });
          const next = props.redirectUrl ? safeUrl(props.redirectUrl) : '';
          if (next) window.location.assign(next);
        })
        .catch((err) => {
          say(props.errorMessage, 'error');
          emit('aac:form-error', { message: err.message, data });
        })
        .then(() => form.removeAttribute('aria-busy'));
    });
  },
});
