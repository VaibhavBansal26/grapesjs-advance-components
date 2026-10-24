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
const STAT_COLUMNS = ['2', '3', '4'] as const;

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

export const stats = defineComponent({
  id: 'aac-stats',
  label: 'Stats',
  category: 'Social proof',
  icon: icon('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  html: `<section class="aac-stats aac-cols-3">${[['10k+', 'Customers'], ['99.9%', 'Uptime'], ['24/7', 'Support']]
    .map(([v, l]) => `<div class="aac-stat"><strong class="aac-stat-value">${v}</strong><span class="aac-stat-label">${l}</span></div>`)
    .join('')}</section>`,
  detect: '.aac-stats',
  block: { id: 'stats-block' },
  locked: true,
  repeat: ['.aac-stat'],
  editable: ['.aac-stat-value', '.aac-stat-label'],
  traits: {
    columns: { type: 'select', label: 'Columns', options: [...STAT_COLUMNS], default: '3', bind: { class: { '2': 'aac-cols-2', '3': 'aac-cols-3', '4': 'aac-cols-4' } } },
  },
});

export const steps = defineComponent({
  id: 'aac-steps',
  label: 'Steps',
  category: 'Sections',
  icon: icon('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M12 6h8M12 18h8"/>'),
  html: `<ol class="aac-steps aac-steps--vertical">${[['Tell us what you need', 'A sentence or two about the job.'], ['We get to work', 'Say what happens next and how long it takes.'], ['You are done', 'Explain what the customer ends up with.']]
    .map(([t, d]) => `<li class="aac-step"><h3>${t}</h3><p>${d}</p></li>`)
    .join('')}</ol>`,
  detect: '.aac-steps',
  block: { id: 'steps-block' },
  locked: true,
  repeat: ['.aac-step'],
  editable: ['h3', 'p'],
  traits: {
    layout: {
      type: 'select',
      label: 'Layout',
      options: [{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }],
      default: 'vertical',
      bind: { class: { vertical: 'aac-steps--vertical', horizontal: 'aac-steps--horizontal' } },
    },
  },
});

export const banner = defineComponent({
  id: 'aac-banner',
  label: 'Banner',
  category: 'Sections',
  icon: icon('<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h6"/>'),
  html: '<aside class="aac-banner aac-banner--info" role="note"><p><strong>New:</strong> say what is new in one short line. <a href="#">Learn more</a></p></aside>',
  detect: '.aac-banner',
  block: { id: 'banner-block' },
  locked: true,
  editable: ['p'],
  traits: {
    tone: {
      type: 'select',
      label: 'Tone',
      options: ['info', 'success', 'warning'],
      default: 'info',
      bind: { class: { info: 'aac-banner--info', success: 'aac-banner--success', warning: 'aac-banner--warning' } },
    },
  },
});

export const compare = defineComponent({
  id: 'aac-compare',
  label: 'Comparison table',
  category: 'Commerce',
  icon: icon('<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M9 5v14M15 5v14"/>'),
  html: `<div class="aac-compare-wrap"><table class="aac-compare aac-compare--striped"><thead><tr><th scope="col">Feature</th><th scope="col">Starter</th><th scope="col">Pro</th></tr></thead><tbody>${[['Projects', '3', 'Unlimited'], ['Support', 'Email', 'Priority'], ['Custom domain', 'No', 'Yes']]
    .map(([f, a, b]) => `<tr><th scope="row">${f}</th><td>${a}</td><td>${b}</td></tr>`)
    .join('')}</tbody></table></div>`,
  detect: '.aac-compare-wrap',
  block: { id: 'compare-block' },
  locked: true,
  repeat: ['tbody tr'],
  editable: ['th', 'td'],
  traits: {
    striped: { type: 'checkbox', label: 'Striped rows', default: true, bind: { classIf: 'aac-compare--striped', on: '.aac-compare' } },
  },
});

/**
 * Tabs. Without JavaScript every panel is shown one under the other, so the content is never hidden.
 * With it the script turns them into an accessible tab widget: roles and ids, arrow keys, Home and End.
 * The three tabs are fixed (each tab needs its own panel), and their labels and panels are edited in place.
 */
export const tabs = defineComponent({
  id: 'aac-tabs',
  label: 'Tabs',
  category: 'Sections',
  icon: icon('<path d="M3 8h6l2-3h10v14H3z"/>'),
  html: `<div class="aac-tabs"><div class="aac-tablist">${['Overview', 'Details', 'Pricing']
    .map((t) => `<button type="button" class="aac-tab">${t}</button>`)
    .join('')}</div>${['What it is, in a sentence or two.', 'The details people ask about.', 'What it costs and what is included.']
    .map((t) => `<div class="aac-tabpanel"><p>${t}</p></div>`)
    .join('')}</div>`,
  detect: '.aac-tabs',
  block: { id: 'tabs-block' },
  locked: true,
  editable: ['.aac-tab', '.aac-tabpanel'],
  runInEditor: false,
  script({ el }) {
    const tabs = Array.prototype.slice.call(el.querySelectorAll('.aac-tab')) as HTMLElement[];
    const panels = Array.prototype.slice.call(el.querySelectorAll('.aac-tabpanel')) as HTMLElement[];
    if (!tabs.length || tabs.length !== panels.length) return;
    const uid = 'aac-tabs-' + Math.random().toString(36).slice(2, 8);
    const list = el.querySelector('.aac-tablist');
    if (list) {
      list.setAttribute('role', 'tablist');
    }
    el.classList.add('aac-tabs--js');
    const select = (index: number, focus?: boolean) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.setAttribute('tabindex', on ? '0' : '-1');
        panels[i]!.hidden = !on;
      });
      if (focus) tabs[index]!.focus();
    };
    tabs.forEach((tab, i) => {
      tab.setAttribute('role', 'tab');
      tab.id = uid + '-tab-' + i;
      tab.setAttribute('aria-controls', uid + '-panel-' + i);
      panels[i]!.setAttribute('role', 'tabpanel');
      panels[i]!.id = uid + '-panel-' + i;
      panels[i]!.setAttribute('aria-labelledby', tab.id);
      tab.addEventListener('click', () => select(i));
      tab.addEventListener('keydown', (e: KeyboardEvent) => {
        const last = tabs.length - 1;
        const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
        if (next < 0) return;
        e.preventDefault();
        select(next, true);
      });
    });
    select(0);
  },
});

export const sections = [pricing, testimonials, logos, team, blog, stats, steps, banner, compare, tabs];
