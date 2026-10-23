import type { Component } from 'grapesjs';
import { DefineComponentError } from './errors';
import { assertSelector, queryAll } from './selector';
import type { Bind, TraitMap, TraitSpec, TraitType } from './types';

export type NormBind =
  | { kind: 'attr'; attr: string; on?: string }
  | { kind: 'text'; on: string }
  | { kind: 'style'; prop: string; unit: string; on?: string }
  | { kind: 'class'; map: Record<string, string>; on?: string }
  | { kind: 'classIf'; cls: string; on?: string };

export interface CompiledTrait {
  name: string;
  spec: TraitSpec;
  binds: NormBind[];
  /** One plain attribute on the root: GrapesJS's own attribute trait handles it, no listeners needed. */
  native: boolean;
  /** The attribute for a native trait. */
  attr: string;
  /** Binds a published page can read back (everything except style and custom properties). */
  readable: NormBind[];
}

const TYPES: TraitType[] = ['text', 'number', 'select', 'checkbox', 'color'];
const NAME = /^[a-z][A-Za-z0-9]*$/;
const ATTR = /^[a-zA-Z_:][-\w:.]*$/;
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
export const splitClasses = (s: string): string[] => String(s).split(/\s+/).filter(Boolean);

const optionValues = (spec: TraitSpec): string[] => (spec.options ?? []).map((o) => (typeof o === 'string' ? o : o.value));

function normalizeBind(id: string, trait: string, spec: TraitSpec, b: Bind): NormBind {
  const fail = (m: string): never => {
    throw new DefineComponentError(id, `trait "${trait}": ${m}`);
  };
  const keys = ['attr', 'text', 'style', 'cssVar', 'class', 'classIf'].filter((k) => k in (b as object));
  if (keys.length !== 1) fail(`a bind needs exactly one of attr, text, style, cssVar, class or classIf (got ${keys.join(', ') || 'none'})`);
  const on = (b as { on?: string }).on;
  const checkSel = (sel: string) => {
    try {
      assertSelector(sel);
    } catch (e) {
      fail((e as Error).message);
    }
  };
  if (on !== undefined) checkSel(on);

  if ('attr' in b) {
    if (!ATTR.test(b.attr)) fail(`"${b.attr}" is not a valid attribute name`);
    if (b.attr === 'class' || b.attr === 'style') fail(`bind ${b.attr === 'class' ? 'a class' : 'a style'} with { ${b.attr === 'class' ? 'class' : 'style'}: … }, not attr`);
    return { kind: 'attr', attr: b.attr, on };
  }
  if ('text' in b) {
    checkSel(b.text);
    return { kind: 'text', on: b.text };
  }
  if ('style' in b) return { kind: 'style', prop: b.style, unit: b.unit ?? '', on };
  if ('cssVar' in b) {
    if (!b.cssVar.startsWith('--')) fail(`cssVar "${b.cssVar}" must start with "--"`);
    return { kind: 'style', prop: b.cssVar, unit: '', on };
  }
  if ('class' in b) {
    if (spec.type !== 'select') fail('a class map only works with a select trait; use classIf for a checkbox');
    const values = optionValues(spec);
    for (const key of Object.keys(b.class)) if (!values.includes(key)) fail(`class map key "${key}" is not one of the options (${values.join(', ')})`);
    return { kind: 'class', map: { ...b.class }, on };
  }
  if (spec.type !== 'checkbox') fail('classIf only works with a checkbox trait; use a class map for a select');
  return { kind: 'classIf', cls: b.classIf, on };
}

export function compileTraits(id: string, traits: TraitMap | undefined): CompiledTrait[] {
  const out: CompiledTrait[] = [];
  const nativeAttrs = new Set<string>();
  for (const [name, spec] of Object.entries(traits ?? {})) {
    const fail = (m: string): never => {
      throw new DefineComponentError(id, `trait "${name}": ${m}`);
    };
    if (!NAME.test(name)) fail('use a camelCase name (letters and digits, starting with a lowercase letter)');
    if (!TYPES.includes(spec.type)) fail(`type must be one of ${TYPES.join(', ')} (got "${String(spec.type)}")`);
    if (spec.type === 'select') {
      if (!spec.options?.length) fail('a select needs options');
      if (spec.default !== undefined && !optionValues(spec).includes(String(spec.default))) fail(`default "${spec.default}" is not one of the options`);
    }
    if (spec.type === 'number') {
      if (spec.min !== undefined && spec.max !== undefined && spec.min > spec.max) fail('min is greater than max');
      if (spec.default !== undefined && typeof spec.default !== 'number') fail('a number trait needs a number default');
    }
    if (spec.type === 'checkbox' && spec.default !== undefined && typeof spec.default !== 'boolean') fail('a checkbox needs a boolean default');
    if ((spec.type === 'text' || spec.type === 'color' || spec.type === 'select') && spec.default !== undefined && typeof spec.default !== 'string') fail(`a ${spec.type} trait needs a string default`);

    const raw: ReadonlyArray<Bind> = spec.bind === undefined ? [{ attr: `data-${kebab(name)}` }] : Array.isArray(spec.bind) ? (spec.bind as ReadonlyArray<Bind>) : [spec.bind as Bind];
    if (!raw.length) fail('bind is an empty list');
    const binds = raw.map((b) => normalizeBind(id, name, spec, b));
    const first = binds[0]!;
    const native = binds.length === 1 && first.kind === 'attr' && !first.on;
    const attr = native ? (first as { attr: string }).attr : '';
    if (native) {
      if (nativeAttrs.has(attr)) fail(`attribute "${attr}" is already used by another trait`);
      nativeAttrs.add(attr);
    }
    out.push({ name, spec, binds, native, attr, readable: binds.filter((b) => b.kind !== 'style') });
  }
  return out;
}

/* ---------- values ---------- */

export type Value = string | number | boolean;

/** Coerce to the trait's type, apply the number range, and return undefined for "no value". */
export function normalize(spec: TraitSpec, value: unknown): Value | undefined {
  if (spec.type === 'number') {
    if (value === '' || value === null || value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, n));
  }
  if (spec.type === 'checkbox') return value === true || value === 'true';
  return value === undefined || value === null ? undefined : String(value);
}

export const toRaw = (spec: TraitSpec, v: Value | undefined): string =>
  v === undefined ? '' : spec.type === 'checkbox' ? (v ? 'true' : 'false') : String(v);

export function fromRaw(spec: TraitSpec, raw: string | undefined): Value | undefined {
  if (raw === undefined) return undefined;
  if (spec.type === 'number') {
    if (raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  if (spec.type === 'checkbox') return raw === 'true';
  return raw;
}

/* ---------- reading and writing the component tree ---------- */

const targetsOf = (root: Component, b: NormBind): Component[] => (b.on ? queryAll(root, b.on) : [root]);

function textOf(c: Component): string {
  const kids = c.components();
  if (kids.length) return kids.map((k: Component) => (k.get('type') === 'textnode' ? String(k.get('content') ?? '') : textOf(k))).join('');
  return String(c.get('content') ?? '');
}

function writeOne(target: Component, b: NormBind, v: Value | undefined, raw: string, t: CompiledTrait): void {
  switch (b.kind) {
    case 'attr':
      // A plain root attribute keeps an empty value (present beats default); other attributes are removed when empty.
      if (raw === '' && !t.native) target.removeAttributes(b.attr);
      else target.addAttributes({ [b.attr]: raw });
      break;
    case 'text':
      // Text nodes are escaped on export. Never set `content`: it is raw HTML.
      target.components(raw === '' ? [] : [{ type: 'textnode', content: raw }]);
      break;
    case 'style': {
      const style = { ...(target.getStyle() as Record<string, string>) };
      if (raw === '') delete style[b.prop];
      else style[b.prop] = t.spec.type === 'number' && b.unit ? `${raw}${b.unit}` : raw;
      target.setStyle(style);
      break;
    }
    case 'class':
      for (const cls of Object.values(b.map).flatMap(splitClasses)) target.removeClass(cls);
      for (const cls of splitClasses(b.map[raw] ?? '')) target.addClass(cls);
      break;
    case 'classIf':
      for (const cls of splitClasses(b.cls)) (v ? target.addClass(cls) : target.removeClass(cls));
      break;
  }
}

export function writeBinds(root: Component, t: CompiledTrait, value: unknown): void {
  const v = normalize(t.spec, value);
  const raw = toRaw(t.spec, v);
  for (const b of t.binds) for (const target of targetsOf(root, b)) writeOne(target, b, v, raw, t);
}

/** The first bind that has a value in the markup, as a raw string. */
export function readBinds(root: Component, t: CompiledTrait): string | undefined {
  for (const b of t.binds) {
    const target = targetsOf(root, b)[0];
    if (!target) continue;
    let raw: string | undefined;
    switch (b.kind) {
      case 'attr': {
        const v = (target.getAttributes() as Record<string, unknown>)[b.attr];
        raw = v === undefined || v === null ? undefined : String(v);
        break;
      }
      case 'text':
        raw = textOf(target);
        break;
      case 'style': {
        const v = (target.getStyle() as Record<string, unknown>)[b.prop];
        if (v !== undefined && v !== '') raw = b.unit && String(v).endsWith(b.unit) ? String(v).slice(0, -b.unit.length) : String(v);
        break;
      }
      case 'class': {
        const have = target.getClasses() as string[];
        for (const [key, cls] of Object.entries(b.map)) {
          const parts = splitClasses(cls);
          if (parts.length && parts.every((p) => have.includes(p))) {
            raw = key;
            break;
          }
        }
        break;
      }
      case 'classIf': {
        const have = target.getClasses() as string[];
        raw = splitClasses(b.cls).every((p) => have.includes(p)) ? 'true' : 'false';
        break;
      }
    }
    if (raw !== undefined) return raw;
  }
  return undefined;
}
