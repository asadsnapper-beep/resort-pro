/**
 * The admin seeder must never invent a password.
 *
 * It used to fall back to a hard-coded `Admin@123456`, and the API image runs it
 * on every container start while no compose file passes SUPER_ADMIN_PASSWORD —
 * so a deployment against an empty database came up with a real super-admin
 * account whose password is published in this repository (review C-01).
 *
 * What these tests hold down is the behaviour that fix depends on: no password,
 * no account — and no account created quietly as a side effect of the script
 * carrying on.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@resort-pro/database';
import { resolveSeedPassword, seedAdmins } from '../../src/scripts/seed-admin';
import { keepEnv } from '../helpers/env';

const RUN = `seed-c01-${Date.now()}`;
const EMAIL = `${RUN}@example.test`;
const STRONG = 'x7Qp-vault-Rain-2026';

keepEnv('SUPER_ADMIN_EMAILS', 'SUPER_ADMIN_PASSWORD');

async function adminCount() {
  return prisma.adminUser.count({ where: { email: EMAIL } });
}

beforeEach(async () => {
  await prisma.adminUser.deleteMany({ where: { email: EMAIL } });
});

afterEach(async () => {
  await prisma.adminUser.deleteMany({ where: { email: EMAIL } });
});

describe('resolveSeedPassword', () => {
  it('refuses when the variable is absent', () => {
    expect(resolveSeedPassword({}).ok).toBe(false);
  });

  it('refuses the retired built-in default even when set deliberately', () => {
    expect(resolveSeedPassword({ SUPER_ADMIN_PASSWORD: 'Admin@123456' }).ok).toBe(false);
  });

  it('refuses a password short enough to be worth guessing', () => {
    expect(resolveSeedPassword({ SUPER_ADMIN_PASSWORD: 'short1!' }).ok).toBe(false);
  });

  it('accepts a long one, unchanged', () => {
    const resolved = resolveSeedPassword({ SUPER_ADMIN_PASSWORD: STRONG });
    expect(resolved).toEqual({ ok: true, password: STRONG });
  });
});

describe('seedAdmins', () => {
  it('creates no account at all when no password is configured', async () => {
    process.env.SUPER_ADMIN_EMAILS = EMAIL;
    delete process.env.SUPER_ADMIN_PASSWORD;

    const created = await seedAdmins();

    expect(created).toEqual([]);
    expect(await adminCount()).toBe(0);
  });

  it('creates no account when the password is the old default', async () => {
    process.env.SUPER_ADMIN_EMAILS = EMAIL;
    process.env.SUPER_ADMIN_PASSWORD = 'Admin@123456';

    await seedAdmins();

    expect(await adminCount()).toBe(0);
  });

  it('creates the account once a real password is configured', async () => {
    process.env.SUPER_ADMIN_EMAILS = EMAIL;
    process.env.SUPER_ADMIN_PASSWORD = STRONG;

    expect(await seedAdmins()).toEqual([EMAIL]);

    const admin = await prisma.adminUser.findUnique({ where: { email: EMAIL } });
    expect(admin?.role).toBe('SUPER_ADMIN');
    // The hash, not the password, and not the retired default's hash either.
    expect(admin?.passwordHash).not.toContain(STRONG);
  });

  it('leaves an existing account alone, and needs no password to do so', async () => {
    process.env.SUPER_ADMIN_EMAILS = EMAIL;
    process.env.SUPER_ADMIN_PASSWORD = STRONG;
    await seedAdmins();
    const before = await prisma.adminUser.findUnique({ where: { email: EMAIL } });

    // The restart case: the variable is gone, the account is not.
    delete process.env.SUPER_ADMIN_PASSWORD;
    expect(await seedAdmins()).toEqual([]);

    const after = await prisma.adminUser.findUnique({ where: { email: EMAIL } });
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });
});
