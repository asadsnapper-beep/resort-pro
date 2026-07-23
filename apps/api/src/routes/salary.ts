import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';

const adjustmentSchema = z.object({
  type: z.enum(['RAISE', 'BONUS', 'DEDUCTION']),
  amount: z.number().positive(),
  reason: z.string().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function salaryRoutes(app: FastifyInstance) {
  app.get('/:staffId/adjustments', {
    schema: { tags: ['salary'], summary: 'List salary adjustment history for a staff member', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { staffId } = request.params as { staffId: string };
      const staff = await db.staff.findUnique({ where: { id: staffId } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });
      const adjustments = await db.salaryAdjustment.findMany({ where: { staffId }, orderBy: { effectiveDate: 'desc' } });
      return ok({ baseSalary: staff.baseSalary, adjustments });
    },
  });

  app.post('/:staffId/adjustments', {
    schema: { tags: ['salary'], summary: 'Record a salary adjustment', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER'),
    handler: async (request, reply) => {
      const { db } = request;
      const { staffId } = request.params as { staffId: string };
      const body = adjustmentSchema.parse(request.body);

      const staff = await db.staff.findUnique({ where: { id: staffId } });
      if (!staff) return reply.status(404).send({ success: false, error: 'Staff member not found' });

      const [adjustment] = await Promise.all([
        db.salaryAdjustment.create({
          data: { staffId, type: body.type, amount: body.amount, reason: body.reason, effectiveDate: new Date(body.effectiveDate) },
        }),
        ...(body.type === 'RAISE' ? [db.staff.update({ where: { id: staffId }, data: { baseSalary: body.amount } })] : []),
      ]);

      return reply.status(201).send(ok(adjustment, body.type === 'RAISE' ? 'Base salary updated' : 'Adjustment recorded'));
    },
  });
}
