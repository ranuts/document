import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { workspaceSourceAliases } from './bin/workspace-aliases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [{ find: '@', replacement: __dirname }, ...workspaceSourceAliases(__dirname)],
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
        // Application regressions must not hide behind vendor-only E2E coverage.
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
        'lib/agent-plugin/**/*.ts': { lines: 85, branches: 80, functions: 85, statements: 80 },
        'lib/history/**/*.ts': { lines: 85, branches: 75, functions: 85, statements: 85 },
        'packages/shared/src/**/*.ts': { lines: 90, branches: 80, functions: 90, statements: 90 },
        'packages/converter/src/**/*.ts': { lines: 60, branches: 55, functions: 65, statements: 60 },
        'packages/agent-core/src/**/*.ts': { lines: 80, branches: 75, functions: 75, statements: 75 },
        'packages/chat-ui/src/**/*.ts': { lines: 90, branches: 80, functions: 90, statements: 90 },
      },
      include: ['lib/**/*.ts', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.d.ts'],
    },
  },
});
