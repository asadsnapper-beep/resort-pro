/**
 * /embed — public endpoints consumed by the embed.js SDK
 *
 * These routes MUST set Access-Control-Allow-Origin: * because embed.js
 * is loaded on arbitrary customer websites (not our own domains).
 *
 * Routes:
 *   GET  /embed/config/:slug  — single call to bootstrap a widget session
 *   POST /embed/:slug/orders  — standalone food order (no booking required)
 *   POST /embed/:slug/book    — alias of /site/:slug/book (same handler, CORS *)
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@resort-pro/database'
import { ok } from '../utils/response'

/** Apply CORS * headers to every response in this plugin scope */
function applyCors(reply: { header: (k: string, v: string) => void }) {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export async function embedRoutes(app: FastifyInstance) {
  // Pre-flight handler for all embed routes
  app.options('*', async (_request, reply) => {
    applyCors(reply)
    return reply.status(204).send()
  })

  // ── GET /embed/config/:slug ───────────────────────────────────────────────
  // Single bootstrapping call — returns everything the SDK needs to init a widget
  app.get<{ Params: { slug: string } }>('/config/:slug', {
    schema: { tags: ['embed'], summary: 'Embed SDK bootstrap config' },
    handler: async (request, reply) => {
      applyCors(reply)
      const { slug } = request.params

      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          checkInTime: true,
          checkOutTime: true,
          logoUrl: true,
          isActive: true,
          // Gateway credentials — only the "enabled" flags, never the secrets
          bkashUsername: true,
          sslStoreId: true,
          stripeGuestEnabled: true,
          websiteContent: {
            select: {
              primaryColor: true,
            },
          },
        },
      })

      if (!tenant || !tenant.isActive) {
        return reply.status(404).send({ success: false, error: 'Resort not found' })
      }

      // Determine which gateways are active
      const gateways = {
        bkash:  Boolean(tenant.bkashUsername),
        ssl:    Boolean(tenant.sslStoreId),
        stripe: Boolean(tenant.stripeGuestEnabled),
        manual: true, // always available as fallback
      }

      return ok({
        tenantId:      tenant.id,
        slug:          tenant.slug,
        name:          tenant.name,
        currency:      tenant.currency,
        checkInTime:   tenant.checkInTime  || '14:00',
        checkOutTime:  tenant.checkOutTime || '12:00',
        logo:          tenant.logoUrl      || null,
        color:         tenant.websiteContent?.primaryColor || '#1a6b5e',
        gateways,
        // Stripe publishable key is safe to expose (it's meant for client-side)
        stripePublishableKey: gateways.stripe ? (process.env.STRIPE_PUBLISHABLE_KEY || null) : null,
      })
    },
  })

  // ── POST /embed/:slug/orders — standalone food order ─────────────────────
  const orderSchema = z.object({
    guestName:   z.string().min(1),
    guestEmail:  z.string().email().optional(),
    guestPhone:  z.string().optional(),
    bookingRef:  z.string().optional(),
    tableNo:     z.string().optional(),
    items: z.array(z.object({
      menuItemId: z.string(),
      quantity:   z.number().int().min(1),
      notes:      z.string().optional(),
    })).min(1),
  })

  app.post<{ Params: { slug: string }; Body: z.infer<typeof orderSchema> }>('/:slug/orders', {
    schema: { tags: ['embed'], summary: 'Place food order from embed widget' },
    handler: async (request, reply) => {
      applyCors(reply)
      const { slug } = request.params
      const body = orderSchema.parse(request.body)

      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, isActive: true },
      })
      if (!tenant || !tenant.isActive) {
        return reply.status(404).send({ success: false, error: 'Resort not found' })
      }

      // Resolve menu items
      const menuItems = await prisma.menuItem.findMany({
        where: {
          tenantId: tenant.id,
          id: { in: body.items.map(i => i.menuItemId) },
          isAvailable: true,
        },
      })

      if (menuItems.length !== body.items.length) {
        return reply.status(400).send({ success: false, error: 'One or more items are unavailable' })
      }

      const totalAmount = body.items.reduce((sum, item) => {
        const mi = menuItems.find(m => m.id === item.menuItemId)!
        return sum + Number(mi.price) * item.quantity
      }, 0)

      // Resolve guest by email
      let guestId: string | undefined
      if (body.guestEmail) {
        const guest = await prisma.guest.findFirst({
          where: { tenantId: tenant.id, email: body.guestEmail },
        })
        if (guest) guestId = guest.id
      }

      // Resolve booking by ref
      let bookingId: string | undefined
      if (body.bookingRef) {
        const booking = await prisma.booking.findFirst({
          where: {
            tenantId: tenant.id,
            confirmationNo: body.bookingRef,
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          },
        })
        if (booking) {
          bookingId = booking.id
          if (!guestId) guestId = booking.guestId
        }
      }

      const order = await prisma.foodOrder.create({
        data: {
          tenantId: tenant.id,
          guestId,
          bookingId,
          tableNumber: body.tableNo,
          notes: `Embed order — ${body.guestName}${body.guestPhone ? ` (${body.guestPhone})` : ''}`,
          totalAmount,
          status: 'PENDING',
          items: {
            create: body.items.map(item => {
              const mi = menuItems.find(m => m.id === item.menuItemId)!
              return {
                menuItemId: item.menuItemId,
                quantity:   item.quantity,
                unitPrice:  mi.price,
                notes:      item.notes,
              }
            }),
          },
        },
      })

      return reply.status(201).send(ok({
        orderId:     order.id,
        total:       totalAmount,
      }, 'Order received!'))
    },
  })

  // ── POST /embed/:slug/book — booking alias with CORS * ───────────────────
  const bookSchema = z.object({
    firstName:       z.string().min(1),
    lastName:        z.string().min(1),
    email:           z.string().email(),
    phone:           z.string().optional(),
    roomId:          z.string(),
    checkIn:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults:          z.number().int().min(1).default(1),
    specialRequests: z.string().optional(),
  })

  app.post<{ Params: { slug: string }; Body: z.infer<typeof bookSchema> }>('/:slug/book', {
    schema: { tags: ['embed'], summary: 'Create booking from embed widget' },
    handler: async (request, reply) => {
      applyCors(reply)
      const { slug } = request.params
      const body = bookSchema.parse(request.body)

      const tenant = await prisma.tenant.findUnique({ where: { slug } })
      if (!tenant || !tenant.isActive) {
        return reply.status(404).send({ success: false, error: 'Resort not found' })
      }

      const checkIn  = new Date(body.checkIn)
      const checkOut = new Date(body.checkOut)
      if (checkOut <= checkIn) {
        return reply.status(400).send({ success: false, error: 'Check-out must be after check-in' })
      }

      const room = await prisma.room.findFirst({
        where: { id: body.roomId, tenantId: tenant.id, isActive: true },
      })
      if (!room) return reply.status(404).send({ success: false, error: 'Room not found' })

      // Conflict check
      const conflict = await prisma.booking.findFirst({
        where: {
          tenantId: tenant.id,
          roomId: room.id,
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          AND: [{ checkIn: { lt: checkOut } }, { checkOut: { gt: checkIn } }],
        },
      })
      if (conflict) return reply.status(409).send({ success: false, error: 'Room not available for selected dates' })

      // Upsert guest
      let guest = await prisma.guest.findFirst({ where: { tenantId: tenant.id, email: body.email } })
      if (!guest) {
        guest = await prisma.guest.create({
          data: {
            tenantId:  tenant.id,
            firstName: body.firstName,
            lastName:  body.lastName,
            email:     body.email,
            phone:     body.phone,
          },
        })
      }

      const nights      = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86_400_000))
      const totalAmount = Number(room.basePrice) * nights

      const booking = await prisma.booking.create({
        data: {
          tenantId:        tenant.id,
          guestId:         guest.id,
          roomId:          room.id,
          checkIn,
          checkOut,
          adults:          body.adults,
          totalAmount,
          specialRequests: body.specialRequests,
          status:          'PENDING',
          paymentStatus:   'PENDING',
          confirmationNo:  `EMB-${Date.now().toString(36).toUpperCase()}`,
        },
      })

      return reply.status(201).send(ok({
        id:             booking.id,
        confirmationNo: booking.confirmationNo,
        totalAmount,
        nights,
      }, 'Booking created!'))
    },
  })
}
