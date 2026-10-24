import { defineConfig } from 'tsup';

// `npm run build` empties dist first; the configs below run in parallel, so none of them cleans.
export default defineConfig([
  {
    entry: ['src/index.ts', 'src/testing.ts', 'src/editor.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['grapesjs'],
  },
  {
    // Browser build for <script> / unpkg usage; registers itself on window.grapesjs.
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'GrapesjsAdvanceComponents',
    minify: true,
    sourcemap: true,
    outExtension: () => ({ js: '.global.js' }),
  },
]);
