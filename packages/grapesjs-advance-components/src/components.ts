import type { Editor } from 'grapesjs';
import { hero, progressBar, quote } from './builtin';

/** Register the built-in types that are made with `defineComponent`. Their blocks come from `loadBlocks`. */
export function loadComponents(editor: Editor) {
  [progressBar, quote, hero].forEach((def) => def.installType(editor));
}
