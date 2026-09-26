import { defineConfig } from 'vite';

// Relative base so the build works on any GitHub Pages path
// (https://<user>.github.io/<repo>/) or a custom domain. Routing is hash-based.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: 'es',
  },
});
