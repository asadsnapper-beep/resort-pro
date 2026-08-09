import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';

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
