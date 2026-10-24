import type { Editor } from 'grapesjs';

type ParsedRule = {
  selectors?: unknown[];
  selectorsAdd?: string;
  state?: string;
  mediaText?: string;
  atRuleType?: string;
};

/**
 * Add the base stylesheet rules a saved project does not have.
 *
 * Loading a project replaces the editor's stylesheet with the one saved in it, so a project saved
 * by an older version never gets the rules for blocks added since. This adds only the rules that
 * are missing and leaves every existing rule alone, so edits people made to a rule are kept.
 */
export function addMissingRules(editor: Editor, css: string): void {
  const missing = (editor.Parser.parseCss(css) as ParsedRule[]).filter((r) => {
    const names = (r.selectors ?? []).map((x) => (typeof x === 'string' ? x : (x as { name?: string }).name)).filter(Boolean);
    const selector = names.length ? `.${names.join('.')}${r.state ? `:${r.state}` : ''}${r.selectorsAdd ? `, ${r.selectorsAdd}` : ''}` : (r.selectorsAdd ?? '');
    return !editor.Css.getRule(selector, { atRuleType: r.atRuleType, atRuleParams: r.mediaText } as never);
  });
  if (missing.length) editor.Css.addCollection(missing as never);
}
