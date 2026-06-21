import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@doc/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/store': resolve(__dirname, 'src/store'),
      '@/assets': resolve(__dirname, 'src/assets'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/styles': resolve(__dirname, 'src/styles'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['test/setup/vitest.ts'],
    include: ['test/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 35,
        branches: 25,
        functions: 35,
        statements: 35,
      },
      include: ['src/lib/document-utils.ts', 'src/lib/i18n.ts', 'src/lib/embed-api.ts', 'src/lib/onlyoffice-editor.ts'],
    },
  },
});
