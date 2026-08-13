import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Without this file, `vitest run` fell back to its default include glob,
// which also swept up tests/e2e/*.spec.ts. Those import Playwright's
// `test`/`test.describe` (a different test runner's API), so every one of
// them failed as soon as Vitest tried to collect it — `pnpm test` reported
// 4 broken suites before ever reaching a real unit test. Playwright specs
// belong only under `pnpm test:e2e` (playwright.config.ts's own testDir);
// Vitest should never see them.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/unit/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    // There are no real unit tests in this app yet (only the e2e specs
    // above). Vitest treats "0 tests" as a failure by default, which would
    // permanently red a `pnpm test` CI step with nothing anyone can act on.
    // Remove this once the first real unit test is added, so a genuinely
    // empty suite (e.g. from a future include-pattern typo) starts failing
    // loudly again instead of silently passing.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
