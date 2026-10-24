import type { Editor } from 'grapesjs';
import { form, hero, progressBar, quote } from './builtin';
import { sections } from './sections';

/** Register the built-in types that are made with `defineComponent`. Their blocks come from `loadBlocks`. */
export function loadComponents(editor: Editor) {
  [progressBar, quote, hero, form, ...sections].forEach((def) => def.installType(editor));
}
