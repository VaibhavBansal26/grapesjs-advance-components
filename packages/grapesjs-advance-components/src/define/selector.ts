import type { Component } from 'grapesjs';

/**
 * A small selector matcher over the GrapesJS component tree.
 *
 * GrapesJS's own `component.find()` returns nothing in headless mode (no DOM views), which is where
 * `promptsite` renders, so components are matched here by model instead.
 *
 * Supported: tag, `.class`, `#id`, `[attr]`, `[attr=value]` (compound: `a.btn[href]`), the descendant
 * (space) and child (`>`) combinators. Not supported: lists (`,`), pseudo-classes, `+`, `~`, `*`.
 */

interface Compound {
  tag?: string;
  id?: string;
  classes: string[];
  attrs: Array<{ name: string; value?: string }>;
}
interface Step {
  /** Relation to the previous step: '' for the first, ' ' descendant, '>' child. */
  combinator: '' | ' ' | '>';
  compound: Compound;
}

const IDENT = /^-?[_a-zA-Z][\w-]*/;
const cache = new Map<string, Step[]>();

function fail(selector: string, why: string): never {
  throw new Error(`Unsupported selector "${selector}": ${why}. Supported: tag, .class, #id, [attr], [attr=value], and the descendant and > combinators.`);
}

export function parseSelector(input: string): Step[] {
  const hit = cache.get(input);
  if (hit) return hit;
  const s = input.trim();
  if (!s) fail(input, 'it is empty');
  const steps: Step[] = [];
  let i = 0;
  let pending: Step['combinator'] = '';
  while (i < s.length) {
    let space = false;
    while (i < s.length && /\s/.test(s[i]!)) (space = true), i++;
    if (s[i] === '>') {
      if (!steps.length) fail(input, 'it cannot start with ">"');
      pending = '>';
      i++;
      while (i < s.length && /\s/.test(s[i]!)) i++;
    } else if (space && steps.length) pending = ' ';

    const compound: Compound = { classes: [], attrs: [] };
    const start = i;
    const tag = IDENT.exec(s.slice(i));
    if (tag) {
      compound.tag = tag[0].toLowerCase();
      i += tag[0].length;
    }
    while (i < s.length && !/[\s>]/.test(s[i]!)) {
      const ch = s[i]!;
      if (ch === '.' || ch === '#') {
        const id = IDENT.exec(s.slice(i + 1));
        if (!id) fail(input, `expected a name after "${ch}"`);
        if (ch === '.') compound.classes.push(id[0]);
        else compound.id = id[0];
        i += 1 + id[0].length;
      } else if (ch === '[') {
        const end = s.indexOf(']', i);
        if (end < 0) fail(input, 'a "[" is not closed');
        const m = /^\s*([\w-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]*)))?\s*$/.exec(s.slice(i + 1, end));
        if (!m) fail(input, `cannot read the attribute selector "${s.slice(i, end + 1)}"`);
        compound.attrs.push({ name: m[1]!, value: m[2] ?? m[3] ?? m[4] });
        i = end + 1;
      } else fail(input, `"${ch}" is not supported`);
    }
    if (i === start) fail(input, 'a selector is missing');
    steps.push({ combinator: steps.length ? pending || ' ' : '', compound });
    pending = '';
  }
  cache.set(input, steps);
  return steps;
}

/** Throws a readable error if `selector` is outside the supported subset. */
export const assertSelector = (selector: string): void => void parseSelector(selector);

const isElement = (c: Component) => {
  const type = c.get('type');
  return type !== 'textnode' && type !== 'comment';
};
const tagOf = (c: Component) => String(c.get('tagName') || 'div').toLowerCase();

function matchesCompound(c: Component, k: Compound): boolean {
  if (k.tag && k.tag !== tagOf(c)) return false;
  const attrs = c.getAttributes() as Record<string, unknown>;
  if (k.id && attrs.id !== k.id) return false;
  if (k.classes.length) {
    const have = c.getClasses() as string[];
    if (!k.classes.every((x) => have.includes(x))) return false;
  }
  for (const a of k.attrs) {
    const v = attrs[a.name];
    if (v === undefined || v === null) return false;
    if (a.value !== undefined && String(v) !== a.value) return false;
  }
  return true;
}

function matchChain(c: Component, steps: Step[], idx: number, root: Component): boolean {
  if (!matchesCompound(c, steps[idx]!.compound)) return false;
  if (idx === 0) return true;
  const combinator = steps[idx]!.combinator;
  let parent = c.parent() as Component | undefined;
  if (combinator === '>') return !!parent && matchChain(parent, steps, idx - 1, root);
  while (parent) {
    if (matchChain(parent, steps, idx - 1, root)) return true;
    if (parent === root) break; // ancestors beyond the root are out of scope
    parent = parent.parent() as Component | undefined;
  }
  return false;
}

/** All descendants of `root` (never `root` itself) matching `selector`, in document order. */
export function queryAll(root: Component, selector: string): Component[] {
  const steps = parseSelector(selector);
  const out: Component[] = [];
  const visit = (node: Component) => {
    node.components().forEach((child: Component) => {
      if (!isElement(child)) return;
      if (matchChain(child, steps, steps.length - 1, root)) out.push(child);
      visit(child);
    });
  };
  visit(root);
  return out;
}

/** All descendants of `root`, elements only, in document order. */
export function descendants(root: Component): Component[] {
  const out: Component[] = [];
  const visit = (node: Component) =>
    node.components().forEach((child: Component) => {
      if (!isElement(child)) return;
      out.push(child);
      visit(child);
    });
  visit(root);
  return out;
}
