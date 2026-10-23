import type { BlockProperties, Editor } from 'grapesjs';
import type { ComponentOption } from './types';
import { FORM_TYPE } from './forms';
import { CHECKOUT_TYPE, checkoutButton, hero, progressBar, quote } from './builtin';
import { escapeHtml, nextId } from './utils';
import { ICONS, blockLabel } from './ui';

const INPUT_TYPES = [
  'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month', 'number',
  'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week', 'checkbox',
];
const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

const checkoutValues = (ce: NonNullable<ComponentOption['checkoutElement']>) => ({
  mode: ce.mode ?? 'link',
  url: ce.url ?? '',
  endpoint: ce.endpoint ?? '',
  priceId: ce.priceId ?? '',
  quantity: ce.quantity ?? 1,
});

/** A checkout button for use inside other blocks. Its settings are the same `data-*` attributes the trait panel edits. */
function checkoutComponent(ce: NonNullable<ComponentOption['checkoutElement']>, fallbackText: string) {
  const v = checkoutValues(ce);
  return {
    type: CHECKOUT_TYPE,
    attributes: {
      type: 'button',
      class: 'aac-button aac-checkout',
      'data-mode': v.mode,
      'data-url': v.url,
      'data-endpoint': v.endpoint,
      'data-price-id': v.priceId,
      'data-quantity': String(v.quantity),
    },
    components: escapeHtml(ce.buttonText ?? fallbackText),
  };
}

type Entry = [id: string, props: BlockProperties];

function field(label: string, control: (id: string) => string, inline = false) {
  const id = nextId('aac-field');
  return `<div class="aac-field${inline ? ' aac-field--inline' : ''}">${
    inline ? `${control(id)}<label for="${id}">${escapeHtml(label)}</label>` : `<label for="${id}">${escapeHtml(label)}</label>${control(id)}`
  }</div>`;
}

function formContent(fa: NonNullable<ComponentOption['formAction']>, html: string) {
  return {
    type: FORM_TYPE,
    attributes: { class: 'aac-form', method: 'post', action: fa.endpoint ?? '' },
    encoding: fa.encoding ?? 'json',
    ...(fa.successMessage ? { successMessage: fa.successMessage } : {}),
    ...(fa.errorMessage ? { errorMessage: fa.errorMessage } : {}),
    redirectUrl: fa.redirectUrl ?? '',
    components: html,
  };
}

function buildEntries(c: ComponentOption): Entry[] {
  const category = c.category;
  const mk = (id: string, svg: string, content: BlockProperties['content'], label = c.label): Entry => [
    id,
    { label: blockLabel(svg, label), category, content },
  ];
  const fe = c.formElement ?? {};

  switch (c.componentType) {
    case 'faq':
      return [
        mk('faq-block', ICONS.text, `<div class="aac-faq">
  <details open><summary>What is your product?</summary><div>Replace this with the answer.</div></details>
  <details><summary>How does pricing work?</summary><div>Replace this with the answer.</div></details>
  <details><summary>Can I cancel anytime?</summary><div>Replace this with the answer.</div></details>
</div>`),
      ];

    case 'heading': {
      const tags = c.headingType && HEADING_TAGS.includes(c.headingType) ? [c.headingType] : HEADING_TAGS;
      return tags.map((tag) =>
        mk(
          `heading-${tag}-block`,
          ICONS.heading,
          { type: 'text', tagName: tag, content: `This is a ${tag} heading` },
          tags.length > 1 ? `${c.label} ${tag.toUpperCase()}` : c.label,
        ),
      );
    }

    case 'paragraph':
      return [
        mk('paragraph-block', ICONS.text, {
          type: 'text',
          tagName: 'p',
          content:
            'Write something that matters here. Double-click to edit this paragraph, or use the AI button to draft it for you.',
        }),
      ];

    case 'list':
      return [
        mk('list-block', ICONS.list, {
          tagName: 'ul',
          components: [1, 2, 3, 4].map((n) => ({ type: 'text', tagName: 'li', content: `List item ${n}` })),
        }),
      ];

    case 'link':
      return [mk('link-block', ICONS.link, { type: 'link', content: 'Link', attributes: { href: '#' } })];

    case 'image':
      return [mk('image-block', ICONS.image, { type: 'image', activeOnRender: true })];

    case 'video':
      return [mk('video-block', ICONS.video, { type: 'video' })];

    case 'divider':
      return [mk('divider-block', ICONS.divider, '<hr class="aac-divider"/>')];

    case 'map':
      return [mk('map-block', ICONS.map, { type: 'map' })];

    case 'button':
      return [
        mk('button-block', ICONS.button, {
          tagName: 'button',
          type: 'text',
          attributes: { type: 'button', class: 'aac-button' },
          content: c.buttonElement?.buttonText ?? 'Click here',
        }),
      ];

    case 'slider':
      return [
        mk('slider-block', ICONS.slider, `<div class="aac-slider" role="region" aria-roledescription="carousel" aria-label="Quotes">
  <figure class="aac-slide"><blockquote class="aac-slide-quote">The first quote from a happy customer.</blockquote><figcaption class="aac-slide-source">— Customer One</figcaption></figure>
  <figure class="aac-slide"><blockquote class="aac-slide-quote">Another quote from another person.</blockquote><figcaption class="aac-slide-source">— Customer Two</figcaption></figure>
  <figure class="aac-slide"><blockquote class="aac-slide-quote">A third quote to round it out.</blockquote><figcaption class="aac-slide-source">— Customer Three</figcaption></figure>
</div>`),
      ];

    case 'form': {
      const fa = c.formAction ?? {};
      const hp = `<div class="aac-hp" aria-hidden="true"><label>Leave this empty<input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></div>`;
      const html =
        field('Name', (id) => `<input id="${id}" type="text" name="name" autocomplete="name" required>`) +
        field('Email', (id) => `<input id="${id}" type="email" name="email" autocomplete="email" required>`) +
        field('Message', (id) => `<textarea id="${id}" name="message" required></textarea>`) +
        hp +
        `<button type="submit" class="aac-button">${escapeHtml(fa.buttonText ?? 'Send message')}</button><p class="aac-form-status" role="status" aria-live="polite"></p>`;
      return [mk('form-block', ICONS.mail, formContent(fa, html))];
    }

    case 'newsletter': {
      const fa = c.formAction ?? {};
      const hp = `<div class="aac-hp" aria-hidden="true"><label>Leave this empty<input type="text" name="_gotcha" tabindex="-1" autocomplete="off"></label></div>`;
      const html =
        `<div class="aac-form-row">` +
        field('Email address', (id) => `<input id="${id}" type="email" name="email" autocomplete="email" placeholder="you@example.com" required>`) +
        `<button type="submit" class="aac-button">${escapeHtml(fa.buttonText ?? 'Subscribe')}</button></div>` +
        hp +
        `<p class="aac-form-status" role="status" aria-live="polite"></p>`;
      return [mk('newsletter-block', ICONS.mail, formContent({ successMessage: 'You are subscribed. Thank you!', ...fa }, html))];
    }

    case 'features':
      return [
        mk('features-block', ICONS.grid, `<section class="aac-features">${['Fast to start', 'Easy to change', 'Built to last']
          .map((t) => `<div class="aac-feature"><h3>${t}</h3><p>Describe the benefit in a sentence or two, in the customer's words.</p></div>`)
          .join('')}</section>`),
      ];

    case 'cta':
      return [
        mk('cta-block', ICONS.hero, `<section class="aac-cta"><h2>Ready to get started?</h2><p>Tell people what happens next.</p><a class="aac-button" href="#">Get in touch</a></section>`),
      ];

    case 'pricing': {
      const ce = c.checkoutElement ?? {};
      return [
        mk('pricing-block', ICONS.card, {
          tagName: 'section',
          attributes: { class: 'aac-pricing' },
          components: [
            { type: 'text', tagName: 'h3', content: 'Pro' },
            { type: 'text', tagName: 'p', attributes: { class: 'aac-pricing-price' }, content: '$19<small>/month</small>' },
            {
              tagName: 'ul',
              components: ['Unlimited projects', 'Priority support', 'Cancel anytime'].map((t) => ({ type: 'text', tagName: 'li', content: t })),
            },
            checkoutComponent(ce, 'Get started'),
          ],
        }),
      ];
    }

    case 'header':
      return [
        mk('header-block', ICONS.layout, `<header class="aac-header"><strong>Brand</strong><nav><a href="#">Home</a><a href="#">Features</a><a href="#">Pricing</a><a href="#">Contact</a></nav></header>`),
      ];

    case 'footer':
      return [
        mk('footer-block', ICONS.layout, `<footer class="aac-footer"><span>© Your Company</span><nav><a href="#">Privacy</a><a href="#">Terms</a></nav></footer>`),
      ];

    case 'inputElement': {
      const type = INPUT_TYPES.includes(fe.type ?? '') ? fe.type! : 'text';
      const inline = type === 'checkbox' || type === 'radio';
      const html = field(
        fe.label ?? 'Label',
        (id) =>
          `<input id="${fe.id ? escapeHtml(fe.id) : id}" type="${type}" name="${escapeHtml(fe.name ?? '')}" placeholder="${escapeHtml(fe.placeholder ?? '')}"/>`,
        inline,
      );
      return [mk(`input-element-${type}-block`, ICONS.input, html)];
    }

    case 'dropdown': {
      const options = (fe.options ?? [])
        .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
        .join('');
      const html = field(fe.label ?? 'Label', (id) => `<select id="${fe.id ? escapeHtml(fe.id) : id}" name="${escapeHtml(fe.name ?? '')}">${options}</select>`);
      return [mk('dropdown-block', ICONS.select, html)];
    }

    case 'textarea': {
      const html = field(
        fe.label ?? 'Label',
        (id) => `<textarea id="${fe.id ? escapeHtml(fe.id) : id}" name="${escapeHtml(fe.name ?? '')}" placeholder="${escapeHtml(fe.placeholder ?? '')}"></textarea>`,
      );
      return [mk('textarea-block', ICONS.input, html)];
    }

    default:
      return [];
  }
}

export function loadBlocks(editor: Editor, components: ComponentOption[]) {
  const bm = editor.Blocks;
  components.forEach((c) => {
    if (c.visible === false) return;
    const as = { label: c.label, category: c.category };
    switch (c.componentType) {
      // Built with defineComponent: the definition makes its own block.
      case 'progress-bar':
        return progressBar.installBlock(editor, as);
      case 'quote':
        return quote.installBlock(editor, as);
      case 'hero':
        return hero.installBlock(editor, as);
      case 'checkout': {
        const ce = c.checkoutElement ?? {};
        return checkoutButton().installBlock(editor, { ...as, values: checkoutValues(ce), content: escapeHtml(ce.buttonText ?? 'Buy now') });
      }
    }
    buildEntries(c).forEach(([id, props]) => {
      if (!bm.get(id)) bm.add(id, props);
    });
  });
}
