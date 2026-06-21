import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { injectCriticalStyle, injectGtag } from './vite-plugins';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  return {
    root: 'pages',
    base: './',
    publicDir: resolve(__dirname, 'public-stable'),
    plugins: [injectCriticalStyle(), injectGtag()],
    define: {
      __IS_BETA__: JSON.stringify(false),
      __STABLE_URL__: JSON.stringify(isDev ? 'http://localhost:5174/' : '/'),
      __BETA_URL__: JSON.stringify(isDev ? 'http://localhost:5173/' : '/9.3.0/'),
    },
    server: {
      port: 5174,
      fs: {
        allow: [__dirname],
      },
    },
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'pages/index.html'),
          privateDocumentEditor: resolve(__dirname, 'pages/private-document-editor/index.html'),
          docxEditor: resolve(__dirname, 'pages/docx-editor/index.html'),
          xlsxEditor: resolve(__dirname, 'pages/xlsx-editor/index.html'),
          pptxEditor: resolve(__dirname, 'pages/pptx-editor/index.html'),
          csvEditor: resolve(__dirname, 'pages/csv-editor/index.html'),
          onlyofficeWasm: resolve(__dirname, 'pages/onlyoffice-wasm/index.html'),
          embedDocumentEditor: resolve(__dirname, 'pages/embed-document-editor/index.html'),
          selfHostedDocumentEditor: resolve(__dirname, 'pages/self-hosted-document-editor/index.html'),
          zhCnMain: resolve(__dirname, 'pages/zh-cn/index.html'),
          zhCnDocxEditor: resolve(__dirname, 'pages/zh-cn/docx-editor/index.html'),
          zhCnXlsxEditor: resolve(__dirname, 'pages/zh-cn/xlsx-editor/index.html'),
          zhCnPptxEditor: resolve(__dirname, 'pages/zh-cn/pptx-editor/index.html'),
          zhCnCsvEditor: resolve(__dirname, 'pages/zh-cn/csv-editor/index.html'),
          zhCnPrivateDocumentEditor: resolve(__dirname, 'pages/zh-cn/private-document-editor/index.html'),
          zhCnOnlyofficeWasm: resolve(__dirname, 'pages/zh-cn/onlyoffice-wasm/index.html'),
          zhCnEmbedDocumentEditor: resolve(__dirname, 'pages/zh-cn/embed-document-editor/index.html'),
          zhCnSelfHostedDocumentEditor: resolve(__dirname, 'pages/zh-cn/self-hosted-document-editor/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@/lib': resolve(__dirname, 'src/lib'),
        '@/store': resolve(__dirname, 'src/store'),
        '@/types': resolve(__dirname, 'src/types'),
        '@/styles': resolve(__dirname, 'src/styles'),
        '@bybrowser/editor': resolve(__dirname, '../../packages/editor-v7/src/index.ts'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/base.css";`,
        },
      },
    },
  };
});
