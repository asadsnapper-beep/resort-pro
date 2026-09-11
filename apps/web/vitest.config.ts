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
    // `passWithNoTests` was here while this app had no unit tests at all, with
    // a note to remove it as soon as the first one arrived. src/lib/api.test.ts
    // is that test, so it is gone: an empty suite — from an include-pattern
    // typo, say — now fails loudly again instead of passing silently.
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
