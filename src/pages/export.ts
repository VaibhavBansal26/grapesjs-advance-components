import type { Editor } from 'grapesjs';
import { escapeHtml } from '../utils';

export interface ExportedPage {
  id: string;
  name: string;
  /** File name, e.g. `index.html`, `about.html`. The first page is always `index.html`. */
  file: string;
  html: string;
  css: string;
  /** Scripts of the page's components (e.g. the checkout button). Empty when there are none. */
  js: string;
  /** Complete standalone document (doctype, head with title, styles and scripts). */
  document: string;
}

export interface ExportSiteOptions {
  lang?: string;
  /** Extra markup for every page's `<head>` (analytics, fonts, meta tags). Trusted: not escaped. */
  head?: string;
  /**
   * `inline` (default): a `<style>` and `<script>` inside each page.
   * `external`: `<slug>.css` / `<slug>.js` files linked from the page, which works under a strict
   * Content-Security-Policy (no `unsafe-inline`).
   */
  assets?: 'inline' | 'external';
  /** Appended to every page title (`About · Acme`); the first page's title is just the site name. */
  siteName?: string;
  /** Written to `<meta name="description">` on every page. */
  description?: string;
}

export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';

/**
 * Export every page of the project as a standalone HTML document.
 * Links written as `page:<slug>` (e.g. `<a href="page:about">`) become `about.html`.
 */
export function exportSite(editor: Editor, opts: ExportSiteOptions = {}): ExportedPage[] {
  const pages = editor.Pages.getAll();
  const used = new Set<string>();
  const external = opts.assets === 'external';

  const meta = pages.map((page, i) => {
    let slug = i === 0 ? 'index' : slugify(page.getName() || String(page.getId()));
    while (used.has(slug)) slug += '-2';
    used.add(slug);
    return { page, slug };
  });
  const fileFor = new Map(meta.map(({ slug }) => [slug, `${slug}.html`]));
  // `page:about` may also use the page's own name-slug even when it is the index page.
  meta.forEach(({ page, slug }) => fileFor.set(slugify(page.getName() || ''), `${slug}.html`));

  return meta.map(({ page, slug }, index) => {
    const main = page.getMainComponent();
    const css = editor.getCss({ component: main }) ?? '';
    const js = (editor.getJs({ component: main }) ?? '').trim();
    const html = main.getInnerHTML().replace(/href="page:([^"]*)"/g, (m, target: string) => {
      const file = fileFor.get(target);
      return file ? `href="${file}"` : m;
    });
    const name = page.getName() || slug;
    const title = !opts.siteName ? name : index === 0 ? opts.siteName : `${name} · ${opts.siteName}`;
    const description = opts.description ? `<meta name="description" content="${escapeHtml(opts.description)}">` : '';

    const style = !css ? '' : external ? `<link rel="stylesheet" href="${slug}.css">` : `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
    const script = !js ? '' : external ? `<script src="${slug}.js" defer></script>` : `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;

    const document = `<!doctype html>
<html lang="${escapeHtml(opts.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${description}
${opts.head ?? ''}
${style}
</head>
<body>
${html}
${script}
</body>
</html>
`;
    return { id: String(page.getId()), name, file: `${slug}.html`, html, css, js, document };
  });
}

/**
 * `{ 'index.html': '…', 'about.html': '…' }`, handy for zipping or uploading.
 * With `assets: 'external'` it also contains the `<slug>.css` and `<slug>.js` files.
 */
export function exportSiteFiles(editor: Editor, opts?: ExportSiteOptions): Record<string, string> {
  const files: Record<string, string> = {};
  for (const p of exportSite(editor, opts)) {
    files[p.file] = p.document;
    if (opts?.assets === 'external') {
      const base = p.file.replace(/\.html$/, '');
      if (p.css) files[`${base}.css`] = p.css;
      if (p.js) files[`${base}.js`] = p.js;
    }
  }
  return files;
}
