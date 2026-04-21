import { beforeAll, afterAll } from 'vitest';
import { prisma } from '@resort-pro/database';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
});

afterAll(async () => {
  await prisma.$disconnect();
});
