import type { Editor } from 'grapesjs';
import { loadAi } from './ai';
import { loadBlocks } from './blocks';
import { loadComponents } from './components';
import { mergeComponents } from './defaults';
import { loadForms } from './forms';
import { loadPages } from './pages';
import { loadPayments } from './payments';
import { en } from './i18n';
import { baseCss } from './styles';
import type { PluginOptions } from './types';

export type * from './types';
export { sanitizeHtml, createFetchGenerator, runAiGeneration, DEFAULT_SYSTEM } from './ai';
export { defaultComponents } from './defaults';
export { baseCss } from './styles';
export * from './define';
export { escapeHtml } from './utils';
export { CHECKOUT_TYPE, DEFAULT_ALLOWED_HOSTS } from './payments';
export { scanFiles, assertSafe, redactSecrets, formatFindings, SecurityError, RULE_IDS } from './security/scan';
export type { Finding, Severity } from './security/scan';
export { securityHeaders, contentSecurityPolicy, originOf } from './security/headers';
export { exportSite, exportSiteFiles, downloadSite, createZip, slugify } from './pages';
export type { ExportedPage, ExportSiteOptions } from './pages';

export const PLUGIN_NAME = 'grapesjs-advance-components';

export default function plugin(editor: Editor, opts: PluginOptions = {}) {
  const components = mergeComponents(opts.components);

  loadComponents(editor);
  loadPayments(editor, opts.payments);
  loadForms(editor);
  loadBlocks(editor, components);

  editor.I18n.addMessages({ en, ...opts.i18n });

  if (opts.injectStyles !== false) editor.Css.addRules(baseCss);
  opts.custom?.forEach((definition) => definition.install(editor));
  if (opts.ai) loadAi(editor, opts.ai);
  if (opts.pages !== false) loadPages(editor, typeof opts.pages === 'object' ? opts.pages : {});
}

// <script>-tag usage: make `plugins: ['grapesjs-advance-components']` work without an import.
const g = (globalThis as { grapesjs?: { plugins?: { add(name: string, fn: typeof plugin): void } } }).grapesjs;
g?.plugins?.add(PLUGIN_NAME, plugin);
g?.plugins?.add('AdvancedComponents', plugin); // v1 name
