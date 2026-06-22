import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { fontRemapMiddleware, injectCriticalStyle, injectGtag, onlyofficeEngineIOHandshake } from './vite-plugins';
import { __dirname, DEV_URLS, PROD_PATHS, rollupInputs, sharedAlias, sharedExtensions } from './vite.shared';

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    root: 'pages',
    base: './',
    publicDir: resolve(__dirname, 'public-v9'),
    plugins: [onlyofficeEngineIOHandshake(), fontRemapMiddleware(), injectCriticalStyle(), injectGtag()],
    define: {
      __IS_BETA__: JSON.stringify(true),
      __STABLE_URL__: JSON.stringify(isDev ? DEV_URLS.v7 : PROD_PATHS.v7),
      __BETA_URL__: JSON.stringify(isDev ? DEV_URLS.v9 : PROD_PATHS.v9),
    },
    server: {
      port: 5173,
      fs: { allow: [__dirname] },
    },
    build: {
      outDir: resolve(__dirname, 'dist/9.3.0'),
      emptyOutDir: true,
      rollupOptions: { input: rollupInputs },
    },
    resolve: {
      alias: {
        ...sharedAlias,
        '@bybrowser/editor': resolve(__dirname, '../../packages/editor-v9/src/index.ts'),
      },
      extensions: sharedExtensions,
    },
  };
});
