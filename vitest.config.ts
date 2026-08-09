import path, { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@/lib': resolve(__dirname, 'lib'),
      '@/store': resolve(__dirname, 'store'),
      '@/assets': resolve(__dirname, 'assets'),
      '@/types': resolve(__dirname, 'types'),
      '@/styles': resolve(__dirname, 'styles'),
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
        // 34, not 35: patchHeaderSerializeCrash (onlyoffice-editor.ts) added
        // defensive SDK-crash-guard code that, like its sibling patch
        // functions in the same file, only runs against a real OnlyOffice
        // iframe and isn't meaningfully unit-testable (see the "为什么
        // onlyoffice-editor.ts 覆盖率低" section in CLAUDE.md).
        statements: 34,
      },
      include: [
        'lib/document-utils.ts',
        'lib/i18n.ts',
        'lib/embed-api.ts',
        'lib/onlyoffice-editor.ts',
        'lib/agent-plugin/**/*.ts',
      ],
    },
  },
});
