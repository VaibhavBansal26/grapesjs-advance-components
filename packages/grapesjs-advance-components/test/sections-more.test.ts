import { describe, expect, it } from 'vitest';
import plugin from '../src';
import { banner, compare, stats, steps, tabs } from '../src/sections';
import { baseCss } from '../src/styles';
import { createTestEditor, mountComponent, runScript, testRoundTrip, verifyScript } from '../src/testing';

describe('stats', () => {
  it('offers 2 to 4 columns', () => {
    const m = mountComponent(stats, { values: { columns: '4' } });
    expect(m.html()).toContain('aac-cols-4');
    expect(m.html()).not.toContain('aac-cols-3');
    expect(baseCss).toContain('.aac-cols-4{');
  });

  it('keeps value and label editable, and lets people add stats', () => {
    const { component } = mountComponent(stats);
    const stat = component.components().at(0)!;
    expect(stat.get('removable')).toBe(true);
    expect(stat.components().at(0)!.get('type')).toBe('text');
    expect(component.get('droppable')).toBe('.aac-stat');
  });
});

describe('steps', () => {
  it('switches between vertical and horizontal and numbers its steps with CSS', () => {
    const m = mountComponent(steps, { values: { layout: 'horizontal' } });
    expect(m.html()).toContain('aac-steps--horizontal');
    expect(m.html()).not.toContain('aac-steps--vertical');
    expect(m.html()).toMatch(/^<ol /);
    expect(baseCss).toContain('counter(aac-step)');
  });
});

describe('banner', () => {
  it.each(['info', 'success', 'warning'])('tone %s sets one class', (tone) => {
    const m = mountComponent(banner, { values: { tone } });
    expect(m.html()).toContain(`aac-banner--${tone}`);
    expect(['info', 'success', 'warning'].filter((t) => m.html().includes(`aac-banner--${t}`))).toEqual([tone]);
  });

  it('is announced as a note and its text is editable', () => {
    const m = mountComponent(banner);
    expect(m.html()).toContain('role="note"');
    expect(m.component.components().at(0)!.get('type')).toBe('text');
  });
});

describe('comparison table', () => {
  it('toggles striping on the table, not the wrapper', () => {
    const m = mountComponent(compare);
    expect(m.html()).toContain('aac-compare--striped');
    m.set('striped', false);
    expect(m.html()).not.toContain('aac-compare--striped');
    expect(m.html()).toContain('class="aac-compare"');
  });

  it('has real header cells with scope, for screen readers', () => {
    const { html } = mountComponent(compare);
    expect(html()).toContain('<th scope="col">Starter</th>');
    expect(html()).toContain('<th scope="row">Projects</th>');
  });

  it('lets people add and remove rows', () => {
    const editor = createTestEditor((ed) => plugin(ed));
    const [c] = editor.addComponents(compare.spec.html);
    const rows = c!.components().at(0)!.components().at(0)!.components(); // wrap > table > thead
    expect(rows.length).toBeGreaterThan(0);
    const tbody = c!.components().at(0)!.components().at(1)!;
    expect(tbody.get('droppable')).toBe('tbody tr');
    expect(tbody.components().at(0)!.get('removable')).toBe(true);
  });
});

describe('tabs', () => {
  const mount = () => {
    const el = mountComponent(tabs).el();
    document.body.append(el);
    runScript(tabs, el);
    return el;
  };
  const tabEls = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.aac-tab')];
  const panelEls = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('.aac-tabpanel')];

  it('shows every panel when there is no script, so nothing is hidden', () => {
    const el = mountComponent(tabs).el();
    expect(panelEls(el).every((p) => !p.hidden && !p.hasAttribute('hidden'))).toBe(true);
    expect(el.classList.contains('aac-tabs--js')).toBe(false);
  });

  it('turns into an accessible tab widget, with unique ids', () => {
    const el = mount();
    const t = tabEls(el);
    const p = panelEls(el);
    expect(el.querySelector('.aac-tablist')!.getAttribute('role')).toBe('tablist');
    t.forEach((tab, i) => {
      expect(tab.getAttribute('role')).toBe('tab');
      expect(tab.getAttribute('aria-controls')).toBe(p[i]!.id);
      expect(p[i]!.getAttribute('aria-labelledby')).toBe(tab.id);
    });
    expect(t.map((x) => x.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(p.map((x) => x.hidden)).toEqual([false, true, true]);
    const second = mount();
    expect(new Set([...tabEls(el), ...tabEls(second)].map((x) => x.id)).size).toBe(6);
  });

  it('switches on click', () => {
    const el = mount();
    tabEls(el)[1]!.click();
    expect(tabEls(el).map((x) => x.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(panelEls(el).map((x) => x.hidden)).toEqual([true, false, true]);
    expect(tabEls(el).map((x) => x.tabIndex)).toEqual([-1, 0, -1]);
  });

  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowRight', 2, 0],
    ['ArrowLeft', 0, 2],
    ['ArrowLeft', 2, 1],
    ['Home', 2, 0],
    ['End', 0, 2],
  ])('%s from tab %i moves to tab %i and focuses it', (key, from, to) => {
    const el = mount();
    const t = tabEls(el);
    t[from]!.click();
    t[from]!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    expect(t[to]!.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(t[to]);
  });

  it('ignores other keys', () => {
    const el = mount();
    const t = tabEls(el);
    const ev = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    t[0]!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(t[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('does nothing when tabs and panels do not pair up', () => {
    const el = mountComponent(tabs).el();
    el.querySelector('.aac-tabpanel')!.remove();
    runScript(tabs, el);
    expect(el.classList.contains('aac-tabs--js')).toBe(false);
  });

  it('has a script that stands on its own, and stays inert in the editor', () => {
    expect(() => verifyScript(tabs)).not.toThrow();
    const el = mountComponent(tabs).el();
    runScript(tabs, el, { inEditor: true });
    expect(el.classList.contains('aac-tabs--js')).toBe(false);
  });

  it('survives export and reload', () => {
    expect(() => testRoundTrip(tabs)).not.toThrow();
  });
});
