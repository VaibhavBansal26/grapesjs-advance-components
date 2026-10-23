import { describe, expect, it } from 'vitest';
import plugin, { defineComponent } from '../src';
import { assertCss, createTestEditor, mountComponent, runScript, testRoundTrip, verifyScript } from '../src/testing';

// The examples from the "Build your own component" docs section. If the docs change, change these.
const testimonial = defineComponent({
  id: 'acme-testimonial',
  label: 'Testimonial',
  category: 'Social proof',
  icon: '💬',
  html: `<figure class="acme-testimonial acme-testimonial--round">
    <blockquote>Tell people what changed for you.</blockquote>
    <figcaption>Name, Role</figcaption>
  </figure>`,
  editable: ['blockquote', 'figcaption'],
  traits: {
    tone: { type: 'select', options: ['light', 'dark'], default: 'light', bind: { class: { light: 'acme-testimonial--light', dark: 'acme-testimonial--dark' } } },
    rounded: { type: 'checkbox', default: true, bind: { classIf: 'acme-testimonial--round' } },
    accent: { type: 'color', bind: { cssVar: '--aac-accent' } },
  },
  css: `.acme-testimonial{margin:24px 0;padding:24px;border-left-width:4px;border-left-style:solid;border-left-color:var(--aac-accent,#4f46e5)}`,
});

const counter = defineComponent({
  id: 'acme-counter',
  label: 'Counter',
  html: '<button type="button" class="acme-counter" data-start="0">0</button>',
  traits: { start: { type: 'number', default: 0 } },
  consts: { max: 10 },
  script({ el, props, consts, inEditor, emit }) {
    let n = props.start;
    el.addEventListener('click', () => {
      if (inEditor) return;
      n = Math.min(n + 1, consts.max as number);
      el.textContent = String(n);
      emit('acme:count', { n });
    });
  },
});

describe('docs examples', () => {
  it('testimonial installs through the plugin option and round trips', () => {
    const editor = createTestEditor((ed) => plugin(ed, { custom: [testimonial] }));
    expect(editor.Blocks.get('acme-testimonial-block')).toBeTruthy();
    expect(() => assertCss(testimonial)).not.toThrow();
    expect(() => testRoundTrip(testimonial, { tone: 'dark', rounded: false })).not.toThrow();
    const m = mountComponent(testimonial, { values: { tone: 'dark' } });
    expect(m.html()).toContain('acme-testimonial--dark');
    expect(m.html()).toContain('acme-testimonial--round');
  });

  it('counter script counts from its setting and emits', () => {
    expect(() => verifyScript(counter)).not.toThrow();
    const el = mountComponent(counter, { values: { start: 8 } }).el();
    const seen: number[] = [];
    el.addEventListener('acme:count', (e) => seen.push((e as CustomEvent).detail.n));
    runScript(counter, el);
    el.click();
    el.click();
    el.click();
    expect(seen).toEqual([9, 10, 10]);
  });
});
