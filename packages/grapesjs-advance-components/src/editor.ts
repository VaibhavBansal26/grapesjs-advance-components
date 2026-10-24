import grapesjs, { type Editor, type EditorConfig } from 'grapesjs';
import plugin from './index';
import type { PluginOptions } from './types';

export interface CreateEditorOptions extends Omit<EditorConfig, 'plugins' | 'pluginsOpts' | 'container' | 'storageManager' | 'projectData'> {
  /** Where to mount the editor: a selector or an element. */
  container: string | HTMLElement;
  /** Options for this plugin, for example `{ custom: [myComponent], ai: { generate } }`. */
  plugin?: PluginOptions;
  /** Other GrapesJS plugins to load alongside. */
  plugins?: EditorConfig['plugins'];
  /** A saved project, as returned by `editor.getProjectData()`. */
  projectData?: EditorConfig['projectData'];
  /**
   * Where the project is kept. `'local'` (default) autosaves in this browser under `storageKey`.
   * `false` turns storage off. Pass a GrapesJS `storageManager` object for your own backend.
   */
  storage?: 'local' | false | EditorConfig['storageManager'];
  /** The `localStorage` key for `storage: 'local'`. Default `aac-project`. */
  storageKey?: string;
  /** Called once the editor is ready, with the editor. */
  onReady?: (editor: Editor) => void;
}

/**
 * Create a GrapesJS editor with this plugin already set up, in one call.
 *
 * ```js
 * import 'grapesjs/dist/css/grapes.min.css';
 * import { createEditor } from 'grapesjs-advance-components/editor';
 * const editor = createEditor({ container: '#editor', plugin: { custom: [testimonial] } });
 * ```
 *
 * Everything GrapesJS accepts in `grapesjs.init` is passed through, so this never gets in the way.
 * It lives in its own entry because it imports `grapesjs`; the main entry does not, so pages that
 * load GrapesJS from a `<script>` tag are unaffected.
 */
export function createEditor(options: CreateEditorOptions): Editor {
  const { plugin: pluginOptions, plugins = [], storage = 'local', storageKey = 'aac-project', onReady, ...rest } = options;
  const storageManager =
    storage === false
      ? false
      : storage === 'local'
        ? { type: 'local', autosave: true, stepsBeforeSave: 1, options: { local: { key: storageKey } } }
        : storage;
  const editor = grapesjs.init({
    height: '100vh',
    ...rest,
    storageManager: storageManager as EditorConfig['storageManager'],
    plugins: [...plugins, (ed: Editor) => plugin(ed, pluginOptions)],
  });
  if (onReady) editor.onReady(() => onReady(editor));
  return editor;
}

export type { Editor };
