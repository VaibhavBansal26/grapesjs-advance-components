import type { Editor } from 'grapesjs';
import type { PagesOptions } from '../types';
import { exportSiteFiles } from './export';
import { createZip } from './zip';

export { exportSite, exportSiteFiles, slugify } from './export';
export type { ExportedPage, ExportSiteOptions } from './export';
export { createZip } from './zip';

const t = (editor: Editor, key: string, fallback: string) => {
  const out = editor.I18n.t(`aac.pages.${key}`) as string | undefined;
  return out && out !== `aac.pages.${key}` ? out : fallback;
};

export function downloadSite(editor: Editor, fileName = 'site.zip') {
  const bytes = createZip(exportSiteFiles(editor));
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openPagesModal(editor: Editor) {
  const doc = document;
  const root = doc.createElement('div');
  root.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  const list = doc.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  const btn = (text: string) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.style.cssText = 'padding:6px 12px;cursor:pointer;';
    return b;
  };

  const render = () => {
    list.replaceChildren();
    const pages = editor.Pages.getAll();
    const selected = editor.Pages.getSelected();
    pages.forEach((page, i) => {
      const row = doc.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;';
      const name = doc.createElement('input');
      name.value = page.getName() || `Page ${i + 1}`;
      name.setAttribute('aria-label', t(editor, 'name', 'Page name'));
      name.style.cssText = 'flex:1;padding:6px;color:#111;';
      name.addEventListener('change', () => page.set('name', name.value.trim() || `Page ${i + 1}`));
      const open = btn(page === selected ? t(editor, 'current', 'Editing') : t(editor, 'open', 'Open'));
      open.disabled = page === selected;
      open.addEventListener('click', () => {
        editor.Pages.select(page);
        render();
      });
      const del = btn('✕');
      del.title = t(editor, 'delete', 'Delete page');
      del.disabled = pages.length === 1;
      del.addEventListener('click', () => {
        editor.Pages.remove(page);
        render();
      });
      row.append(name, open, del);
      list.append(row);
    });
  };

  const actions = doc.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:space-between;';
  const add = btn(t(editor, 'add', '+ Add page'));
  add.addEventListener('click', () => {
    const n = editor.Pages.getAll().length + 1;
    const page = editor.Pages.add({ name: `Page ${n}`, component: '' });
    if (page && typeof page !== 'string') editor.Pages.select(page);
    render();
  });
  const dl = btn(t(editor, 'download', 'Download site (.zip)'));
  dl.addEventListener('click', () => downloadSite(editor));
  actions.append(add, dl);

  root.append(list, actions);
  render();
  editor.Modal.open({ title: t(editor, 'title', 'Pages'), content: root });
}

export function loadPages(editor: Editor, opts: PagesOptions = {}) {
  editor.Commands.add('aac:pages', { run: (ed) => openPagesModal(ed) });
  editor.Commands.add('aac:download-site', { run: (ed) => downloadSite(ed) });

  if (opts.panel === false) return;
  editor.onReady(() => {
    editor.Panels?.addButton?.('options', {
      id: 'aac-pages',
      label: '📄',
      attributes: { title: t(editor, 'title', 'Pages') },
      command: 'aac:pages',
      togglable: false,
    });
  });
}
