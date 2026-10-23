import { expect, it } from 'vitest';
import { defineComponent } from '../src/define';

// This file is checked by `tsc` (npm run typecheck). The @ts-expect-error lines fail the build if the
// types ever stop catching these mistakes.
it('types script props from the traits', () => {
  const def = defineComponent({
    id: 'ty-thing',
    label: 'T',
    html: '<div class="ty"></div>',
    traits: {
      n: { type: 'number' },
      c: { type: 'checkbox' },
      s: { type: 'select', options: ['a', 'b'] },
      t: { type: 'text' },
      both: { type: 'number', bind: [{ style: 'width', unit: '%' }, { attr: 'aria-valuenow' }] },
      cls: { type: 'select', options: ['a'], bind: { class: { a: 'x' } } },
      visual: { type: 'color', bind: { cssVar: '--v' } },
      width: { type: 'number', bind: { style: 'width' } },
    },
    consts: { limit: 3 },
    script({ props, consts }) {
      const n: number = props.n;
      const c: boolean = props.c;
      const s: string = props.s;
      const t: string = props.t;
      const both: number = props.both;
      const cls: string = props.cls;
      const limit: number = consts.limit as number;
      void [n, c, s, t, both, cls, limit];
      // @ts-expect-error a custom-property trait is visual only and cannot be read on a published page
      void props.visual;
      // @ts-expect-error a style-only trait is visual only too
      void props.width;
      // @ts-expect-error there is no trait called nope
      void props.nope;
      // @ts-expect-error numbers are not strings
      const bad: string = props.n;
      void bad;
    },
  });
  expect(def.id).toBe('ty-thing');
});

it('types the trait names accepted by get and set', () => {
  const def = defineComponent({ id: 'ty-names', label: 'T', html: '<div class="tyn"></div>', traits: { a: { type: 'text' }, b: { type: 'number' } } });
  const component = {} as never;
  const read = () => {
    def.get(component, 'a');
    def.get(component, 'b');
    // @ts-expect-error unknown trait name
    def.get(component, 'nope');
    // @ts-expect-error unknown trait name
    def.set(component, 'nope', 1);
  };
  expect(typeof read).toBe('function'); // never called: this test is about the types
});

it('rejects bad specs at compile time', () => {
  const specs = () => [
    // @ts-expect-error a bind needs one of the known kinds
    defineComponent({ id: 'ty-a', label: 'A', html: '<div class="a"></div>', traits: { x: { type: 'text', bind: { wrong: 'y' } } } }),
    // @ts-expect-error trait type must be one of the known types
    defineComponent({ id: 'ty-b', label: 'B', html: '<div class="b"></div>', traits: { x: { type: 'textarea' } } }),
  ];
  expect(typeof specs).toBe('function');
});
