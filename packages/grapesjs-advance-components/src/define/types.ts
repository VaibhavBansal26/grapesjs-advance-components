import type { Component, Editor } from 'grapesjs';

export type TraitType = 'text' | 'number' | 'select' | 'checkbox' | 'color';

/**
 * Where a trait's value lives in the markup. The HTML is the source of truth, so the value
 * survives export, re-import and `promptsite build`. Without a `bind` a trait is stored as a
 * `data-<name>` attribute on the root.
 *
 * `on` is a selector (see the docs for the supported subset) relative to the component's root.
 */
export type Bind =
  | { attr: string; on?: string }
  | { text: string }
  | { style: string; unit?: string; on?: string }
  | { cssVar: string; on?: string }
  | { class: Record<string, string>; on?: string }
  | { classIf: string; on?: string };

export interface TraitSpec {
  type: TraitType;
  label?: string;
  default?: string | number | boolean;
  placeholder?: string;
  /** `select` only. Strings are used as both value and label. */
  options?: ReadonlyArray<string | { value: string; label?: string }>;
  /** `number` only. Values written to the markup are clamped to this range. */
  min?: number;
  max?: number;
  step?: number;
  bind?: Bind | ReadonlyArray<Bind>;
  /** Stored like any trait but not shown in the trait panel. */
  ui?: false;
}

export type TraitMap = Record<string, TraitSpec>;

type ValueOf<S extends TraitSpec> = S['type'] extends 'number' ? number : S['type'] extends 'checkbox' ? boolean : string;
type BindOf<S> = S extends { bind: infer B } ? (B extends ReadonlyArray<unknown> ? B[number] : B) : never;
/** style and cssVar binds are visual only: a published page cannot read them back reliably. */
type VisualOnly<S> = [BindOf<S>] extends [never] ? false : [BindOf<S>] extends [{ style: string } | { cssVar: string }] ? true : false;

/** Typed trait values available to the runtime `script`. Visual-only traits are not included. */
export type Props<T extends TraitMap> = { [K in keyof T as VisualOnly<T[K]> extends true ? never : K]: ValueOf<T[K]> };

export interface ScriptContext<P = Record<string, unknown>, C = Record<string, unknown>> {
  /** The component's root element on the published page. */
  el: HTMLElement;
  /** Trait values read from the markup and converted to their types. */
  props: P;
  /** Values passed in `consts`, embedded in the script. */
  consts: C;
  /** True inside the GrapesJS canvas. The script does not run there unless `runInEditor` is set. */
  inEditor: boolean;
  /** Dispatch a bubbling CustomEvent from `el`. Returns false if a listener called preventDefault (when `cancelable`). */
  emit(name: string, detail?: unknown, cancelable?: boolean): boolean;
}

export interface BlockSpec {
  /** Block id. Default `<id>-block`. */
  id?: string;
  label?: string;
  category?: string;
}

export interface ComponentSpec<T extends TraitMap = TraitMap, C extends Record<string, unknown> = Record<string, unknown>> {
  /** GrapesJS component type id. Unique per editor; prefix it (`acme-testimonial`) to avoid clashes. */
  id: string;
  label: string;
  category?: string;
  /** SVG markup (or a short text such as an emoji) for the block tile. */
  icon?: string;
  /** Exactly one root element. Its tag and attributes become the component's own. */
  html: string;
  /**
   * How saved HTML is recognised again. A selector (tag, .class, #id, [attr], [attr=value]) or a
   * function of the DOM element. Default: the first class on the root element.
   */
  detect?: string | ((el: Element) => boolean);
  /** A GrapesJS base type to extend, for example `'text'` to make the root itself editable text. */
  extend?: string;
  traits?: T;
  /** Child elements editable as rich text. Selectors relative to the root. */
  editable?: string[];
  /** Children cannot be dragged, removed, copied or dropped into (except `editable` and `repeat` parts). */
  locked?: boolean;
  /** Children users may add, copy, remove and reorder. Their parent only accepts drops of the same kind. */
  repeat?: string[];
  droppable?: boolean | string;
  removable?: boolean;
  copyable?: boolean;
  /** Component CSS. Checked by the same guard as the built-in stylesheet. */
  css?: string;
  /** Runs on the published page. Must be self-contained: no imports and no captured variables. */
  script?: (ctx: ScriptContext<Props<T>, C>) => void;
  /** Values embedded in the script at install time (for example an allow-list). Must be JSON-serialisable. */
  consts?: C;
  /** Run `script` inside the editor canvas too. Default false, so published behaviour does not fire while editing. */
  runInEditor?: boolean;
  /** `false` registers the type without a block. */
  block?: false | BlockSpec;
}

export interface BlockOverrides {
  label?: string;
  category?: string;
  /** HTML placed inside the dropped component's root, instead of the default children. */
  content?: string;
  /** Trait values for the dropped component, by trait name. */
  values?: Record<string, string | number | boolean>;
}

export interface ComponentDefinition<T extends TraitMap = TraitMap> {
  readonly id: string;
  readonly spec: Readonly<ComponentSpec<T, any>>;
  /** The self-contained script body GrapesJS inlines on the published page, or undefined without a `script`. */
  readonly scriptSource: string | undefined;
  /** Register the type, its block and its CSS. */
  install(editor: Editor): void;
  installType(editor: Editor): void;
  installBlock(editor: Editor, overrides?: BlockOverrides): void;
  /** Read a trait from a component, typed and with defaults applied. */
  get<K extends keyof T & string>(component: Component, name: K): string | number | boolean | undefined;
  /** Write a trait to a component. The markup is updated. */
  set<K extends keyof T & string>(component: Component, name: K, value: string | number | boolean): void;
}
