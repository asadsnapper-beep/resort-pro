import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';

type AdminRole = 'SUPER_ADMIN' | 'SUPPORT' | 'FINANCE' | 'VIEWER';

/**
 * An admin token that the API will actually accept.
 *
 * Admin tokens name a session row, and a token without one is refused — that is
 * the point of revocable sessions. So a test cannot sign its own admin JWT any
 * more; it needs a real AdminUser and a real session, which is what this makes.
 *
 * Returns the session id too, so a test can revoke it and watch the token die.
 */
export async function signAdmin(app: FastifyInstance, opts: {
  email: string;
  role?: AdminRole;
  expiresAt?: Date;
}): Promise<{ token: string; adminUserId: string; sessionId: string }> {
  const role = opts.role ?? 'SUPER_ADMIN';

  const adminUser = await prisma.adminUser.upsert({
    where: { email: opts.email },
    update: { role, isActive: true },
    create: {
      email: opts.email,
      // Not a sign-in path: these tokens are signed directly, so the hash only
      // has to be something bcrypt will not match by accident.
      passwordHash: 'not-a-usable-hash',
      role,
      firstName: 'Test',
      lastName: 'Admin',
    },
    select: { id: true },
  });

  const session = await prisma.adminSession.create({
    data: {
      adminUserId: adminUser.id,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 8 * 60 * 60 * 1000),
    },
    select: { id: true },
  });

  const token = app.jwt.sign({
    sub: adminUser.id,
    email: opts.email,
    adminRole: role,
    isSuperAdmin: role === 'SUPER_ADMIN',
    sid: session.id,
  }, { expiresIn: '8h' });

  return { token, adminUserId: adminUser.id, sessionId: session.id };
}

/** Complete the email-verification boundary for integration fixtures. */
export async function verifyOwnerAndLogin(app: FastifyInstance, input: {
  tenantId: string;
  email: string;
  password: string;
  slug: string;
}) {
  await prisma.user.update({
    where: { tenantId_email: { tenantId: input.tenantId, email: input.email } },
    data: { emailVerifiedAt: new Date() },
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: input.email, password: input.password, slug: input.slug },
  });
  if (response.statusCode !== 200) {
    throw new Error(`Fixture login failed (${response.statusCode}): ${response.body}`);
  }
  return JSON.parse(response.body).data.token as string;
}
