import { beforeAll, afterAll } from 'vitest';
import { prisma } from '@resort-pro/database';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from apps/api root so DATABASE_URL is available for Prisma
config({ path: resolve(__dirname, '../.env') });

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  // Allow CI to override with a separate test DB
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
