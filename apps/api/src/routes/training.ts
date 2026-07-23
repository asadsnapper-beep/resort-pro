import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';

const sessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  scheduledDate: z.string().datetime(),
  location: z.string().optional(),
  trainer: z.string().optional(),
  department: z.string().optional(),
});

export async function trainingRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: { tags: ['training'], summary: 'List training sessions', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request) => {
      const { db } = request;
      const sessions = await db.trainingSession.findMany({
        orderBy: { scheduledDate: 'desc' },
        include: { attendees: { select: { id: true, status: true } } },
      });
      return ok(sessions.map((s) => ({
        ...s,
        attendeeCount: s.attendees.length,
        attendedCount: s.attendees.filter((a) => a.status === 'ATTENDED').length,
      })));
    },
  });

  app.get('/:id', {
    schema: { tags: ['training'], summary: 'Get training session with attendees', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const session = await db.trainingSession.findUnique({
        where: { id },
        include: { attendees: { include: { staff: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      });
      if (!session) return reply.status(404).send({ success: false, error: 'Training session not found' });
      return ok(session);
    },
  });

  app.post('/', {
    schema: { tags: ['training'], summary: 'Create a training session', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const body = sessionSchema.parse(request.body);
      const session = await db.trainingSession.create({ data: { ...body, scheduledDate: new Date(body.scheduledDate) } });
      return reply.status(201).send(ok(session, 'Training session created'));
    },
  });

  app.patch('/:id', {
    schema: { tags: ['training'], summary: 'Update a training session', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = sessionSchema.partial().parse(request.body);
      const existing = await db.trainingSession.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ success: false, error: 'Training session not found' });
      const session = await db.trainingSession.update({
        where: { id },
        data: { ...body, ...(body.scheduledDate && { scheduledDate: new Date(body.scheduledDate) }) },
      });
      return ok(session, 'Training session updated');
    },
  });

  // Invite staff by explicit IDs and/or an entire department. TrainingAttendee has
  // no tenantId column (like other line-item models this session), so writes go
  // through a nested create under TrainingSession — never a direct
  // db.trainingAttendee.create(), which tenantPrisma would reject.
  app.post('/:id/invite', {
    schema: { tags: ['training'], summary: 'Invite staff (by id or department) to a session', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id } = request.params as { id: string };
      const body = z.object({
        staffIds: z.array(z.string().uuid()).optional(),
        department: z.string().optional(),
      }).parse(request.body);

      const session = await db.trainingSession.findUnique({ where: { id }, include: { attendees: true } });
      if (!session) return reply.status(404).send({ success: false, error: 'Training session not found' });

      const targetIds = new Set(body.staffIds ?? []);
      if (body.department) {
        const deptStaff = await db.staff.findMany({ where: { department: body.department as never, isActive: true }, select: { id: true } });
        deptStaff.forEach((s) => targetIds.add(s.id));
      }
      const already = new Set(session.attendees.map((a) => a.staffId));
      const newIds = [...targetIds].filter((sid) => !already.has(sid));

      if (newIds.length === 0) return ok(session, 'No new attendees to invite');

      const updated = await db.trainingSession.update({
        where: { id },
        data: { attendees: { create: newIds.map((staffId) => ({ staffId })) } },
        include: { attendees: true },
      });
      return reply.status(201).send(ok(updated, `${newIds.length} staff invited`));
    },
  });

  app.patch('/:id/attendees/:staffId', {
    schema: { tags: ['training'], summary: 'Mark attendee Attended/Missed', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { id, staffId } = request.params as { id: string; staffId: string };
      const body = z.object({ status: z.enum(['INVITED', 'ATTENDED', 'MISSED']) }).parse(request.body);

      const session = await db.trainingSession.findUnique({ where: { id }, include: { attendees: true } });
      if (!session) return reply.status(404).send({ success: false, error: 'Training session not found' });
      const attendee = session.attendees.find((a) => a.staffId === staffId);
      if (!attendee) return reply.status(404).send({ success: false, error: 'Attendee not found on this session' });

      const updated = await db.trainingSession.update({
        where: { id },
        data: { attendees: { update: { where: { id: attendee.id }, data: { status: body.status } } } },
        include: { attendees: true },
      });
      return ok(updated, 'Attendance updated');
    },
  });
}
