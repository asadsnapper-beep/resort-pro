/**
 * Payment routes — /api/payments
 *
 * Public (no auth):
 *   POST /bkash/initiate          ← guest initiates bKash payment
 *   GET  /bkash/callback          ← bKash redirects here after payment
 *   POST /ssl/initiate            ← guest initiates SSL payment
 *   POST /ssl/success             ← SSL posts here on success
 *   POST /ssl/fail                ← SSL posts here on fail
 *   POST /ssl/cancel              ← SSL posts here on cancel
 *   POST /stripe/intent           ← create PaymentIntent for guest booking
 *
 * Dashboard (auth required):
 *   GET  /settings                ← get payment gateway settings
 *   PATCH /settings               ← save payment gateway credentials
 *   GET  /settings/active/:slug   ← public: which gateways are active for a resort
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import Stripe from 'stripe'
import { prisma } from '@resort-pro/database'
import { requireAuth } from '../middleware/auth'
import type { JwtPayload } from '@resort-pro/types'
import { bkashGrantToken, bkashCreatePayment, bkashExecutePayment } from '../services/bkash'
import { sslInitPayment, sslValidatePayment } from '../services/ssl-commerce'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-06-20' as any,
})

const WEB_BASE = process.env.WEB_BASE_URL || 'http://localhost:3000'
const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBkashConfig(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { bkashEnabled: true, bkashAppKey: true, bkashAppSecret: true, bkashUsername: true, bkashPassword: true },
  })
  if (!t?.bkashEnabled || !t.bkashAppKey || !t.bkashAppSecret || !t.bkashUsername || !t.bkashPassword) {
    throw new Error('bKash not configured for this tenant')
  }
  return { appKey: t.bkashAppKey, appSecret: t.bkashAppSecret, username: t.bkashUsername, password: t.bkashPassword }
}

async function getSslConfig(tenantId: string) {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { sslEnabled: true, sslStoreId: true, sslStorePassword: true, sslIsLive: true },
  })
  if (!t?.sslEnabled || !t.sslStoreId || !t.sslStorePassword) {
    throw new Error('SSL Commerce not configured for this tenant')
  }
  return { storeId: t.sslStoreId, storePassword: t.sslStorePassword, isLive: t.sslIsLive }
}

async function confirmBooking(bookingId: string, gateway: string, txId: string, paymentId?: string) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paymentGateway: gateway,
      gatewayTxId: txId,
      gatewayPaymentId: paymentId ?? txId,
      paidAt: new Date(),
      paidAmount: await prisma.booking.findUnique({ where: { id: bookingId }, select: { totalAmount: true } })
        .then(b => b?.totalAmount ?? 0),
    },
  })
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function paymentRoutes(app: FastifyInstance) {

  // ── GET /settings/active/:slug — which gateways enabled (public) ──────────
  app.get('/settings/active/:slug', {
    handler: async (request, reply) => {
      const { slug } = request.params as { slug: string }
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: {
          id: true,
          bkashEnabled: true,
          sslEnabled: true,
          stripeGuestEnabled: true,
          currency: true,
        },
      })
      if (!tenant) return reply.code(404).send({ error: 'Resort not found' })

      return reply.send({
        success: true,
        data: {
          tenantId: tenant.id,
          bkash: tenant.bkashEnabled,
          ssl: tenant.sslEnabled,
          stripe: tenant.stripeGuestEnabled,
          manual: true, // always available
          currency: tenant.currency,
        },
      })
    },
  })

  // ── GET /settings — get gateway settings (dashboard) ─────────────────────
  app.get('/settings', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const t = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          bkashEnabled: true, bkashAppKey: true, bkashUsername: true,
          sslEnabled: true, sslStoreId: true, sslIsLive: true,
          stripeGuestEnabled: true,
        },
      })
      // Don't return secrets/passwords — only show whether they're set
      return reply.send({
        success: true,
        data: {
          bkash: {
            enabled: t?.bkashEnabled ?? false,
            appKey: t?.bkashAppKey ? '••••' + t.bkashAppKey.slice(-4) : '',
            username: t?.bkashUsername ?? '',
            configured: !!(t?.bkashAppKey && t?.bkashAppSecret && t?.bkashUsername && t?.bkashPassword),
          },
          ssl: {
            enabled: t?.sslEnabled ?? false,
            storeId: t?.sslStoreId ?? '',
            isLive: t?.sslIsLive ?? false,
            configured: !!(t?.sslStoreId && t?.sslStorePassword),
          },
          stripe: {
            enabled: t?.stripeGuestEnabled ?? false,
          },
        },
      })
    },
  })

  // ── PATCH /settings — save gateway credentials (dashboard) ───────────────
  const settingsSchema = z.object({
    bkash: z.object({
      enabled: z.boolean().optional(),
      appKey: z.string().optional(),
      appSecret: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
    }).optional(),
    ssl: z.object({
      enabled: z.boolean().optional(),
      storeId: z.string().optional(),
      storePassword: z.string().optional(),
      isLive: z.boolean().optional(),
    }).optional(),
    stripe: z.object({
      enabled: z.boolean().optional(),
    }).optional(),
  })

  app.patch('/settings', {
    preHandler: requireAuth,
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const body = settingsSchema.parse(request.body)

      const data: Record<string, unknown> = {}
      if (body.bkash) {
        if (body.bkash.enabled !== undefined) data.bkashEnabled = body.bkash.enabled
        if (body.bkash.appKey)    data.bkashAppKey    = body.bkash.appKey
        if (body.bkash.appSecret) data.bkashAppSecret = body.bkash.appSecret
        if (body.bkash.username)  data.bkashUsername  = body.bkash.username
        if (body.bkash.password)  data.bkashPassword  = body.bkash.password
      }
      if (body.ssl) {
        if (body.ssl.enabled !== undefined)  data.sslEnabled       = body.ssl.enabled
        if (body.ssl.storeId)                data.sslStoreId       = body.ssl.storeId
        if (body.ssl.storePassword)          data.sslStorePassword = body.ssl.storePassword
        if (body.ssl.isLive !== undefined)   data.sslIsLive        = body.ssl.isLive
      }
      if (body.stripe) {
        if (body.stripe.enabled !== undefined) data.stripeGuestEnabled = body.stripe.enabled
      }

      await prisma.tenant.update({ where: { id: tenantId }, data })
      return reply.send({ success: true })
    },
  })

  // ── POST /bkash/initiate ──────────────────────────────────────────────────
  app.post('/bkash/initiate', {
    handler: async (request, reply) => {
      const { bookingId } = z.object({ bookingId: z.string() }).parse(request.body)

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { tenant: true, guest: true },
      })
      if (!booking) return reply.code(404).send({ error: 'Booking not found' })
      if (booking.status === 'CONFIRMED') return reply.code(409).send({ error: 'Already paid' })

      const cfg = await getBkashConfig(booking.tenantId)
      const idToken = await bkashGrantToken(cfg)

      const callbackUrl = `${API_BASE}/api/payments/bkash/callback?bookingId=${bookingId}`
      const result = await bkashCreatePayment(cfg, idToken, {
        amount: Number(booking.totalAmount).toFixed(2),
        currency: booking.tenant.currency || 'BDT',
        merchantInvoiceNumber: booking.confirmationNo,
        callbackURL: callbackUrl,
      })

      // Save intermediate paymentID
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentGateway: 'BKASH', gatewayPaymentId: result.paymentID },
      })

      return reply.send({ success: true, data: { bkashURL: result.bkashURL, paymentID: result.paymentID } })
    },
  })

  // ── GET /bkash/callback ───────────────────────────────────────────────────
  app.get('/bkash/callback', {
    handler: async (request, reply) => {
      const { bookingId, paymentID, status } = request.query as Record<string, string>

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { tenant: true },
      })

      const slug = booking?.tenant?.slug ?? ''
      const failUrl = `${WEB_BASE}/${slug}?payment=failed`
      const cancelUrl = `${WEB_BASE}/${slug}?payment=cancelled`
      const successUrl = `${WEB_BASE}/${slug}?payment=success&ref=${booking?.confirmationNo}`

      if (!booking || !paymentID) return reply.redirect(failUrl)
      if (status === 'cancel') return reply.redirect(cancelUrl)
      if (status === 'failure') return reply.redirect(failUrl)

      try {
        const cfg = await getBkashConfig(booking.tenantId)
        const idToken = await bkashGrantToken(cfg)
        const exec = await bkashExecutePayment(cfg, idToken, paymentID)

        if (exec.transactionStatus === 'Completed') {
          await confirmBooking(bookingId, 'BKASH', exec.trxID, paymentID)
          return reply.redirect(successUrl)
        } else {
          return reply.redirect(failUrl)
        }
      } catch {
        return reply.redirect(failUrl)
      }
    },
  })

  // ── POST /ssl/initiate ────────────────────────────────────────────────────
  app.post('/ssl/initiate', {
    handler: async (request, reply) => {
      const { bookingId } = z.object({ bookingId: z.string() }).parse(request.body)

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { tenant: true, guest: true },
      })
      if (!booking) return reply.code(404).send({ error: 'Booking not found' })
      if (booking.status === 'CONFIRMED') return reply.code(409).send({ error: 'Already paid' })

      const cfg = await getSslConfig(booking.tenantId)
      const slug = booking.tenant.slug

      const result = await sslInitPayment(cfg, {
        tranId: booking.confirmationNo,
        amount: Number(booking.totalAmount),
        currency: booking.tenant.currency || 'BDT',
        productName: `Room Booking - ${booking.confirmationNo}`,
        customerName: `${booking.guest.firstName} ${booking.guest.lastName}`,
        customerEmail: booking.guest.email,
        customerPhone: booking.guest.phone ?? '01700000000',
        successUrl: `${API_BASE}/api/payments/ssl/success?bookingId=${bookingId}`,
        failUrl:    `${API_BASE}/api/payments/ssl/fail?bookingId=${bookingId}`,
        cancelUrl:  `${API_BASE}/api/payments/ssl/cancel?bookingId=${bookingId}`,
      })

      // Save tranId
      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentGateway: 'SSL', gatewayPaymentId: booking.confirmationNo },
      })

      return reply.send({ success: true, data: { gatewayUrl: result.GatewayPageURL } })
    },
  })

  // ── POST /ssl/success ─────────────────────────────────────────────────────
  app.post('/ssl/success', {
    handler: async (request, reply) => {
      const { bookingId } = request.query as { bookingId: string }
      const body = request.body as Record<string, string>
      const valId = body.val_id

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { tenant: true },
      })
      if (!booking) return reply.redirect(`${WEB_BASE}?payment=failed`)

      const slug = booking.tenant.slug
      try {
        const cfg = await getSslConfig(booking.tenantId)
        const validation = await sslValidatePayment(cfg, valId)

        if (validation.status === 'VALID' || validation.status === 'VALIDATED') {
          await confirmBooking(bookingId, 'SSL', valId, booking.confirmationNo)
          return reply.redirect(`${WEB_BASE}/${slug}?payment=success&ref=${booking.confirmationNo}`)
        } else {
          return reply.redirect(`${WEB_BASE}/${slug}?payment=failed`)
        }
      } catch {
        return reply.redirect(`${WEB_BASE}/${slug}?payment=failed`)
      }
    },
  })

  // ── POST /ssl/fail ────────────────────────────────────────────────────────
  app.post('/ssl/fail', {
    handler: async (request, reply) => {
      const { bookingId } = request.query as { bookingId: string }
      const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tenant: true } })
      const slug = booking?.tenant?.slug ?? ''
      return reply.redirect(`${WEB_BASE}/${slug}?payment=failed`)
    },
  })

  // ── POST /ssl/cancel ──────────────────────────────────────────────────────
  app.post('/ssl/cancel', {
    handler: async (request, reply) => {
      const { bookingId } = request.query as { bookingId: string }
      const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tenant: true } })
      const slug = booking?.tenant?.slug ?? ''
      return reply.redirect(`${WEB_BASE}/${slug}?payment=cancelled`)
    },
  })

  // ── POST /stripe/intent ───────────────────────────────────────────────────
  app.post('/stripe/intent', {
    handler: async (request, reply) => {
      const { bookingId } = z.object({ bookingId: z.string() }).parse(request.body)

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { tenant: true },
      })
      if (!booking) return reply.code(404).send({ error: 'Booking not found' })
      if (booking.status === 'CONFIRMED') return reply.code(409).send({ error: 'Already paid' })
      if (!booking.tenant.stripeGuestEnabled) return reply.code(400).send({ error: 'Stripe not enabled' })

      const amountCents = Math.round(Number(booking.totalAmount) * 100)
      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: (booking.tenant.currency || 'usd').toLowerCase(),
        metadata: { bookingId, confirmationNo: booking.confirmationNo, tenantId: booking.tenantId },
      })

      await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentGateway: 'STRIPE', stripePaymentIntentId: pi.id },
      })

      return reply.send({ success: true, data: { clientSecret: pi.client_secret } })
    },
  })
}
