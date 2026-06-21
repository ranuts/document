import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

/** All MPA page entry points — shared across every version config. */
export const rollupInputs = {
  main: resolve(__dirname, 'pages/index.html'),
  privateDocumentEditor: resolve(__dirname, 'pages/private-document-editor/index.html'),
  // Clean editor routes: /docx/ /xlsx/ /pptx/ /csv/
  docx: resolve(__dirname, 'pages/docx/index.html'),
  xlsx: resolve(__dirname, 'pages/xlsx/index.html'),
  pptx: resolve(__dirname, 'pages/pptx/index.html'),
  csv: resolve(__dirname, 'pages/csv/index.html'),
  // Legacy SEO landing pages (kept for backward compatibility)
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
};

/** Path aliases shared across every version config. */
export const sharedAlias = {
  '@/lib': resolve(__dirname, 'src/lib'),
  '@/store': resolve(__dirname, 'src/store'),
  '@/types': resolve(__dirname, 'src/types'),
  '@/styles': resolve(__dirname, 'src/styles'),
};

export const sharedExtensions = ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'];

/** Dev-mode base URLs for cross-version navigation. */
export const DEV_URLS = {
  v7: 'http://localhost:5174/',
  v9: 'http://localhost:5173/',
};

/** Production path prefixes per version. */
export const PROD_PATHS = {
  v7: '/',
  v9: '/9.3.0/',
};
