import { defineConfig } from 'tsup';

// `npm run build` empties dist first; the configs below run in parallel, so none of them cleans.
export default defineConfig([
  {
    entry: ['src/index.ts'],
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
  {
    // `aac` command line tool (Node only).
    entry: { cli: 'src/cli/bin.ts' },
    format: ['esm'],
    platform: 'node',
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
    external: ['grapesjs', 'jsdom'],
    sourcemap: true,
  },
]);
