import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests run against the plugin's source, so they never depend on a prior build.
    alias: { 'grapesjs-advance-components': fileURLToPath(new URL('../grapesjs-advance-components/src/index.ts', import.meta.url)) },
  },
  test: { environment: 'jsdom', include: ['test/**/*.test.ts'] },
});
