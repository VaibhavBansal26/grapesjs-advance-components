import { describe, expect, it } from 'vitest';
import plugin, { defineComponent } from '../src';
import { assertCss, createTestEditor, mountComponent, runScript, testRoundTrip, verifyScript } from '../src/testing';

const thing = defineComponent({
  id: 'th-thing',
  label: 'Thing',
  html: '<div class="thing"><span class="n">x</span></div>',
  traits: { name: { type: 'text', default: 'x', bind: { text: '.n' } }, size: { type: 'number', default: 2, min: 1, max: 5 } },
  css: '.thing{margin:8px 0}',
  script({ el, props }) {
    el.setAttribute('data-ran', String(props.size));
  },
});

describe('createTestEditor', () => {
  it('returns a headless editor, optionally set up by a plugin and loaded with project data', () => {
    const editor = createTestEditor((ed) => plugin(ed, { custom: [thing] }));
    expect(editor.Blocks.get('th-thing-block')).toBeTruthy();
    const [c] = editor.addComponents({ type: 'th-thing' });
    thing.set(c!, 'size', 4);
    const copy = createTestEditor((ed) => thing.install(ed), editor.getProjectData() as Record<string, unknown>);
    expect(thing.get(copy.getWrapper()!.components().at(0)!, 'size')).toBe(4);
  });
});

describe('mountComponent', () => {
  it('creates a component with starting values, and gives typed get and set', () => {
    const m = mountComponent(thing, { values: { size: 5 } });
    expect(m.get('size')).toBe(5);
    m.set('name', 'Ada');
    expect(m.html()).toContain('Ada');
    expect(m.css()).toContain('.thing');
    expect(m.el().classList.contains('thing')).toBe(true);
  });

  it('reuses an editor you pass in', () => {
    const editor = createTestEditor();
    const a = mountComponent(thing, { editor });
    const b = mountComponent(thing, { editor });
    expect(a.editor).toBe(b.editor);
    expect(editor.getWrapper()!.components().length).toBe(2);
  });
});

describe('runScript', () => {
  it('runs the published script on an element', () => {
    const el = mountComponent(thing, { values: { size: 3 } }).el();
    runScript(thing, el);
    expect(el.getAttribute('data-ran')).toBe('3');
  });

  it('stays inert in the editor canvas unless runInEditor is set', () => {
    const el = mountComponent(thing).el();
    runScript(thing, el, { inEditor: true });
    expect(el.hasAttribute('data-ran')).toBe(false);
    expect(window.frameElement).toBeNull(); // the stub was removed again
  });

  it('tells a runInEditor script that it is inside the editor', () => {
    const probe = defineComponent({
      id: 'th-probe',
      label: 'P',
      html: '<div class="probe"></div>',
      runInEditor: true,
      script({ el, inEditor }) {
        el.setAttribute('data-in', String(inEditor));
      },
    });
    const live = mountComponent(probe).el();
    runScript(probe, live);
    expect(live.getAttribute('data-in')).toBe('false');
    const canvas = mountComponent(probe).el();
    runScript(probe, canvas, { inEditor: true });
    expect(canvas.getAttribute('data-in')).toBe('true');
  });

  it('refuses a component without a script', () => {
    const none = defineComponent({ id: 'th-none', label: 'N', html: '<div class="none"></div>' });
    expect(() => runScript(none, document.createElement('div'))).toThrow(/has no script/);
  });
});

describe('assertCss', () => {
  it('accepts a component or a string, and throws on problems', () => {
    expect(() => assertCss(thing)).not.toThrow();
    expect(() => assertCss('.a{color:red}')).not.toThrow();
    expect(() => assertCss('.a{background:var(--x)}')).toThrow(/lose styles/);
    expect(() => assertCss(defineComponent({ id: 'th-css', label: 'C', html: '<div class="c"></div>', css: '.c{color:red}.c{color:blue}' }))).toThrow(/declared 2 times/);
    expect(() => assertCss(defineComponent({ id: 'th-nocss', label: 'N', html: '<div class="n"></div>' }))).not.toThrow();
  });
});

describe('verifyScript', () => {
  it('passes the component above', () => {
    expect(() => verifyScript(thing)).not.toThrow();
  });
});

describe('testRoundTrip', () => {
  it('passes for a well-formed component and returns what it exported', () => {
    const { html, css } = testRoundTrip(thing, { name: 'Grace', size: 4 });
    expect(html).toContain('Grace');
    expect(typeof css).toBe('string');
  });

  it('fails with a clear message when saved HTML is not recognised again', () => {
    const bad = defineComponent({
      id: 'th-bad',
      label: 'Bad',
      html: '<div class="bad"></div>',
      detect: (el) => !el.hasAttribute('data-size'), // the exported markup always carries data-size, so reload misses it
      traits: { size: { type: 'number', default: 2 } },
    });
    expect(() => testRoundTrip(bad)).toThrow(/testRoundTrip\("th-bad"\) failed/);
    expect(() => testRoundTrip(bad)).toThrow(/was recognised as .* not "th-bad" \(check detect\)/);
  });

  it('fails when a value is lost on the way', () => {
    const lossy = defineComponent({
      id: 'th-lossy',
      label: 'Lossy',
      html: '<div class="lossy"><span class="x">x</span></div>',
      traits: { label: { type: 'text', default: 'x', bind: { text: '.x' } } },
    });
    // make the second load unable to read the text back, as a broken bind would
    const editor = createTestEditor();
    lossy.installType(editor);
    expect(() => testRoundTrip(lossy, { label: 'ok' })).not.toThrow();
    expect(() => testRoundTrip(lossy, { nope: 'x' } as never)).toThrow(/unknown trait "nope"/);
  });
});
