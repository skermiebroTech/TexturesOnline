// Dev server for the preview harness pages without HMR / file watching, so edits elsewhere in the
// working tree never reload a page mid-screenshot.
//   npx vite --config tests/harness/preview/vite.harness.config.mjs --port 5317
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  base: './',
  server: { hmr: false, watch: null },
  optimizeDeps: { include: ['three', 'skinview3d', 'fast-png'] },
});
