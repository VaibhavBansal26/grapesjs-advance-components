import type { Component, Editor } from 'grapesjs';
import { blockLabel } from '../ui';
import { compileTraits, fromRaw, normalize, readBinds, toRaw, writeBinds, type CompiledTrait, type Value } from './binds';
import { formatCssIssues, selectorKeys, validateCss } from './css';
import { DefineComponentError } from './errors';
import { buildScript } from './runtime';
import { assertSelector, descendants, queryAll } from './selector';
import type { BlockOverrides, ComponentDefinition, ComponentSpec, TraitMap } from './types';

const ID = /^[a-z][a-z0-9-]*$/;

/**
 * Model property that holds a trait's value when it is not a plain root attribute. Prefixed so a
 * trait called `name` or `content` can never collide with a GrapesJS component property.
 */
export const propKey = (trait: string): string => `aac_${trait}`;

interface Parsed {
  tagName: string;
  attributes: Record<string, string>;
  inner: string;
}

interface EditorState {
  defs: Map<string, unknown>;
  cssOwners: Map<string, string>;
}
const states = new WeakMap<Editor, EditorState>();
const stateOf = (editor: Editor): EditorState => {
  let s = states.get(editor);
  if (!s) states.set(editor, (s = { defs: new Map(), cssOwners: new Map() }));
  return s;
};

/** Everything needing a DOM (the html is parsed once, at install time). */
function parseRoot(id: string, spec: ComponentSpec<any, any>, detect: string | ((el: Element) => boolean), traits: CompiledTrait[]): Parsed {
  if (typeof DOMParser === 'undefined') throw new DefineComponentError(id, 'needs a DOM (a browser, or jsdom in Node) to install');
  const doc = new DOMParser().parseFromString(`<body>${spec.html}</body>`, 'text/html');
  const nodes = Array.from(doc.body.childNodes).filter((n) => n.nodeType !== 8 && !(n.nodeType === 3 && !n.textContent!.trim()));
  if (nodes.length !== 1 || nodes[0]!.nodeType !== 1) throw new DefineComponentError(id, `html must have exactly one root element (found ${nodes.length} top-level nodes)`);
  const root = nodes[0] as Element;
  if (root.hasAttribute('style')) throw new DefineComponentError(id, 'put styles for the root in css, not in an inline style attribute');
  if (typeof detect === 'string' && !root.matches(detect)) throw new DefineComponentError(id, `detect "${detect}" does not match the root element of html`);

  const mustMatch = (selector: string, what: string) => {
    const hits = root.querySelectorAll(selector);
    if (!hits.length) throw new DefineComponentError(id, `${what} "${selector}" matches nothing in html`);
    return hits;
  };
  for (const t of traits) for (const b of t.binds) if ('on' in b && b.on) mustMatch(b.on, `trait "${t.name}" bind target`);
  for (const sel of spec.editable ?? []) mustMatch(sel, 'editable selector').forEach((el) => el.setAttribute('data-gjs-type', 'text'));
  for (const sel of spec.repeat ?? []) mustMatch(sel, 'repeat selector');

  return {
    tagName: root.tagName.toLowerCase(),
    attributes: Object.fromEntries(Array.from(root.attributes).map((a) => [a.name, a.value])),
    inner: root.innerHTML,
  };
}

function applyEditing(root: Component, spec: ComponentSpec<any, any>): void {
  const items = new Set<Component>((spec.repeat ?? []).flatMap((s) => queryAll(root, s)));
  if (spec.locked) {
    for (const c of descendants(root)) {
      if (items.has(c)) c.set({ draggable: true, removable: true, copyable: true });
      else c.set({ draggable: false, removable: false, copyable: false, droppable: false });
    }
  }
  const accepts = new Map<Component, string[]>();
  for (const sel of spec.repeat ?? []) {
    for (const item of queryAll(root, sel)) {
      const parent = item.parent() as Component | undefined;
      if (parent) accepts.set(parent, [...(accepts.get(parent) ?? []), sel]);
    }
  }
  for (const [container, sels] of accepts) container.set({ droppable: [...new Set(sels)].join(',') });
}

/** Run on every new instance of the type: adopt state from the markup, or write defaults into it. */
function setup(model: Component, traits: CompiledTrait[], spec: ComponentSpec<any, any>): void {
  for (const t of traits) {
    if (t.native) {
      const present = (model.getAttributes() as Record<string, unknown>)[t.attr];
      if (present === undefined && t.spec.default !== undefined) model.addAttributes({ [t.attr]: toRaw(t.spec, normalize(t.spec, t.spec.default)) });
      continue;
    }
    const key = propKey(t.name);
    const dom = readBinds(model, t);
    // GrapesJS seeds every changeProp trait with '' before init runs, so '' means "not set".
    const pre = model.get(key);
    if (pre !== undefined && pre !== '') {
      // Restored from project JSON, or given by a block: keep the markup consistent with it.
      const v = normalize(t.spec, pre);
      if (dom !== toRaw(t.spec, v)) writeBinds(model, t, v);
      model.set(key, v ?? '', { silent: true });
    } else {
      const fallback = t.spec.default === undefined ? undefined : normalize(t.spec, t.spec.default);
      const v = fromRaw(t.spec, dom) ?? fallback;
      if (v !== undefined) model.set(key, v, { silent: true });
      if (dom === undefined && v !== undefined) writeBinds(model, t, v);
    }
    model.on(`change:${key}`, () => {
      const current = model.get(key);
      const v = normalize(t.spec, current);
      if (v !== undefined && v !== current) return void model.set(key, v); // e.g. clamp "250" to the range; re-enters once
      writeBinds(model, t, current);
    });
  }
  applyEditing(model, spec);
}

export function defineComponent<const T extends TraitMap = {}, C extends Record<string, unknown> = Record<string, unknown>>(
  spec: ComponentSpec<T, C>,
): ComponentDefinition<T> {
  const id = typeof spec?.id === 'string' ? spec.id : '(missing id)';
  const fail = (m: string): never => {
    throw new DefineComponentError(id, m);
  };
  if (!spec || typeof spec !== 'object') throw new DefineComponentError(id, 'expects a spec object');
  if (!ID.test(spec.id ?? '')) fail('id must be kebab-case: lowercase letters, digits and hyphens, starting with a letter');
  if (typeof spec.label !== 'string' || !spec.label.trim()) fail('label is required');
  if (typeof spec.html !== 'string' || !spec.html.trim()) fail('html is required and needs exactly one root element');
  if (spec.extend !== undefined && typeof spec.extend !== 'string') fail('extend must be the id of a GrapesJS component type');
  if (spec.css !== undefined && typeof spec.css !== 'string') fail('css must be a string');

  const rootTag = /^\s*<([a-zA-Z][\w-]*)\b([^>]*)>/.exec(spec.html);
  if (!rootTag) fail('html must start with the root element');
  let detect = spec.detect;
  if (detect === undefined) {
    const cls = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rootTag![2]!);
    const first = (cls?.[1] ?? cls?.[2] ?? '').trim().split(/\s+/)[0];
    if (!first) fail('the root element needs a class (it is how saved HTML is recognised again), or pass detect');
    detect = `.${first}`;
  }
  if (typeof detect === 'string') {
    try {
      assertSelector(detect);
    } catch (e) {
      fail(`detect: ${(e as Error).message}`);
    }
  } else if (typeof detect !== 'function') fail('detect must be a selector string or a function');

  for (const [what, list] of [['editable', spec.editable], ['repeat', spec.repeat]] as const) {
    if (list === undefined) continue;
    if (!Array.isArray(list)) fail(`${what} must be a list of selectors`);
    for (const sel of list) {
      try {
        assertSelector(sel);
      } catch (e) {
        fail(`${what}: ${(e as Error).message}`);
      }
    }
  }
  if (spec.block !== undefined && spec.block !== false && typeof spec.block !== 'object') fail('block must be false or an object');

  const traits = compileTraits(spec.id, spec.traits);
  const scriptSource = buildScript(spec.id, spec as ComponentSpec<never, never>, traits);

  let parsed: Parsed | undefined;
  const getParsed = () => (parsed ??= parseRoot(spec.id, spec, detect!, traits));
  const byName = (name: string): CompiledTrait => traits.find((t) => t.name === name) ?? fail(`unknown trait "${name}" (traits: ${traits.map((t) => t.name).join(', ') || 'none'})`);

  const panelTraits = traits
    .filter((t) => t.spec.ui !== false)
    .map((t) => {
      const base: Record<string, unknown> = {
        type: t.spec.type,
        name: t.native ? t.attr : propKey(t.name),
        label: t.spec.label ?? t.name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
        changeProp: !t.native,
      };
      if (t.spec.placeholder) base.placeholder = t.spec.placeholder;
      if (t.spec.type === 'select') base.options = (t.spec.options ?? []).map((o) => (typeof o === 'string' ? { id: o, label: o } : { id: o.value, label: o.label ?? o.value }));
      if (t.spec.type === 'number') for (const k of ['min', 'max', 'step'] as const) if (t.spec[k] !== undefined) base[k] = t.spec[k];
      if (t.spec.type === 'checkbox' && t.native) Object.assign(base, { valueTrue: 'true', valueFalse: 'false' });
      return base;
    });

  const definition: ComponentDefinition<T> = {
    id: spec.id,
    spec,
    scriptSource,

    installType(editor) {
      const st = stateOf(editor);
      const existing = st.defs.get(spec.id);
      if (existing) {
        if (existing === definition) return; // installing the same definition twice is harmless
        fail('is already installed with a different definition');
      }
      if (editor.Components.getType(spec.id)) fail(`"${spec.id}" is already a GrapesJS component type. Choose another id, for example "acme-${spec.id}".`);
      const p = getParsed();
      const matches = (el: Element) => {
        try {
          return typeof detect === 'function' ? !!detect(el) : el.matches(detect!);
        } catch {
          return false;
        }
      };
      const defaults: Record<string, unknown> = { name: spec.label, tagName: p.tagName, attributes: p.attributes };
      if (p.inner.trim()) defaults.components = p.inner;
      if (panelTraits.length) defaults.traits = panelTraits;
      if (scriptSource) defaults.script = scriptSource;
      const droppable = spec.droppable ?? (spec.locked && !spec.repeat?.length ? false : undefined);
      if (droppable !== undefined) defaults.droppable = droppable;
      if (spec.removable !== undefined) defaults.removable = spec.removable;
      if (spec.copyable !== undefined) defaults.copyable = spec.copyable;

      editor.Components.addType(spec.id, {
        ...(spec.extend ? { extend: spec.extend } : {}),
        isComponent: (el: HTMLElement) => (el.nodeType === 1 && matches(el) ? { type: spec.id } : undefined),
        model: {
          defaults,
          init(this: Component) {
            setup(this, traits, spec);
          },
        },
      });
      st.defs.set(spec.id, definition);

      if (spec.css) {
        const issues = validateCss(spec.css);
        if (issues.length) console.warn(`[defineComponent("${spec.id}")] CSS problems:\n${formatCssIssues(issues)}`);
        for (const key of selectorKeys(spec.css)) {
          const owner = st.cssOwners.get(key);
          if (owner && owner !== spec.id) console.warn(`[defineComponent("${spec.id}")] ${key.split('|')[1]} is also declared by "${owner}"; GrapesJS keeps only the last rule.`);
          st.cssOwners.set(key, spec.id);
        }
        editor.Css.addRules(spec.css);
      }
    },

    installBlock(editor, overrides: BlockOverrides = {}) {
      if (spec.block === false) return;
      const b = spec.block ?? {};
      const blockId = b.id ?? `${spec.id}-block`;
      if (editor.Blocks.get(blockId)) return;
      const content: Record<string, unknown> = { type: spec.id };
      if (overrides.content !== undefined) content.components = overrides.content;
      const native: Record<string, string> = {};
      for (const [name, raw] of Object.entries(overrides.values ?? {})) {
        const t = byName(name);
        const v = normalize(t.spec, raw);
        if (t.native) native[t.attr] = toRaw(t.spec, v);
        else content[propKey(name)] = v ?? '';
      }
      if (Object.keys(native).length) content.attributes = { ...getParsed().attributes, ...native };
      editor.Blocks.add(blockId, {
        label: blockLabel(spec.icon, overrides.label ?? b.label ?? spec.label),
        category: overrides.category ?? b.category ?? spec.category,
        content,
      });
    },

    install(editor) {
      definition.installType(editor);
      definition.installBlock(editor);
    },

    get(component, name) {
      const t = byName(name);
      const fallback = t.spec.default === undefined ? undefined : normalize(t.spec, t.spec.default);
      if (t.native) return fromRaw(t.spec, (component.getAttributes() as Record<string, string | undefined>)[t.attr]) ?? fallback;
      const stored = component.get(propKey(name));
      if (stored !== undefined && stored !== '') return normalize(t.spec, stored) ?? (t.spec.type === 'number' ? undefined : (stored as Value));
      return fromRaw(t.spec, readBinds(component, t)) ?? fallback;
    },

    set(component, name, value) {
      const t = byName(name);
      if (t.native) return void writeBinds(component, t, value);
      const v = normalize(t.spec, value);
      component.set(propKey(name), v === undefined ? '' : v);
    },
  };
  return definition;
}
