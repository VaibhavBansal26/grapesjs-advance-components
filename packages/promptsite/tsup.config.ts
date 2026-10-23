import { defineConfig } from 'tsup';

// Dependencies (grapesjs, jsdom, grapesjs-advance-components) stay external and are installed with the package.
export default defineConfig({
  entry: { cli: 'src/bin.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  banner: { js: '#!/usr/bin/env node' },
  sourcemap: true,
});
