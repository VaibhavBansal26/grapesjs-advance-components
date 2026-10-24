import { describe, expect, it } from 'vitest';
import plugin from '../src';
import { createTestEditor } from '../src/testing';

type Project = { styles?: Array<{ selectors?: unknown[]; selectorsAdd?: string }> };

function staleProject(): Project {
  const fresh = createTestEditor((ed) => plugin(ed));
  const data = fresh.getProjectData() as Project;
  // what an older version saved: none of the rules for the newer blocks
  data.styles = (data.styles ?? []).filter((r) => !JSON.stringify(r.selectors).match(/aac-(team|member|testimonial|blog|post|logos|cols)/));
  return data;
}

const load = (ed: unknown) => (ed as { trigger(e: string): void }).trigger('load');

describe('base stylesheet and saved projects', () => {
  it('a saved project replaces the stylesheet, so newer rules would be missing', () => {
    const editor = createTestEditor((ed) => plugin(ed), staleProject() as Record<string, unknown>);
    expect(editor.Css.getRule('.aac-team')).toBeFalsy();
  });

  it('adds the missing rules once the project has loaded', () => {
    const editor = createTestEditor((ed) => plugin(ed), staleProject() as Record<string, unknown>);
    load(editor);
    expect(editor.Css.getRule('.aac-team')).toBeTruthy();
    expect(editor.Css.getRule('.aac-testimonials')).toBeTruthy();
  });

  it("keeps the user's own edits to a rule that already exists", () => {
    const data = staleProject();
    const editor = createTestEditor((ed) => plugin(ed), data as Record<string, unknown>);
    editor.Css.setRule('.aac-hero', { 'padding-top': '3px' });
    load(editor);
    expect(editor.Css.getRule('.aac-hero')!.getStyle()).toMatchObject({ 'padding-top': '3px' });
  });

  it('does nothing twice and does nothing when styles are turned off', () => {
    const editor = createTestEditor((ed) => plugin(ed), staleProject() as Record<string, unknown>);
    load(editor);
    const count = editor.Css.getAll().length;
    load(editor);
    expect(editor.Css.getAll().length).toBe(count);
    const off = createTestEditor((ed) => plugin(ed, { injectStyles: false }), staleProject() as Record<string, unknown>);
    load(off);
    expect(off.Css.getRule('.aac-team')).toBeFalsy();
  });

  it('adds missing complex and media rules too', () => {
    const data = staleProject();
    data.styles = (data.styles ?? []).filter((r) => !r.selectorsAdd?.includes('aac-faq'));
    const editor = createTestEditor((ed) => plugin(ed), data as Record<string, unknown>);
    expect(editor.Css.getAll().models.some((r) => String(r.selectorsToString()).includes('.aac-faq summary'))).toBe(false);
    load(editor);
    expect(editor.Css.getAll().models.some((r) => String(r.selectorsToString()).includes('.aac-faq summary'))).toBe(true);
  });
});
