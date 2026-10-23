// Render a saved GrapesJS project (JSON) to a static site on the server: no browser, no editor UI.
//
//   npm i grapesjs grapesjs-advance-components jsdom
//   node examples/render-site.mjs project.json ./out
//
// `project.json` is whatever your app stored from `editor.getProjectData()`.
import { JSDOM } from 'jsdom';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const [, , projectFile, outDir = './out'] = process.argv;
if (!projectFile) throw new Error('usage: node render-site.mjs <project.json> [outDir]');

// GrapesJS parses HTML with the DOM, so give Node one before importing it.
const dom = new JSDOM('<!doctype html><html><body><div id="gjs"></div></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
for (const key of ['DOMParser', 'Node', 'Element', 'HTMLElement', 'CustomEvent', 'XMLSerializer']) {
  globalThis[key] ??= dom.window[key];
}

const { default: grapesjs } = await import('grapesjs');
const { default: advanceComponents, exportSiteFiles } = await import('grapesjs-advance-components');

const editor = grapesjs.init({
  headless: true,
  storageManager: false,
  plugins: [advanceComponents],
  projectData: JSON.parse(await readFile(projectFile, 'utf8')),
});

// `assets: 'external'` writes .css/.js files so the site also works under a strict CSP.
const files = exportSiteFiles(editor, { assets: 'external' });
for (const [name, content] of Object.entries(files)) {
  const target = join(outDir, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log('wrote', target);
}
editor.destroy();
