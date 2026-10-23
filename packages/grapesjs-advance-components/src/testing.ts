/**
 * Helpers for testing components made with `defineComponent`. They work with any test runner
 * (failures are plain thrown errors) and need a DOM (jsdom or a browser) and the `grapesjs` peer.
 *
 *   import { mountComponent, testRoundTrip, verifyScript, assertCss } from 'grapesjs-advance-components/testing';
 */
import grapesjs, { type Component, type Editor } from 'grapesjs';
import { assertCss as assertCssString } from './define/css';
import type { ComponentDefinition, TraitMap } from './define/types';

export type TraitValue = string | number | boolean;

/** A headless GrapesJS editor, optionally set up by a plugin function and loaded with project data. */
export function createTestEditor(setup?: (editor: Editor) => void, projectData?: Record<string, unknown>): Editor {
  const container = document.createElement('div');
  document.body.append(container);
  return grapesjs.init({
    container,
    storageManager: false,
    headless: true,
    plugins: setup ? [setup] : [],
    ...(projectData ? { projectData } : {}),
  } as never);
}

export interface Mounted<T extends TraitMap> {
  editor: Editor;
  component: Component;
  get(name: keyof T & string): TraitValue | undefined;
  set(name: keyof T & string, value: TraitValue): void;
  /** The component's exported HTML. */
  html(): string;
  /** The editor's exported CSS (style and cssVar binds live here). */
  css(): string;
  /** The exported HTML rendered into the page, ready for `runScript`. */
  el(): HTMLElement;
}

/** Install `def` into an editor (a fresh one by default) and create one component of it. */
export function mountComponent<T extends TraitMap>(def: ComponentDefinition<T>, opts: { editor?: Editor; values?: Record<string, TraitValue> } = {}): Mounted<T> {
  const editor = opts.editor ?? createTestEditor();
  def.installType(editor);
  const [component] = editor.addComponents({ type: def.id }) as Component[];
  if (!component) throw new Error(`mountComponent: could not create a "${def.id}" component`);
  for (const [name, value] of Object.entries(opts.values ?? {})) def.set(component, name as keyof T & string, value);
  return {
    editor,
    component,
    get: (name) => def.get(component, name),
    set: (name, value) => def.set(component, name, value),
    html: () => component.toHTML(),
    css: () => editor.getCss() ?? '',
    el() {
      const holder = document.createElement('div');
      holder.innerHTML = component.toHTML();
      document.body.append(holder);
      return holder.firstElementChild as HTMLElement;
    },
  };
}

function compile(def: ComponentDefinition<any>): () => void {
  if (!def.scriptSource) throw new Error(`"${def.id}" has no script`);
  // GrapesJS wraps the script body in a function called with the element as `this`; do the same here.
  // It is built in the global scope, with no access to this module's variables, like the published page.
  return new Function(def.scriptSource) as () => void;
}

/** Run the component's published script on `el`, exactly as the exported page would. */
export function runScript(def: ComponentDefinition<any>, el: HTMLElement, opts: { inEditor?: boolean } = {}): void {
  const run = compile(def);
  if (!opts.inEditor) return void run.call(el);
  const original = Object.getOwnPropertyDescriptor(window, 'frameElement');
  Object.defineProperty(window, 'frameElement', { value: { className: 'gjs-frame' }, configurable: true });
  try {
    run.call(el);
  } finally {
    if (original) Object.defineProperty(window, 'frameElement', original);
    else Reflect.deleteProperty(window, 'frameElement');
  }
}

/**
 * Compile the script in isolation and run it once on a sample element. Catches the usual mistake:
 * a script that uses an import or a variable from outside the function works in your editor but
 * throws on the published page. It cannot see references inside event handlers that never fire,
 * so exercise those with `runScript` too.
 */
export function verifyScript(def: ComponentDefinition<any>): void {
  const doc = new DOMParser().parseFromString(`<body>${def.spec.html}</body>`, 'text/html');
  const el = doc.body.firstElementChild as HTMLElement | null;
  if (!el) throw new Error(`verifyScript("${def.id}"): html has no root element`);
  document.body.append(el);
  try {
    runScript(def, el);
  } catch (err) {
    if (err instanceof ReferenceError) {
      throw new Error(`verifyScript("${def.id}"): the script uses a name that does not exist on a published page (${err.message}). Scripts must be self-contained: no imports and no variables from outside the function. Pass shared values through "consts".`);
    }
    throw err;
  } finally {
    el.remove();
  }
}

/** Throws if the component's CSS (or a CSS string) would lose styles in GrapesJS. */
export function assertCss(source: ComponentDefinition<any> | string): void {
  assertCssString(typeof source === 'string' ? source : (source.spec.css ?? ''));
}

/**
 * Set trait values, export, then load the result into a fresh editor two ways (exported HTML with
 * its CSS, and project JSON) and check every trait reads back the same. A failure means some state
 * lives somewhere the markup does not carry, for example a bind whose selector matches nothing.
 */
export function testRoundTrip<T extends TraitMap>(def: ComponentDefinition<T>, values: Record<string, TraitValue> = {}): { html: string; css: string } {
  const a = mountComponent(def, { values });
  const names = Object.keys(def.spec.traits ?? {}) as Array<keyof T & string>;
  const expected = Object.fromEntries(names.map((n) => [n, a.get(n)]));
  const html = a.html();
  const css = a.css();

  const problems: string[] = [];
  const compare = (label: string, editor: Editor) => {
    const root = editor.getWrapper()?.components().at(0);
    if (!root) return void problems.push(`${label}: nothing was loaded`);
    if (root.get('type') !== def.id) problems.push(`${label}: root was recognised as "${String(root.get('type'))}", not "${def.id}" (check detect)`);
    for (const n of names) {
      const got = def.get(root, n);
      if (got !== expected[n]) problems.push(`${label}: trait "${n}" is ${JSON.stringify(got)}, expected ${JSON.stringify(expected[n])}`);
    }
  };

  const fromHtml = createTestEditor();
  def.installType(fromHtml);
  fromHtml.setComponents(`${html}<style>${css}</style>`);
  compare('HTML + CSS round trip', fromHtml);

  const fromJson = createTestEditor();
  def.installType(fromJson);
  fromJson.loadProjectData(a.editor.getProjectData());
  compare('project JSON round trip', fromJson);

  if (problems.length) throw new Error(`testRoundTrip("${def.id}") failed:\n  - ${problems.join('\n  - ')}`);
  return { html, css };
}
