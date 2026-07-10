import { defineConfig } from 'vite';

// Builds the vendored ranui component bundle for static pages that have no
// bundler (see bin/ranui-iife.entry.ts). Invoked by bin/build.sh:
//   pnpm vite build --config vite.ranui-iife.config.ts
// Output: public/ranui.iife.js (committed, like public/ran-tokens.css).
export default defineConfig({
  // This build only bundles the entry; without this, vite would try to copy
  // public/ into itself (outDir and publicDir are the same folder).
  publicDir: false,
  build: {
    lib: {
      entry: 'bin/ranui-iife.entry.ts',
      name: 'ranui',
      formats: ['iife'],
      fileName: () => 'ranui.iife.js',
    },
    outDir: 'public',
    emptyOutDir: false,
    // Components inject their styles into the shadow root at runtime; there is
    // no separate CSS asset expected from this build.
    minify: true,
  },
});
