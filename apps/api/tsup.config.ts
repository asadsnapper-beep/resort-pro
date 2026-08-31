import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/worker.ts',
    'src/scripts/seed-demo.ts',
    'src/scripts/seed-admin.ts',
    // Run manually, not at startup — but it has to exist in the image to be
    // runnable at all. The container ships only dist/, with no tsx.
    'src/scripts/backfill-finalized-invoices.ts',
  ],
  format: ['cjs'],
  outDir: 'dist',
  // Workspace packages → inline into the bundle (no TS source in runtime)
  noExternal: ['@resort-pro/types', '@resort-pro/database', '@resort-pro/payment-registry'],
  // Keep these as runtime require()s — they have native binaries or are huge
  external: [
    '@prisma/client',
    'better-sqlite3',
    'fsevents',
    'bufferutil',
    'utf-8-validate',
    'tesseract.js',
    'mrz',
  ],
  sourcemap: true,
  clean: true,
  minify: false,
  // Needed so dotenv/config side-effect fires correctly
  banner: { js: '"use strict";' },
});
