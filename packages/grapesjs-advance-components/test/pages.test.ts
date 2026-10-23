import grapesjs, { type Editor } from 'grapesjs';
import { afterEach, describe, expect, it } from 'vitest';
import plugin, { createZip, exportSite, exportSiteFiles, slugify } from '../src';
import { crc32 } from '../src/pages/zip';

let editors: Editor[] = [];
function make() {
  const el = document.createElement('div');
  document.body.append(el);
  const editor = grapesjs.init({ container: el, storageManager: false, headless: true, plugins: [(ed) => plugin(ed)] });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.forEach((e) => e.destroy());
  editors = [];
  document.body.innerHTML = '';
});

describe('multi-page', () => {
  it('registers the commands unless pages are disabled', () => {
    const editor = make();
    expect(editor.Commands.has('aac:pages')).toBe(true);
    expect(editor.Commands.has('aac:download-site')).toBe(true);

    const el = document.createElement('div');
    const off = grapesjs.init({ container: el, storageManager: false, headless: true, plugins: [(ed) => plugin(ed, { pages: false })] });
    editors.push(off);
    expect(off.Commands.has('aac:pages')).toBe(false);
  });

  it('exports each page as its own document with the first as index.html', () => {
    const editor = make();
    editor.Pages.get(editor.Pages.getAll()[0]!.getId())!.getMainComponent().components('<h1>Home</h1><a href="page:about-us">About</a>');
    const about = editor.Pages.add({ name: 'About us', component: '<h1>About</h1><p>Hi & welcome</p>' });
    expect(about).toBeTruthy();

    const pages = exportSite(editor);
    expect(pages.map((p) => p.file)).toEqual(['index.html', 'about-us.html']);
    expect(pages[0]!.document).toMatch(/^<!doctype html>/);
    expect(pages[0]!.html).toContain('href="about-us.html"');
    expect(pages[0]!.document).toContain('<title>');
    expect(pages[1]!.html).toContain('About');
    expect(pages[1]!.html).not.toContain('Home');
  });

  it('escapes page names in <title> and de-duplicates file names', () => {
    const editor = make();
    editor.Pages.add({ name: '<script>x</script>', component: '' });
    editor.Pages.add({ name: 'Team', component: '' });
    editor.Pages.add({ name: 'team', component: '' });
    const files = exportSiteFiles(editor);
    expect(Object.keys(files)).toEqual(['index.html', 'script-x-script.html', 'team.html', 'team-2.html']);
    expect(files['script-x-script.html']).toContain('<title>&lt;script&gt;x&lt;/script&gt;</title>');
    expect(files['script-x-script.html']).not.toContain('<title><script>');
  });

  it('includes component scripts so exported checkout buttons work', () => {
    const editor = make();
    editor.Pages.getAll()[0]!.getMainComponent().components(
      '<button type="button" class="aac-button aac-checkout" data-url="https://buy.stripe.com/test_1">Buy</button>',
    );
    const [home] = exportSite(editor);
    expect(home!.js).toContain('aac:checkout');
    expect(home!.js).toContain('buy.stripe.com'); // the redirect allow-list travels with the script
    expect(home!.document).toContain('data-url="https://buy.stripe.com/test_1"'); // the setting travels in the markup
    expect(home!.document).toMatch(/<script>[\s\S]*aac:checkout[\s\S]*<\/script>/);
  });

  it('omits the script tag on pages without scripts', () => {
    const editor = make();
    editor.Pages.getAll()[0]!.getMainComponent().components('<p>plain</p>');
    expect(exportSite(editor)[0]!.document).not.toContain('<script');
  });

  it('assets: external writes linked css/js files and no inline style or script', () => {
    const editor = make();
    editor.Pages.getAll()[0]!.getMainComponent().components([
      { tagName: 'p', content: 'x', style: { color: 'red' } },
      { type: 'aac-checkout-button' },
    ]);
    const files = exportSiteFiles(editor, { assets: 'external' });
    expect(Object.keys(files).sort()).toEqual(['index.css', 'index.html', 'index.js']);
    expect(files['index.html']).toContain('<link rel="stylesheet" href="index.css">');
    expect(files['index.html']).toContain('<script src="index.js" defer></script>');
    expect(files['index.html']).not.toMatch(/<style|<script>/);
    expect(files['index.js']).toContain('aac:checkout');
  });

  it('builds page titles and a meta description from siteName and description', () => {
    const editor = make();
    editor.Pages.add({ name: 'About', component: '' });
    const [home, about] = exportSite(editor, { siteName: 'Acme & Sons', description: 'We "make" things' });
    expect(home!.document).toContain('<title>Acme &amp; Sons</title>');
    expect(about!.document).toContain('<title>About · Acme &amp; Sons</title>');
    expect(about!.document).toContain('<meta name="description" content="We &quot;make&quot; things">');
    expect(exportSite(editor)[0]!.document).not.toContain('name="description"');
  });

  it('securityHeaders adds a _headers file and requires external assets', () => {
    const editor = make();
    editor.Pages.getAll()[0]!.getMainComponent().components('<p>x</p>');
    const files = exportSiteFiles(editor, { assets: 'external', securityHeaders: { connectOrigins: ['https://api.example.com', undefined] } });
    expect(files._headers).toContain("connect-src 'self' https://api.example.com;");
    expect(() => exportSiteFiles(editor, { securityHeaders: true })).toThrow(/assets: "external"/);
    expect(exportSiteFiles(editor, { assets: 'external' })._headers).toBeUndefined();
  });

  it('slugifies', () => {
    expect(slugify('Über Us!')).toBe('uber-us');
    expect(slugify('***')).toBe('page');
  });
});

describe('zip writer', () => {
  it('crc32 matches the known check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes a structurally valid archive', () => {
    const bytes = createZip({ 'index.html': '<p>é</p>', 'a/b.txt': 'hi' });
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const eocd = bytes.byteLength - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocd + 10, true)).toBe(2); // entries
    const centralOffset = dv.getUint32(eocd + 16, true);
    expect(dv.getUint32(centralOffset, true)).toBe(0x02014b50);
  });
});
