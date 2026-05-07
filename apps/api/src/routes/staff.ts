import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams, validate } from '../utils/response';
import { sendEmail } from '../services/email';
import type { JwtPayload } from '@resort-pro/types';

const createStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  department: z.enum(['FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT']),
  position: z.string().min(1),
  phone: z.string().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function staffRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['staff'], summary: 'List all staff', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { page?: number; limit?: number; department?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where = {
        tenantId,
        ...(query.department && { department: query.department as never }),
      };

      const [staff, total] = await Promise.all([
        prisma.staff.findMany({
          where,
          skip,
          take: limit,
          include: { user: { select: { email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true } } },
          orderBy: { user: { firstName: 'asc' } },
        }),
        prisma.staff.count({ where }),
      ]);

      return paginated(staff, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['staff'], summary: 'Create staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = createStaffSchema.parse(request.body);

      const existing = await prisma.user.findFirst({ where: { tenantId, email: body.email } });
      if (existing) return reply.status(409).send({ success: false, error: 'Email already in use' });

      const passwordHash = await bcrypt.hash(body.password, 12);

      const user = await prisma.user.create({
        data: {
          tenantId,
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          role: 'STAFF',
        },
      });

      const staff = await prisma.staff.create({
        data: {
          tenantId,
          userId: user.id,
          department: body.department,
          position: body.position,
          phone: body.phone,
          hireDate: new Date(body.hireDate),
        },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      });

      return reply.status(201).send(ok(staff, 'Staff member created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['staff'], summary: 'Update staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const staff = await prisma.staff.findFirst({ where: { id, tenantId } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      const body = createStaffSchema.partial().omit({ email: true, password: true }).parse(request.body);
      const updated = await prisma.staff.update({ where: { id }, data: body });
      return ok(updated, 'Staff updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['staff'], summary: 'Deactivate staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };

      const staff = await prisma.staff.findFirst({ where: { id, tenantId }, include: { user: true } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      await Promise.all([
        prisma.staff.update({ where: { id }, data: { isActive: false } }),
        prisma.user.update({ where: { id: staff.userId }, data: { isActive: false } }),
      ]);

      return ok(null, 'Staff member deactivated');
    },
  });

  // POST /api/staff/invite — send email invite to a new staff member
  app.post('/invite', {
    schema: { tags: ['staff'], summary: 'Invite staff member by email', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const body = z.object({
        email: z.string().email(),
        role: z.enum(['MANAGER', 'STAFF']).default('STAFF'),
      }).parse(request.body);

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      // Check if user already exists
      const existing = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: body.email } },
      });
      if (existing) return reply.status(409).send({ success: false, error: 'A staff member with this email already exists.' });

      // Expire old unused invites for this email
      await prisma.staffInvite.updateMany({
        where: { tenantId, email: body.email, used: false },
        data: { used: true },
      });

      const token = randomBytes(32).toString('hex');
      await prisma.staffInvite.create({
        data: { tenantId, email: body.email, role: body.role, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      const webUrl = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:3000';
      const inviteUrl = `${webUrl}/auth/invite?token=${token}`;

      await sendEmail({
        to: body.email,
        subject: `You've been invited to join ${tenant.name} on ResortPro`,
        html: `
          <h2>You're invited! 🎉</h2>
          <p>You've been invited to join <strong>${tenant.name}</strong> as a ${body.role.toLowerCase()} on ResortPro.</p>
          <p style="margin:24px 0">
            <a href="${inviteUrl}" style="background:#1a6b5e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Accept Invite
            </a>
          </p>
          <p>Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a></p>
          <p><small>This invite expires in 7 days.</small></p>
        `,
      });

      return ok({ email: body.email, role: body.role }, 'Invite sent successfully');
    },
  });

  // GET /api/staff/invites — list pending invites
  app.get('/invites', {
    schema: { tags: ['staff'], summary: 'List pending staff invites', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const invites = await prisma.staffInvite.findMany({
        where: { tenantId, used: false, expiresAt: { gt: new Date() } },
        select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      });
      return ok(invites);
    },
  });

  // DELETE /api/staff/invites/:id — cancel invite
  app.delete('/invites/:id', {
    schema: { tags: ['staff'], summary: 'Cancel a pending invite', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const { id } = request.params as { id: string };
      await prisma.staffInvite.updateMany({ where: { id, tenantId }, data: { used: true } });
      return ok(null, 'Invite cancelled');
    },
  });
}
