import { describe, expect, it } from 'vitest';
import { assertCss, formatCssIssues, selectorKeys, validateCss } from '../src/define/css';
import { baseCss } from '../src/styles';

describe('validateCss', () => {
  it.each([
    ['background', '.a{background:var(--x,#fff)}'],
    ['border-color', '.a{border-color:var(--c)}'],
    ['border-radius', '.a{border-radius:var(--r,8px)}'],
    ['border', '.a{border:1px solid var(--c)}'],
    ['margin', '.a{margin:var(--m) 0}'],
    ['padding', '.a{padding:var(--p)}'],
    ['font', '.a{font:var(--f)}'],
    ['outline', '.a{outline:2px solid var(--o)}'],
    ['gap', '.a{gap:var(--g)}'],
    ['padding-inline', '.a{padding-inline:var(--p)}'],
    ['margin-block', '.a{margin-block:var(--m)}'],
    ['grid-row', '.a{grid-row:var(--r)}'],
    ['white-space', '.a{white-space:var(--w)}'],
    ['scroll-padding', '.a{scroll-padding:var(--s)}'],
    ['column-rule', '.a{column-rule:1px solid var(--c)}'],
  ])('flags a shorthand with var(): %s', (property, css) => {
    const issues = validateCss(css);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'shorthand-var', property });
    expect(issues[0]!.message).toMatch(/longhand/);
  });

  it('accepts longhands and properties that do not expand', () => {
    expect(validateCss('.a{background-color:var(--x);border-top-color:var(--c);border-top-left-radius:var(--r);box-shadow:0 0 var(--b) red;color:var(--fg,inherit);width:var(--w)}')).toEqual([]);
  });

  it('ignores shorthands without var()', () => {
    expect(validateCss('.a{background:#fff;border:1px solid red;margin:0 auto}')).toEqual([]);
  });

  it('flags a selector declared twice, including inside a selector list', () => {
    expect(validateCss('.a{color:red}.a{color:blue}')).toMatchObject([{ kind: 'duplicate-selector', selector: '.a' }]);
    expect(validateCss('.a,.b{color:red}.b{margin:0}')).toMatchObject([{ kind: 'duplicate-selector', selector: '.b' }]);
  });

  it('treats the same selector in different media queries as different rules', () => {
    expect(validateCss('.a{color:red}@media (max-width:600px){.a{color:blue}}')).toEqual([]);
    expect(validateCss('@media (max-width:600px){.a{color:blue}.a{margin:0}}')).toHaveLength(1);
  });

  it('ignores comments and at-rules that are not selectors', () => {
    expect(validateCss('/* .a{color:red} */ .a{color:red} @keyframes x{from{opacity:0}to{opacity:1}}')).toEqual([]);
  });

  it('reports every problem with readable text', () => {
    const issues = validateCss('.a{background:var(--x)}.b{color:red}.b{color:blue}');
    expect(issues.map((i) => i.kind).sort()).toEqual(['duplicate-selector', 'shorthand-var']);
    expect(formatCssIssues(issues)).toMatch(/\.a:.*longhand[\s\S]*\.b:.*declared 2 times/);
  });

  it('lists media|selector keys', () => {
    expect(selectorKeys('.a,.b{x:y}@media print{.c{x:y}}')).toEqual(['|.a', '|.b', '@media print|.c']);
  });
});

describe('assertCss', () => {
  it('passes clean CSS and throws on a problem', () => {
    expect(() => assertCss('.a{color:red}')).not.toThrow();
    expect(() => assertCss('.a{background:var(--x)}')).toThrow(/lose styles in GrapesJS/);
  });
});

describe('the built-in stylesheet obeys its own rules', () => {
  it('has no shorthand with var() and no repeated selector', () => {
    expect(validateCss(baseCss)).toEqual([]);
  });
});
