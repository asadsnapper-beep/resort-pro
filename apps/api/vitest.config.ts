import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env BEFORE any test modules are collected so Prisma gets DATABASE_URL
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Sequential file execution — tests share a real DB with no per-file isolation
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules', 'dist'],
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
