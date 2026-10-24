/**
 * The copy a model writes for a site. The model returns JSON in this shape and the templates
 * render it, so generated markup is always structurally correct and every string is escaped
 * by us rather than trusted as HTML.
 */

export interface SiteCopy {
  name: string;
  tagline: string;
  hero: { headline: string; subheadline: string; cta: string };
  features: Array<{ title: string; text: string }>;
  testimonials: Array<{ quote: string; author: string }>;
  faq: Array<{ question: string; answer: string }>;
  pricing: Array<{ name: string; price: string; period: string; features: string[]; cta: string }>;
  about: string;
  team: Array<{ name: string; role: string }>;
  posts: Array<{ title: string; excerpt: string }>;
  contact: { heading: string; text: string; buttonText: string };
}

export type CopyKey = keyof SiteCopy;

const PIECES: Record<CopyKey, string> = {
  name: '"name": string  // business or product name, 1-4 words',
  tagline: '"tagline": string  // one short line',
  hero: '"hero": { "headline": string, "subheadline": string, "cta": string }  // headline under 12 words, cta 2-4 words',
  features: '"features": [{ "title": string, "text": string }]  // 3 to 6 items, text 1-2 sentences',
  testimonials: '"testimonials": [{ "quote": string, "author": string }]  // 2 or 3 plausible placeholder quotes',
  faq: '"faq": [{ "question": string, "answer": string }]  // 3 to 6 items',
  pricing: '"pricing": [{ "name": string, "price": string, "period": string, "features": string[], "cta": string }]  // 1 to 3 plans; price like "$19", period like "/month" or "one-time"',
  about: '"about": string  // one paragraph, 2-4 sentences',
  team: '"team": [{ "name": string, "role": string }]  // 2 to 4 placeholder people; use invented names, never real ones',
  posts: '"posts": [{ "title": string, "excerpt": string }]  // 3 plausible blog post ideas for this business, excerpt 1-2 sentences',
  contact: '"contact": { "heading": string, "text": string, "buttonText": string }',
};

export const schemaFor = (needs: CopyKey[]): string => `{\n  ${needs.map((k) => PIECES[k]).join(',\n  ')}\n}`;

export const SYSTEM_PROMPT = (needs: CopyKey[]) =>
  [
    'You write website copy. Reply with ONLY one JSON object, no markdown fences and no commentary.',
    `The object must have exactly this shape:\n${schemaFor(needs)}`,
    'Rules: plain text only (no HTML or markdown). Be specific to the business described, not generic.',
    'Do not invent facts the brief does not give (addresses, awards, statistics). Testimonials and prices are placeholders the owner will replace.',
  ].join('\n\n');

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Pull the JSON object out of a model reply, tolerating fences and surrounding prose. */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  const body = (fenced ? fenced[1]! : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The model reply contained no JSON object.');
  return JSON.parse(body.slice(start, end + 1));
}

const MIN: Partial<Record<CopyKey, number>> = { features: 3, faq: 3, pricing: 1, team: 1, posts: 1 };

/** Coerce a model reply into `SiteCopy`, throwing a message the model can act on if something required is missing. */
export function parseCopy(raw: unknown, needs: CopyKey[]): SiteCopy {
  const r = obj(raw);
  const hero = obj(r.hero);
  const contact = obj(r.contact);
  const copy: SiteCopy = {
    name: text(r.name, 60),
    tagline: text(r.tagline, 140),
    hero: { headline: text(hero.headline, 120), subheadline: text(hero.subheadline, 300), cta: text(hero.cta, 40) },
    features: list(r.features, 6).map((f) => ({ title: text(obj(f).title, 60), text: text(obj(f).text, 260) })).filter((f) => f.title && f.text),
    testimonials: list(r.testimonials, 3).map((t) => ({ quote: text(obj(t).quote, 260), author: text(obj(t).author, 60) })).filter((t) => t.quote && t.author),
    faq: list(r.faq, 8).map((q) => ({ question: text(obj(q).question, 140), answer: text(obj(q).answer, 420) })).filter((q) => q.question && q.answer),
    pricing: list(r.pricing, 3)
      .map((p) => ({
        name: text(obj(p).name, 40),
        price: text(obj(p).price, 24),
        period: text(obj(p).period, 24),
        features: list(obj(p).features, 6).map((x) => text(x, 90)).filter(Boolean),
        cta: text(obj(p).cta, 32) || 'Get started',
      }))
      .filter((p) => p.name && p.price),
    about: text(r.about, 900),
    team: list(r.team, 4).map((m) => ({ name: text(obj(m).name, 50), role: text(obj(m).role, 60) })).filter((m) => m.name && m.role),
    posts: list(r.posts, 4).map((p) => ({ title: text(obj(p).title, 90), excerpt: text(obj(p).excerpt, 220) })).filter((p) => p.title && p.excerpt),
    contact: { heading: text(contact.heading, 80), text: text(contact.text, 300), buttonText: text(contact.buttonText, 30) },
  };

  const problems: string[] = [];
  for (const key of needs) {
    const v = copy[key];
    const min = MIN[key];
    if (key === 'hero' && !(copy.hero.headline && copy.hero.subheadline)) problems.push('hero needs headline and subheadline');
    else if (key === 'contact' && !copy.contact.heading) problems.push('contact needs a heading');
    else if (min !== undefined && Array.isArray(v) && v.length < min) problems.push(`${key} needs at least ${min} complete items`);
    else if ((key === 'name' || key === 'about' || key === 'tagline') && !v) problems.push(`${key} is empty`);
  }
  if (problems.length) throw new Error(`The reply was incomplete: ${problems.join('; ')}.`);

  copy.hero.cta ||= 'Get started';
  copy.contact.buttonText ||= 'Send message';
  copy.contact.text ||= 'Send us a message and we will get back to you.';
  return copy;
}

/** Offline stand-in for a model, used by `--provider mock`, the docs and the tests. */
export function sampleCopy(brief: string, name?: string): SiteCopy {
  const first = brief.trim().split(/[.,\n]/)[0]!.trim().slice(0, 80) || 'your business';
  const title = name || first.split(/\s+/).slice(0, 3).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    name: title,
    tagline: `Everything you need from ${first.toLowerCase()}.`,
    hero: { headline: `${title}: ${first}`, subheadline: 'A clear sentence about who this is for and the result they get. Replace this text with your own.', cta: 'Get started' },
    features: [
      { title: 'Made for you', text: 'Explain the first benefit in the customer\'s own words.' },
      { title: 'Easy to start', text: 'Explain how simple it is to get going and what happens next.' },
      { title: 'Reliable', text: 'Explain why customers can count on you, with a concrete detail.' },
    ],
    testimonials: [
      { quote: 'A placeholder quote about how helpful this was.', author: 'Happy Customer' },
      { quote: 'Another placeholder quote the owner will replace.', author: 'Another Customer' },
    ],
    faq: [
      { question: 'How do I get started?', answer: 'Describe the first step in one or two sentences.' },
      { question: 'What does it cost?', answer: 'Explain the pricing in plain words, or point to the pricing page.' },
      { question: 'How can I contact you?', answer: 'Use the contact page and we will reply as soon as we can.' },
    ],
    pricing: [
      { name: 'Starter', price: '$9', period: '/month', features: ['The basics', 'Email support'], cta: 'Choose Starter' },
      { name: 'Pro', price: '$29', period: '/month', features: ['Everything in Starter', 'Priority support', 'Extra features'], cta: 'Choose Pro' },
    ],
    team: [
      { name: 'Alex Morgan', role: 'Founder' },
      { name: 'Sam Carter', role: 'Customer care' },
      { name: 'Jo Bennett', role: 'Operations' },
    ],
    posts: [
      { title: 'How we do things differently', excerpt: 'A placeholder post about what makes this business different.' },
      { title: 'Three questions we hear every week', excerpt: 'A placeholder post that answers common questions.' },
      { title: 'What is new this season', excerpt: 'A placeholder post about recent news and updates.' },
    ],
    about: `${title} exists to help people with ${first.toLowerCase()}. Tell your story here in two or three sentences.`,
    contact: { heading: 'Get in touch', text: 'Send a message and we will reply soon.', buttonText: 'Send message' },
  };
}
