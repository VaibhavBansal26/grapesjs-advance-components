import { escapeHtml as e } from 'grapesjs-advance-components';
import type { CopyKey, SiteCopy } from './copy';

/** A piece of page content: an HTML string, or a GrapesJS component definition (for pieces that carry props). */
export type Item = string | Record<string, unknown>;

export interface PageSpec {
  name: string;
  items: Item[];
}

export interface RenderContext {
  paymentLink?: string;
  /** Component definition of a registered block, so forms pick up the configured endpoint. */
  block: (id: string) => Item;
}

export interface Template {
  id: string;
  label: string;
  description: string;
  /** Which parts of `SiteCopy` the model must write for this template. */
  needs: CopyKey[];
  pages: (copy: SiteCopy, ctx: RenderContext) => PageSpec[];
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const hero = (c: SiteCopy) =>
  `<section class="aac-hero"><h1>${e(c.hero.headline)}</h1><p>${e(c.hero.subheadline)}</p><div class="aac-hero-actions"><a class="aac-button" href="page:contact">${e(c.hero.cta)}</a></div></section>`;

const title = (text: string) => `<h2 class="aac-section-title">${e(text)}</h2>`;

const features = (c: SiteCopy) =>
  `<section class="aac-features">${c.features.map((f) => `<div class="aac-feature"><h3>${e(f.title)}</h3><p>${e(f.text)}</p></div>`).join('')}</section>`;

const testimonials = (c: SiteCopy): Item[] =>
  c.testimonials.length
    ? [`<div class="aac-slider" role="region" aria-roledescription="carousel" aria-label="Testimonials">${c.testimonials
        .map((t) => `<figure class="aac-slide"><blockquote class="aac-slide-quote">${e(t.quote)}</blockquote><figcaption class="aac-slide-source">— ${e(t.author)}</figcaption></figure>`)
        .join('')}</div>`]
    : [];

const faq = (c: SiteCopy) =>
  `<div class="aac-faq">${c.faq
    .map((q, i) => `<details${i === 0 ? ' open' : ''}><summary>${e(q.question)}</summary><div>${e(q.answer)}</div></details>`)
    .join('')}</div>`;

const cta = (c: SiteCopy) =>
  `<section class="aac-cta"><h2>${e(c.contact.heading || 'Ready to get started?')}</h2><p>${e(c.contact.text)}</p><a class="aac-button" href="page:contact">${e(c.contact.buttonText)}</a></section>`;

/** Plan cards. With a Payment Link the button is a real checkout button; without one it leads to the contact page. */
const pricing = (c: SiteCopy, ctx: RenderContext): Item => ({
  tagName: 'div',
  attributes: { class: 'aac-pricing-grid' },
  components: c.pricing.map((p) => ({
    tagName: 'section',
    attributes: { class: 'aac-pricing' },
    components: [
      `<h3>${e(p.name)}</h3>`,
      `<p class="aac-pricing-price"><span class="aac-pricing-amount">${e(p.price)}</span>${p.period ? `<small>${e(p.period)}</small>` : ''}</p>`,
      `<ul>${p.features.map((f) => `<li>${e(f)}</li>`).join('')}</ul>`,
      ctx.paymentLink
        ? `<button type="button" class="aac-button aac-checkout" data-mode="link" data-url="${e(ctx.paymentLink)}">${e(p.cta)}</button>`
        : `<a class="aac-button" href="page:contact">${e(p.cta)}</a>`,
    ],
  })),
});

/** Testimonials as cards (the `aac-testimonials` block), for templates that have room for a grid. */
const testimonialCards = (c: SiteCopy): Item[] =>
  c.testimonials.length
    ? [`<section class="aac-testimonials aac-cols-${Math.min(3, c.testimonials.length)}">${c.testimonials
        .map((t) => `<figure class="aac-testimonial"><blockquote>${e(t.quote)}</blockquote><figcaption><strong>${e(t.author)}</strong><span>Customer</span></figcaption></figure>`)
        .join('')}</section>`]
    : [];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');

const teamGrid = (c: SiteCopy): Item[] =>
  c.team.length
    ? [`<section class="aac-team aac-cols-${Math.min(3, c.team.length)}">${c.team
        .map((m) => `<article class="aac-member"><div class="aac-avatar" aria-hidden="true">${e(initials(m.name))}</div><h3>${e(m.name)}</h3><p>${e(m.role)}</p></article>`)
        .join('')}</section>`]
    : [];

/** Posts are placeholders: the date line is left for the owner to fill in. */
const blogList = (c: SiteCopy): Item[] =>
  c.posts.length
    ? [`<section class="aac-blog aac-blog--list">${c.posts
        .map((p) => `<article class="aac-post"><p class="aac-post-meta">Add a date</p><h3><a href="page:contact">${e(p.title)}</a></h3><p class="aac-post-excerpt">${e(p.excerpt)}</p></article>`)
        .join('')}</section>`]
    : [];

const prose = (heading: string, body = '') => `<div class="aac-prose"><h1>${e(heading)}</h1>${body ? `<p>${e(body)}</p>` : ''}</div>`;

const contactPage = (c: SiteCopy, ctx: RenderContext): Item[] => [
  `<div class="aac-prose"><h1>${e(c.contact.heading || 'Get in touch')}</h1><p>${e(c.contact.text)}</p></div>`,
  ctx.block('form-block'),
];

export const TEMPLATES: Template[] = [
  {
    id: 'landing',
    label: 'Product landing',
    description: 'SaaS or product: hero, benefits, testimonials, FAQ, pricing page, contact form.',
    needs: ['name', 'tagline', 'hero', 'features', 'testimonials', 'faq', 'pricing', 'contact'],
    pages: (c, ctx) => [
      { name: 'Home', items: [hero(c), title('Why people choose us'), features(c), ...testimonials(c), title('Questions, answered'), faq(c), cta(c)] },
      { name: 'Pricing', items: [`<div class="aac-prose"><h1>Pricing</h1></div>`, pricing(c, ctx), cta(c)] },
      { name: 'Contact', items: contactPage(c, ctx) },
    ],
  },
  {
    id: 'local-business',
    label: 'Local business',
    description: 'Shop, studio or service: hero, services, about page, testimonials, contact form.',
    needs: ['name', 'tagline', 'hero', 'features', 'testimonials', 'about', 'contact'],
    pages: (c, ctx) => [
      { name: 'Home', items: [hero(c), title('What we do'), features(c), ...testimonials(c), cta(c)] },
      { name: 'About', items: [`<div class="aac-prose"><h1>About ${e(c.name)}</h1><p>${e(c.about)}</p></div>`, ...testimonials(c)] },
      { name: 'Contact', items: contactPage(c, ctx) },
    ],
  },
  {
    id: 'small-business',
    label: 'Small business, five pages',
    description: 'A full small-business site: home, services with pricing and FAQ, about with the team, a journal and a contact form.',
    needs: ['name', 'tagline', 'hero', 'features', 'testimonials', 'faq', 'pricing', 'about', 'team', 'posts', 'contact'],
    pages: (c, ctx) => [
      { name: 'Home', items: [hero(c), title('What we do'), features(c), title('What customers say'), ...testimonialCards(c), cta(c)] },
      { name: 'Services', items: [prose('Services'), features(c), title('Plans and prices'), pricing(c, ctx), title('Questions, answered'), faq(c), cta(c)] },
      { name: 'About', items: [prose(`About ${c.name}`, c.about), title('Meet the team'), ...teamGrid(c), cta(c)] },
      { name: 'Journal', items: [prose('Journal', `News and ideas from ${c.name}.`), ...blogList(c)] },
      { name: 'Contact', items: contactPage(c, ctx) },
    ],
  },
  {
    id: 'shop',
    label: 'Sell from a page',
    description: 'Products or plans with Stripe Payment Link buttons, FAQ and a newsletter signup.',
    needs: ['name', 'tagline', 'hero', 'pricing', 'faq', 'contact'],
    pages: (c, ctx) => [
      { name: 'Home', items: [hero(c), title('Shop'), pricing(c, ctx), title('Questions, answered'), faq(c), ctx.block('newsletter-block')] },
      { name: 'Contact', items: contactPage(c, ctx) },
    ],
  },
];

export const getTemplate = (id: string): Template => {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template "${id}". Available: ${TEMPLATES.map((x) => x.id).join(', ')}.`);
  return t;
};

/** Header and footer shared by every page, linking to the other pages with `page:<slug>`. */
export const chrome = (c: SiteCopy, pages: string[]) => {
  const nav = `<nav>${pages.map((p) => `<a href="page:${slug(p)}">${e(p)}</a>`).join('')}</nav>`;
  return {
    header: `<header class="aac-header"><strong>${e(c.name)}</strong>${nav}</header>`,
    footer: `<footer class="aac-footer"><span>© ${new Date().getFullYear()} ${e(c.name)}</span>${nav}</footer>`,
  };
};
