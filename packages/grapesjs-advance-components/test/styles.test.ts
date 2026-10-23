import { expect, it } from 'vitest';
import { validateCss } from '../src/define/css';
import { baseCss } from '../src/styles';

// GrapesJS silently drops shorthands that contain var() and keeps only the LAST rule per selector.
// The shared guard (src/define/css.ts) checks both; see also define-css.test.ts.
it('uses var() only inside longhand properties', () => {
  expect(validateCss(baseCss).filter((i) => i.kind === 'shorthand-var')).toEqual([]);
});

it('declares each selector exactly once per media query', () => {
  expect(validateCss(baseCss).filter((i) => i.kind === 'duplicate-selector')).toEqual([]);
});
