import type { Editor } from 'grapesjs';
import plugin, { exportSiteFiles } from '../index';
import { DEFAULT_ALLOWED_HOSTS } from '../payments';
import type { ComponentOption } from '../types';
import { extractJson, parseCopy, SYSTEM_PROMPT, type SiteCopy } from './copy';
import { ensureDom } from './dom';
import type { Provider } from './provider';
import { chrome, getTemplate, type Item } from './templates';

export interface SiteOptions {
  /** Where forms post. Your endpoint or a form service. Left empty, forms show a "not configured" message. */
  formEndpoint?: string;
  /** A Stripe Payment Link. Pricing buttons become checkout buttons; without it they lead to the contact page. */
  paymentLink?: string;
  /** Page titles and the meta description on exported pages. Filled in from the generated copy. */
  siteName?: string;
  description?: string;
}

export interface GenerateOptions extends SiteOptions {
  brief: string;
  template: string;
  provider: Provider;
  name?: string;
  /** Brand colour, e.g. `#0d9488`. */
  accent?: string;
  theme?: 'light' | 'dark';
  signal?: AbortSignal;
}

export interface GeneratedSite {
  project: Record<string, unknown>;
  files: Record<string, string>;
  copy: SiteCopy;
  pages: string[];
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function validateOptions(o: Pick<GenerateOptions, 'accent' | 'theme'> & SiteOptions) {
  if (o.accent && !HEX.test(o.accent)) throw new Error('--accent must be a hex colour like #0d9488.');
  if (o.theme && o.theme !== 'light' && o.theme !== 'dark') throw new Error('--theme must be light or dark.');
  if (o.paymentLink) {
    let u: URL;
    try {
      u = new URL(o.paymentLink);
    } catch {
      throw new Error('--payment-link must be a full https URL.');
    }
    if (u.protocol !== 'https:') throw new Error('--payment-link must use https.');
  }
  if (o.formEndpoint && !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/|\/)/.test(o.formEndpoint)) {
    throw new Error('--form-endpoint must be https, a localhost URL, or a path starting with /.');
  }
}

function shade(hex: string, amount: number): string {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const n = parseInt(full.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amount)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}
function rgba(hex: string, a: number): string {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const n = parseInt(full.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A headless editor with the plugin configured the way generated sites need it. */
export async function createEditor(site: SiteOptions = {}, projectData?: Record<string, unknown>): Promise<Editor> {
  await ensureDom();
  const { default: grapesjs } = await import('grapesjs');
  const formAction = site.formEndpoint ? { endpoint: site.formEndpoint } : {};
  const components: ComponentOption[] = [
    { label: 'Contact form', name: 'form', category: 'Form', componentType: 'form', formAction },
    { label: 'Newsletter', name: 'newsletter', category: 'Form', componentType: 'newsletter', formAction },
  ];
  const allowedHosts = [...DEFAULT_ALLOWED_HOSTS];
  if (site.paymentLink) allowedHosts.push(new URL(site.paymentLink).hostname);
  return grapesjs.init({
    headless: true,
    storageManager: false,
    ...(projectData ? { projectData } : {}),
    plugins: [(ed: Editor) => plugin(ed, { components, payments: { allowedHosts } })],
  } as never);
}

async function askModel(o: GenerateOptions, needs: ReturnType<typeof getTemplate>['needs']): Promise<SiteCopy> {
  const t = getTemplate(o.template);
  const user = `Template: ${t.id} (${t.description})\n\nBrief: ${o.brief.trim()}${o.name ? `\n\nBusiness name: ${o.name}` : ''}`;
  let nudge = '';
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await o.provider.complete(SYSTEM_PROMPT(needs), user + nudge, o.signal);
    try {
      const copy = parseCopy(extractJson(reply), needs);
      if (o.name) copy.name = o.name;
      return copy;
    } catch (err) {
      lastError = err;
      nudge = `\n\nYour previous reply was rejected: ${(err as Error).message} Reply again with only the corrected JSON object.`;
    }
  }
  throw new Error(`The model did not return usable copy after 2 attempts. ${(lastError as Error).message}`);
}

const BASE_CSS =
  'body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#18181b;background-color:#ffffff}' +
  'h1,h2,h3{line-height:1.2}img{max-width:100%;height:auto}';

export async function generateSite(o: GenerateOptions): Promise<GeneratedSite> {
  if (!o.brief?.trim()) throw new Error('Describe the site in a sentence or two, e.g. aac generate "bakery in Leeds with online orders".');
  validateOptions(o);
  const template = getTemplate(o.template);
  const copy = await askModel(o, template.needs);

  const editor = await createEditor(o);
  try {
    const block = (id: string): Item => editor.Blocks.get(id)!.getContent() as Item;
    const pageSpecs = template.pages(copy, { paymentLink: o.paymentLink, block });
    const names = pageSpecs.map((p) => p.name);
    const { header, footer } = chrome(copy, names);

    const accent = o.accent;
    editor.Css.addRules(
      BASE_CSS +
        (accent ? `:root{--aac-accent:${accent};--aac-accent-hover:${shade(accent, -0.12)};--aac-ring:${rgba(accent, 0.35)}}` : ''),
    );

    const pages = editor.Pages.getAll();
    pageSpecs.forEach((spec, i) => {
      const page = i === 0 ? pages[0]! : (editor.Pages.add({ name: spec.name, component: '' }) as never as ReturnType<typeof editor.Pages.get>)!;
      page.set('name', spec.name);
      page.getMainComponent().append({
        tagName: 'div',
        attributes: { class: 'aac-site', ...(o.theme === 'dark' ? { 'data-aac-theme': 'dark' } : {}) },
        components: [header, { tagName: 'main', attributes: { class: 'aac-page' }, components: spec.items }, footer],
      } as never);
    });

    return {
      project: editor.getProjectData() as Record<string, unknown>,
      files: exportSiteFiles(editor, { assets: 'external', lang: 'en', siteName: copy.name, description: copy.tagline }),
      copy,
      pages: names,
    };
  } finally {
    editor.destroy();
  }
}

/** Re-export a saved project (`project.json`) to static files. */
export async function exportProject(project: Record<string, unknown>, site: SiteOptions = {}): Promise<Record<string, string>> {
  const editor = await createEditor(site, project);
  try {
    return exportSiteFiles(editor, { assets: 'external', lang: 'en', siteName: site.siteName, description: site.description });
  } finally {
    editor.destroy();
  }
}
