import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/scripts/seed-demo.ts',
    'src/scripts/seed-admin.ts',
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
  ],
  sourcemap: true,
  clean: true,
  minify: false,
  // Needed so dotenv/config side-effect fires correctly
  banner: { js: '"use strict";' },
});
