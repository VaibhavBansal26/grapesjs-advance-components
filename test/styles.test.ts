import { expect, it } from 'vitest';
import { baseCss } from '../src/styles';

// GrapesJS's CSS parser drops shorthands containing var() (seen in a real browser; jsdom is
// more lenient and would not catch it), so only longhands may carry custom properties.
it('uses var() only inside longhand properties', () => {
  const shorthand = /(?:^|[;{])\s*(background|border(?:-(?:top|right|bottom|left|radius|color|width|style))?|margin|padding|font|outline)\s*:[^;}]*var\(/g;
  expect([...baseCss.matchAll(shorthand)].map((m) => m[1])).toEqual([]);
});

// GrapesJS keeps only the LAST rule for a given selector (it replaces, never merges), so a
// selector repeated at the same media level silently loses the earlier declarations.
it('declares each selector exactly once per media query', () => {
  const seen = new Map<string, number>();
  const scan = (text: string, media: string) => {
    let depth = 0;
    let start = 0;
    let prelude = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        if (depth === 0) prelude = text.slice(start, i).trim();
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const body = text.slice(text.indexOf('{', start) + 1, i);
          if (prelude.startsWith('@media')) scan(body, prelude);
          else
            for (const sel of prelude.split(',').map((x) => x.trim()))
              seen.set(`${media}|${sel}`, (seen.get(`${media}|${sel}`) ?? 0) + 1);
          start = i + 1;
        }
      }
    }
  };
  scan(baseCss, '');
  expect([...seen].filter(([, n]) => n > 1).map(([k]) => k)).toEqual([]);
});
