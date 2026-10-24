import { checkoutMarkup } from './builtin';
import { defineComponent } from './define';
import { ICONS, icon } from './ui';

/**
 * Section blocks made with `defineComponent`: pricing, testimonials, logo wall, team and blog list.
 * Their CSS lives in `baseCss`. Lists use `repeat`, so people can add, copy, remove and reorder
 * items in the editor while the rest of the section stays fixed.
 */

const COLUMNS = ['1', '2', '3'] as const;
const columns = (prefix: string) => ({ '1': `${prefix}-cols-1`, '2': `${prefix}-cols-2`, '3': `${prefix}-cols-3` });

/** What goes inside a pricing card, with the checkout settings from the `checkoutElement` option. */
export function pricingInner(ce: Parameters<typeof checkoutMarkup>[0] = {}): string {
  return `<h3>Pro</h3><p class="aac-pricing-price"><span class="aac-pricing-amount">$19</span><small>/month</small></p><ul><li>Unlimited projects</li><li>Priority support</li><li>Cancel anytime</li></ul>${checkoutMarkup(ce, 'Get started')}`;
}

export const pricing = defineComponent({
  id: 'aac-pricing',
  label: 'Pricing',
  category: 'Commerce',
  icon: ICONS.card,
  html: `<section class="aac-pricing">${pricingInner()}</section>`,
  detect: '.aac-pricing',
  locked: true,
  repeat: ['li'],
  editable: ['h3', 'li'],
  traits: {
    price: { type: 'text', label: 'Price', default: '$19', bind: { text: '.aac-pricing-amount' } },
    period: { type: 'text', label: 'Period', default: '/month', bind: { text: '.aac-pricing-price small' } },
  },
  block: { id: 'pricing-block' },
});

export const testimonials = defineComponent({
  id: 'aac-testimonials',
  label: 'Testimonials',
  category: 'Social proof',
  icon: icon('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
  html: `<section class="aac-testimonials aac-cols-3">${['Maya', 'Jon', 'Priya']
    .map((n) => `<figure class="aac-testimonial"><blockquote>A short, specific quote about what changed for this customer.</blockquote><figcaption><strong>${n}</strong><span>Role, Company</span></figcaption></figure>`)
    .join('')}</section>`,
  detect: '.aac-testimonials',
  block: { id: 'testimonials-block' },
  locked: true,
  repeat: ['.aac-testimonial'],
  editable: ['blockquote', 'strong', 'figcaption span'],
  traits: {
    columns: { type: 'select', label: 'Columns', options: [...COLUMNS], default: '3', bind: { class: columns('aac') } },
  },
});

export const logos = defineComponent({
  id: 'aac-logos',
  label: 'Logo wall',
  category: 'Social proof',
  icon: icon('<rect x="3" y="6" width="7" height="5" rx="1"/><rect x="14" y="6" width="7" height="5" rx="1"/><rect x="3" y="13" width="7" height="5" rx="1"/><rect x="14" y="13" width="7" height="5" rx="1"/>'),
  html: `<section class="aac-logos aac-logos--muted"><p class="aac-logos-title">Trusted by teams at</p><ul class="aac-logos-list">${['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli']
    .map((n) => `<li>${n}</li>`)
    .join('')}</ul></section>`,
  detect: '.aac-logos',
  block: { id: 'logos-block' },
  locked: true,
  repeat: ['li'],
  editable: ['.aac-logos-title', 'li'],
  traits: {
    muted: { type: 'checkbox', label: 'Muted colours', default: true, bind: { classIf: 'aac-logos--muted' } },
  },
});

export const team = defineComponent({
  id: 'aac-team',
  label: 'Team',
  category: 'Sections',
  icon: icon('<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 19a6 6 0 0 1 12 0M15 19a4 4 0 0 1 6 0"/>'),
  html: `<section class="aac-team aac-cols-3">${[['AB', 'Alex Brown', 'Founder'], ['CD', 'Chris Diaz', 'Head of design'], ['EF', 'Eli Fox', 'Support lead']]
    .map(([i, n, r]) => `<article class="aac-member"><div class="aac-avatar" aria-hidden="true">${i}</div><h3>${n}</h3><p>${r}</p></article>`)
    .join('')}</section>`,
  detect: '.aac-team',
  block: { id: 'team-block' },
  locked: true,
  repeat: ['.aac-member'],
  editable: ['.aac-avatar', 'h3', 'p'],
  traits: {
    columns: { type: 'select', label: 'Columns', options: [...COLUMNS], default: '3', bind: { class: columns('aac') } },
  },
});

export const blog = defineComponent({
  id: 'aac-blog',
  label: 'Blog list',
  category: 'Content',
  icon: icon('<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  html: `<section class="aac-blog aac-blog--list">${['A post title that earns the click', 'Another idea worth sharing', 'What we learned this month']
    .map((t) => `<article class="aac-post"><p class="aac-post-meta">Jan 1, 2026</p><h3><a href="#">${t}</a></h3><p class="aac-post-excerpt">One or two sentences that summarise the post and make people want to read on.</p></article>`)
    .join('')}</section>`,
  detect: '.aac-blog',
  block: { id: 'blog-block' },
  locked: true,
  repeat: ['.aac-post'],
  editable: ['.aac-post-meta', 'h3', '.aac-post-excerpt'],
  traits: {
    layout: {
      type: 'select',
      label: 'Layout',
      options: [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }],
      default: 'list',
      bind: { class: { list: 'aac-blog--list', grid: 'aac-blog--grid' } },
    },
  },
});

export const sections = [pricing, testimonials, logos, team, blog];
