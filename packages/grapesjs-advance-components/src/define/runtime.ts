import type { CompiledTrait, NormBind } from './binds';
import { DefineComponentError } from './errors';
import type { ComponentSpec } from './types';

/**
 * Small ES5 readers embedded verbatim in the exported script, so a published page reads the same
 * values the editor wrote, from the markup alone. Keep this self-contained: it is serialised as text.
 */
const HELPERS = `function aacSplit(s){return String(s).split(/\\s+/).filter(Boolean);}
  function aacHas(t,s){var c=aacSplit(s);for(var i=0;i<c.length;i++){if(!t.classList.contains(c[i]))return false;}return c.length>0;}
  function aacCoerce(type,raw,def){
    if(raw===null||raw===undefined)return def;
    if(type==='number'){if(raw==='')return def;var n=Number(raw);return isFinite(n)?n:def;}
    if(type==='checkbox')return raw==='true';
    return String(raw);
  }
  function aacRead(el,s){
    for(var i=0;i<s.b.length;i++){
      var b=s.b[i];var t=b.on?el.querySelector(b.on):el;if(!t)continue;var raw=null;
      if(b.k==='attr'){raw=t.getAttribute(b.a);}
      else if(b.k==='text'){raw=t.textContent;}
      else if(b.k==='class'){for(var key in b.m){if(aacHas(t,b.m[key])){raw=key;break;}}}
      else if(b.k==='classIf'){raw=aacHas(t,b.c)?'true':'false';}
      if(raw!==null&&raw!==undefined)return aacCoerce(s.t,raw,s.d);
    }
    return s.d;
  }`;

/** `fn.toString()` as an expression: handles functions, arrows and object-method shorthand. */
function asExpression(id: string, fn: (...args: never[]) => unknown): string {
  const src = fn.toString().trim();
  if (/^(async\s+)?function\b/.test(src) || src.startsWith('(') || /^(async\s*)?[\w$]+\s*=>/.test(src) || /^async\s*\(/.test(src)) return src;
  const method = /^(async\s+)?[A-Za-z_$][\w$]*\s*\(/.exec(src);
  if (method) return `${method[1] ?? ''}function ${src.slice(method[0].length - 1)}`;
  throw new DefineComponentError(id, 'script must be a plain function, an arrow function or a method (generators and accessors are not supported)');
}

const runtimeBind = (b: NormBind) =>
  b.kind === 'attr' ? { k: 'attr', a: b.attr, on: b.on } : b.kind === 'text' ? { k: 'text', on: b.on } : b.kind === 'class' ? { k: 'class', m: b.map, on: b.on } : b.kind === 'classIf' ? { k: 'classIf', c: b.cls, on: b.on } : null;

/** Rejects anything JSON would silently change (functions, undefined, NaN, Dates, class instances…). */
function jsonSafe(id: string, consts: unknown): string {
  // The replacer sees values AFTER toJSON (a Date is already a string), so judge the original: this[key].
  const text = JSON.stringify(consts, function (this: Record<string, unknown>, key: string, v: unknown) {
    const original = key === '' ? v : this[key];
    const t = typeof original;
    if (t === 'function' || t === 'undefined' || t === 'symbol' || t === 'bigint' || (t === 'number' && !Number.isFinite(original as number)))
      throw new DefineComponentError(id, `consts.${key || '(root)'} is not JSON-serialisable (${t})`);
    if (original && t === 'object' && !Array.isArray(original) && Object.getPrototypeOf(original) !== Object.prototype)
      throw new DefineComponentError(id, `consts.${key || '(root)'} must be plain data`);
    return v;
  });
  // Keep the JSON safe to inline in a <script>: no "</script", and no raw line separators.
  const LS = new RegExp(String.fromCharCode(0x2028), 'g');
  const PS = new RegExp(String.fromCharCode(0x2029), 'g');
  return text.replace(/</g, String.raw`\u003c`).replace(LS, String.raw`\u2028`).replace(PS, String.raw`\u2029`);
}

/**
 * The script GrapesJS inlines on the page, as a function BODY (GrapesJS wraps a string script itself:
 * `(function () { BODY }.bind(element))()`, so `this` is the element). Self-contained: it carries
 * its own readers, so the published page needs nothing from this package.
 */
export function buildScript(id: string, spec: ComponentSpec<never, never>, traits: CompiledTrait[]): string | undefined {
  if (spec.script === undefined) return undefined;
  if (typeof spec.script !== 'function') throw new DefineComponentError(id, 'script must be a function');
  const user = asExpression(id, spec.script as (...args: never[]) => unknown);
  const schema: Record<string, { t: string; d?: unknown; b: unknown[] }> = {};
  for (const t of traits) {
    const reads = t.readable.map(runtimeBind).filter(Boolean) as unknown[];
    if (reads.length) schema[t.name] = { t: t.spec.type, d: t.spec.default, b: reads };
  }
  const consts = jsonSafe(id, spec.consts ?? {});
  return `var el = this;
var f = window.frameElement;
var inEditor = !!(f && String(f.className).indexOf('gjs-frame') > -1);
if (inEditor && !${spec.runInEditor ? 'true' : 'false'}) return;
${HELPERS}
var schema = ${JSON.stringify(schema).replace(/</g, '\\u003c')};
var props = {};
for (var name in schema) props[name] = aacRead(el, schema[name]);
var emit = function (n, d, c) { return el.dispatchEvent(new CustomEvent(n, { bubbles: true, cancelable: !!c, detail: d })); };
(${user})({ el: el, props: props, consts: ${consts}, inEditor: inEditor, emit: emit });`;
}
