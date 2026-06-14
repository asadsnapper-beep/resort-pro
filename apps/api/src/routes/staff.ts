import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok, paginated, parsePageParams } from '../utils/response';
import { sendEmail } from '../services/email';
import type { JwtPayload } from '@resort-pro/types';

const DEPARTMENTS = ['FRONT_DESK', 'HOUSEKEEPING', 'RESTAURANT', 'MAINTENANCE', 'SECURITY', 'MANAGEMENT'] as const;
const INVITE_ROLES = ['MANAGER', 'STAFF', 'RECEPTIONIST', 'MARKETER', 'DEVELOPER', 'SHAREHOLDER'] as const;

const createStaffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  department: z.enum(DEPARTMENTS),
  position: z.string().min(1),
  phone: z.string().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  role: z.enum(INVITE_ROLES).default('STAFF'),
});

export async function staffRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['staff'], summary: 'List all staff', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const query = request.query as { page?: number; limit?: number; department?: string; search?: string };
      const { page, limit, skip } = parsePageParams(query);

      const where: Record<string, unknown> = {
        ...(query.department && { department: query.department }),
        ...(query.search && {
          OR: [
            { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
            { user: { lastName:  { contains: query.search, mode: 'insensitive' } } },
            { user: { email:     { contains: query.search, mode: 'insensitive' } } },
            { position:          { contains: query.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [staff, total] = await Promise.all([
        db.staff.findMany({
          where,
          skip,
          take: limit,
          include: { user: { select: { email: true, firstName: true, lastName: true, role: true, isActive: true, lastLoginAt: true } } },
          orderBy: { user: { firstName: 'asc' } },
        }),
        db.staff.count({ where }),
      ]);

      return paginated(staff, total, page, limit);
    },
  });

  app.post('/', {
    schema: { tags: ['staff'], summary: 'Create staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = createStaffSchema.parse(request.body);

      // user.findFirst scoped by db — checks within this tenant
      const existing = await db.user.findFirst({ where: { email: body.email } });
      if (existing) return reply.status(409).send({ success: false, error: 'Email already in use' });

      const passwordHash = await bcrypt.hash(body.password, 12);

      const user = await db.user.create({
        data: {
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role,
        },
      });

      const staff = await db.staff.create({
        data: {
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
      const { db } = request;
      const { id } = request.params as { id: string };

      const staff = await db.staff.findFirst({ where: { id } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      const body = createStaffSchema.partial().omit({ email: true, password: true }).parse(request.body);
      const { firstName, lastName, ...staffFields } = body;

      // Run both updates atomically; re-fetch after so includes reflect latest user data
      await db.$transaction([
        db.staff.update({ where: { id }, data: staffFields }),
        ...(firstName || lastName
          ? [db.user.update({
              where: { id: staff.userId },
              data: { ...(firstName && { firstName }), ...(lastName && { lastName }) },
            })]
          : []),
      ]);

      const updated = await db.staff.findFirst({
        where: { id },
        include: { user: { select: { email: true, firstName: true, lastName: true, role: true, isActive: true, lastLoginAt: true } } },
      });
      return ok(updated, 'Staff updated');
    },
  });

  app.delete('/:id', {
    schema: { tags: ['staff'], summary: 'Deactivate staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const staff = await db.staff.findFirst({ where: { id }, include: { user: true } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      await Promise.all([
        db.staff.update({ where: { id }, data: { isActive: false } }),
        db.user.update({ where: { id: staff.userId }, data: { isActive: false } }),
      ]);

      return ok(null, 'Staff member deactivated');
    },
  });

  // PATCH /api/staff/:id/reactivate — reactivate a deactivated staff member
  app.patch('/:id/reactivate', {
    schema: { tags: ['staff'], summary: 'Reactivate staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };

      const staff = await db.staff.findFirst({ where: { id }, include: { user: true } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      await Promise.all([
        db.staff.update({ where: { id }, data: { isActive: true } }),
        db.user.update({ where: { id: staff.userId }, data: { isActive: true } }),
      ]);

      return ok(null, 'Staff member reactivated');
    },
  });

  // POST /api/staff/invite — send email invite to a new staff member
  app.post('/invite', {
    schema: { tags: ['staff'], summary: 'Invite staff member by email', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { tenantId } = request.user as JwtPayload;
      const body = z.object({
        email: z.string().email(),
        role: z.enum(INVITE_ROLES).default('STAFF'),
      }).parse(request.body);

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } });
      if (!tenant) return reply.status(404).send({ success: false, error: 'Tenant not found' });

      // Check if user already exists
      const existing = await db.user.findUnique({
        where: { tenantId_email: { tenantId, email: body.email } },
      });
      if (existing) return reply.status(409).send({ success: false, error: 'A staff member with this email already exists.' });

      // Expire old unused invites for this email
      await db.staffInvite.updateMany({
        where: { email: body.email, used: false },
        data: { used: true },
      });

      const token = randomBytes(32).toString('hex');
      await db.staffInvite.create({
        data: { email: body.email, role: body.role, token, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
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
      const { db } = request;
      const invites = await db.staffInvite.findMany({
        where: { used: false, expiresAt: { gt: new Date() } },
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
      const { db } = request;
      const { id } = request.params as { id: string };
      await db.staffInvite.updateMany({ where: { id }, data: { used: true } });
      return ok(null, 'Invite cancelled');
    },
  });
}
