/**
 * Guards for CSS registered through GrapesJS.
 *
 * Two behaviours of GrapesJS's CSS parser silently lose styles, so both are checked:
 *  1. A SHORTHAND property whose value contains `var()` is dropped (`background: var(--x)`).
 *     Use the longhand instead (`background-color: var(--x)`).
 *  2. Only the LAST rule for a selector is kept (it replaces, never merges), so each selector may
 *     be declared once per media query.
 */

export interface CssIssue {
  kind: 'shorthand-var' | 'duplicate-selector';
  selector: string;
  property?: string;
  message: string;
}

/**
 * Properties whose value GrapesJS loses when it contains var(). Checked in Chrome against GrapesJS 0.22
 * (its default CSS parser is the browser's): each of these comes back as empty longhands, while longhands
 * such as `color`, `background-color`, `border-left-color` and `box-shadow` keep their var().
 */
const SHORTHANDS = new Set([
  'background', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'border-color', 'border-style',
  'border-width', 'border-radius', 'border-image', 'margin', 'padding', 'font', 'outline', 'flex', 'flex-flow', 'gap',
  'grid', 'grid-area', 'grid-template', 'inset', 'overflow', 'transition', 'animation', 'list-style', 'text-decoration',
  'columns', 'place-items', 'place-content', 'place-self', 'mask',
  'animation-range', 'background-position', 'border-block', 'border-block-color', 'border-block-start', 'border-inline',
  'border-inline-start', 'border-inline-width', 'border-spacing', 'column-rule', 'contain-intrinsic-size', 'container',
  'corner-shape', 'font-synthesis', 'font-variant', 'grid-column', 'grid-gap', 'grid-row', 'inset-block', 'inset-inline',
  'margin-block', 'margin-inline', 'marker', 'offset', 'overscroll-behavior', 'padding-block', 'padding-inline',
  'position-try', 'scroll-margin', 'scroll-margin-block', 'scroll-padding', 'scroll-timeline', 'text-box',
  'text-emphasis', 'text-wrap', 'view-timeline', 'white-space',
]);

interface Rule {
  media: string;
  selectors: string[];
  body: string;
}

function parseRules(css: string): Rule[] {
  const rules: Rule[] = [];
  const scan = (text: string, media: string) => {
    let depth = 0;
    let start = 0;
    let open = -1;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        if (depth === 0) open = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const prelude = text.slice(start, open).trim();
          const body = text.slice(open + 1, i);
          if (prelude.startsWith('@media')) scan(body, prelude);
          else if (!prelude.startsWith('@')) rules.push({ media, selectors: prelude.split(',').map((x) => x.trim()).filter(Boolean), body });
          start = i + 1;
        }
      }
    }
  };
  scan(css.replace(/\/\*[\s\S]*?\*\//g, ''), '');
  return rules;
}

export function validateCss(css: string): CssIssue[] {
  const issues: CssIssue[] = [];
  const seen = new Map<string, number>();
  for (const rule of parseRules(css)) {
    for (const selector of rule.selectors) {
      const key = `${rule.media}|${selector}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const decl of rule.body.split(';')) {
      const colon = decl.indexOf(':');
      if (colon < 0) continue;
      const property = decl.slice(0, colon).trim().toLowerCase();
      if (SHORTHANDS.has(property) && /var\(/.test(decl.slice(colon + 1))) {
        issues.push({
          kind: 'shorthand-var',
          selector: rule.selectors.join(', '),
          property,
          message: `"${property}" is a shorthand and contains var(), which GrapesJS drops. Use the longhand properties.`,
        });
      }
    }
  }
  for (const [key, n] of seen) {
    if (n > 1) {
      const selector = key.slice(key.indexOf('|') + 1);
      issues.push({ kind: 'duplicate-selector', selector, message: `"${selector}" is declared ${n} times; GrapesJS keeps only the last rule, so merge them into one.` });
    }
  }
  return issues;
}

/** `media|selector` keys of every rule, used to spot a selector declared by two components. */
export function selectorKeys(css: string): string[] {
  return parseRules(css).flatMap((r) => r.selectors.map((sel) => `${r.media}|${sel}`));
}

export const formatCssIssues = (issues: CssIssue[]): string => issues.map((i) => `  - ${i.selector}: ${i.message}`).join('\n');

/** Throws if the CSS would lose styles in GrapesJS. */
export function assertCss(css: string): void {
  const issues = validateCss(css);
  if (issues.length) throw new Error(`CSS would lose styles in GrapesJS:\n${formatCssIssues(issues)}`);
}
