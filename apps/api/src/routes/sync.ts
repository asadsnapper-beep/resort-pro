/**
 * sync.ts — Desktop offline-first sync endpoint
 *
 * GET /api/sync/pull
 *   Returns a snapshot of the tenant's data for local SQLite caching.
 *   Supports incremental sync via ?since=<ISO-timestamp>
 *   Requires JWT auth (same as all other routes).
 *
 * The Electron app calls this on:
 *   1. Login (full pull — no ?since param)
 *   2. Reconnect after offline (incremental — ?since=last_synced)
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import type { JwtPayload } from '@resort-pro/types';

export async function syncRoutes(app: FastifyInstance) {
  // ─── GET /api/sync/pull ────────────────────────────────────────────────────
  app.get('/pull', {
    schema: {
      tags: ['sync'],
      summary: 'Pull latest data snapshot for offline use',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', description: 'ISO-8601 timestamp — only return records updated after this' },
        },
      },
    },
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const query = request.query as { since?: string };

      // Parse the 'since' cursor — if missing, do a full pull
      let sinceDate: Date | undefined;
      if (query.since) {
        const parsed = new Date(query.since);
        if (isNaN(parsed.getTime())) {
          return reply.status(400).send({ success: false, error: 'Invalid since date' });
        }
        sinceDate = parsed;
      }

      const updatedFilter = sinceDate ? { updatedAt: { gte: sinceDate } } : {};

      // Pull all entities in parallel
      const [guests, rooms, bookings, housekeepingTasks, foodOrders] = await Promise.all([
        // Guests
        prisma.guest.findMany({
          where: { tenantId, ...updatedFilter },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            nationality: true,
            idType: true,
            idNumber: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 2000,
        }),

        // Rooms
        prisma.room.findMany({
          where: { tenantId, ...updatedFilter },
          select: {
            id: true,
            name: true,
            number: true,
            type: true,
            floor: true,
            maxOccupancy: true,
            basePrice: true,
            status: true,
            amenities: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { number: 'asc' },
        }),

        // Bookings — last 90 days + future
        prisma.booking.findMany({
          where: {
            tenantId,
            ...(sinceDate
              ? { updatedAt: { gte: sinceDate } }
              : { checkOut: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }),
          },
          select: {
            id: true,
            guestId: true,
            roomId: true,
            checkIn: true,
            checkOut: true,
            status: true,
            totalAmount: true,
            paidAmount: true,
            paymentStatus: true,
            source: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            guest: { select: { firstName: true, lastName: true } },
            room:  { select: { number: true, name: true } },
          },
          orderBy: { checkIn: 'desc' },
          take: 1000,
        }),

        // Housekeeping tasks — today + 7 days ahead
        prisma.housekeepingTask.findMany({
          where: {
            tenantId,
            ...(sinceDate
              ? { updatedAt: { gte: sinceDate } }
              : { scheduledDate: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
          },
          select: {
            id: true,
            roomId: true,
            type: true,
            status: true,
            assignedToId: true,
            notes: true,
            scheduledDate: true,
            createdAt: true,
            updatedAt: true,
            room: { select: { number: true } },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 500,
        }),

        // Food orders — last 3 days
        prisma.foodOrder.findMany({
          where: {
            tenantId,
            ...(sinceDate
              ? { updatedAt: { gte: sinceDate } }
              : { createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } }),
          },
          select: {
            id: true,
            bookingId: true,
            tableNumber: true,
            status: true,
            totalAmount: true,
            notes: true,
            createdAt: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                quantity: true,
                unitPrice: true,
                menuItem: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ]);

      return reply.send({
        success: true,
        syncedAt: new Date().toISOString(),
        since: sinceDate?.toISOString() ?? null,
        counts: {
          guests:           guests.length,
          rooms:            rooms.length,
          bookings:         bookings.length,
          housekeepingTasks: housekeepingTasks.length,
          foodOrders:       foodOrders.length,
        },
        data: {
          guests,
          rooms,
          bookings,
          housekeepingTasks,
          foodOrders,
        },
      });
    },
  });
}
