/**
 * Payment Gateway Registry Routes — /api/payments
 *
 * ── Public (no auth) ───────────────────────────────────────────────────────
 *   GET  /gateways/:countryCode         → available gateways for a country
 *   GET  /gateways/tenant/:slug         → enabled gateways for a specific resort
 *   POST /checkout/init                 → initiate payment for a booking
 *   POST /checkout/verify               → verify after redirect (return URL)
 *   POST /webhook/:provider             → gateway webhook callbacks
 *
 * ── Dashboard (auth required) ─────────────────────────────────────────────
 *   GET  /config                        → get tenant's payment config
 *   PUT  /config                        → save gateway credentials (OWNER only)
 *   GET  /history                       → payment transaction list
 *   GET  /history/:id                   → single payment detail
 */

import type { FastifyInstance } from 'fastify';
import { z }                    from 'zod';
import { prisma }               from '@resort-pro/database';
import {
  getGateway,
  getGatewaysForCountry,
  getCurrency,
  formatAmount,
  toSmallestUnit,
  type GatewayId,
}                               from '@resort-pro/payment-registry';
import { requireAuth }          from '../middleware/auth';
import type { JwtPayload }      from '@resort-pro/types';

const WEB_BASE = process.env.WEB_BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Get credentials for a gateway from TenantPaymentConfig */
async function getTenantCredentials(
  tenantId: string,
  gateway: GatewayId,
): Promise<Record<string, string>> {
  const config = await prisma.tenantPaymentConfig.findUnique({
    where: { tenantId },
    select: { credentials: true },
  });

  if (!config) throw new Error('Payment not configured for this tenant');

  const creds = config.credentials as Record<string, Record<string, string>>;
  const gatewayCreds = creds[gateway];

  if (!gatewayCreds) throw new Error(`Gateway "${gateway}" credentials not found`);

  // TODO: decrypt in production (AES-256)
  return gatewayCreds;
}

/** Mark booking as paid after successful payment */
async function markBookingPaid(
  bookingId: string,
  gateway: string,
  transactionId: string,
  paymentId: string,
  amountInSmallest: number,
) {
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status:           'CONFIRMED',
      paymentStatus:    'PAID',
      paymentGateway:   gateway.toUpperCase(),
      gatewayTxId:      transactionId,
      gatewayPaymentId: paymentId,
      paidAt:           new Date(),
      paidAmount:       amountInSmallest / 100,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

export async function paymentRoutes(app: FastifyInstance) {

  // ── GET /gateways/:countryCode ────────────────────────────────────────────
  app.get<{ Params: { countryCode: string } }>('/gateways/:countryCode', {
    schema: { tags: ['Payments'], summary: 'Available gateways for a country' },
  }, async (req, reply) => {
    const gateways = getGatewaysForCountry(req.params.countryCode);
    return reply.send({
      success: true,
      data: gateways.map(gw => ({
        id:           gw.meta.id,
        name:         gw.meta.name,
        logo:         gw.meta.logo,
        methods:      gw.meta.methods,
        status:       gw.meta.status,
        redirectFlow: gw.meta.redirectFlow,
      })),
    });
  });

  // ── GET /gateways/tenant/:slug — enabled gateways for a resort ────────────
  app.get<{ Params: { slug: string } }>('/gateways/tenant/:slug', {
    schema: { tags: ['Payments'], summary: 'Enabled gateways for a resort slug' },
  }, async (req, reply) => {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, country: true, currency: true, paymentConfig: true },
    });

    if (!tenant) return reply.status(404).send({ success: false, error: 'Resort not found' });

    const config         = tenant.paymentConfig;
    const country        = tenant.country ?? 'BD';
    const activeGateway  = (config?.activeGateway ?? 'manual') as GatewayId;
    // If no config, show all country gateways; otherwise only enabled ones
    const enabledMethods = config?.enabledMethods ?? null;
    const allGateways    = getGatewaysForCountry(country);

    return reply.send({
      success: true,
      data: {
        activeGateway,
        enabledMethods: enabledMethods ?? allGateways.filter(g => g.meta.status === 'active').map(g => g.meta.id),
        currency:           getCurrency(country),
        gateways:           allGateways
          .filter(gw => gw.meta.status === 'active' && (!enabledMethods || enabledMethods.includes(gw.meta.id)))
          .map(gw => ({
            id:           gw.meta.id,
            name:         gw.meta.name,
            logo:         gw.meta.logo,
            methods:      gw.meta.methods,
            redirectFlow: gw.meta.redirectFlow,
          })),
        manualInstructions: config?.manualInstructions ?? null,
      },
    });
  });

  // ── GET /checkout/booking/:bookingId — public booking summary for checkout ──
  app.get<{ Params: { bookingId: string } }>('/checkout/booking/:bookingId', {
    schema: { tags: ['Payments'], summary: 'Public booking summary for checkout page' },
  }, async (req, reply) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.bookingId },
      include: {
        room:   { select: { name: true, type: true } },
        guest:  { select: { firstName: true, lastName: true, email: true } },
        tenant: { select: { name: true, slug: true, country: true, currency: true, paymentConfig: true } },
      },
    });

    if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });

    const nights = Math.ceil(
      (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );

    return reply.send({
      success: true,
      data: {
        id:              booking.id,
        confirmationNo:  booking.confirmationNo,
        status:          booking.status,
        paymentStatus:   booking.paymentStatus,
        checkIn:         booking.checkIn,
        checkOut:        booking.checkOut,
        nights,
        adults:          booking.adults,
        children:        booking.children,
        totalAmount:     Number(booking.totalAmount),
        currency:        getCurrency((booking as any).tenant?.country ?? 'BD'),
        room:            (booking as any).room ? { name: (booking as any).room.name, type: (booking as any).room.type } : null,
        guest:           (booking as any).guest ? {
          name:  `${(booking as any).guest.firstName} ${(booking as any).guest.lastName}`,
          email: (booking as any).guest.email,
        } : null,
        tenant: {
          name: (booking as any).tenant?.name,
          slug: (booking as any).tenant?.slug,
          manualInstructions: (booking as any).tenant?.paymentConfig?.manualInstructions ?? null,
        },
      },
    });
  });

  // ── POST /checkout/init — initiate payment ────────────────────────────────
  app.post('/checkout/init', {
    schema: { tags: ['Payments'], summary: 'Initiate payment for a booking' },
  }, async (req, reply) => {
    const body = z.object({
      bookingId: z.string(),
      gateway:   z.string(),
      returnUrl: z.string().url().optional(),
    }).safeParse(req.body);

    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() });

    const { bookingId, gateway: gatewayId, returnUrl } = body.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tenant: { select: { id: true, slug: true, country: true, paymentConfig: true } },
        guest:  { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });

    if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found' });
    if (booking.paymentStatus === 'PAID') {
      return reply.status(400).send({ success: false, error: 'Booking already paid' });
    }

    const tenant  = booking.tenant;
    const country = tenant.country ?? 'BD';

    // Manual payment — no gateway needed
    if (gatewayId === 'manual') {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED', paymentStatus: 'PENDING', paymentGateway: 'MANUAL' },
      });
      return reply.send({
        success: true,
        data: { type: 'manual', message: tenant.paymentConfig?.manualInstructions ?? 'Pay at resort.' },
      });
    }

    const gw = getGateway(gatewayId as GatewayId);
    if (gw.meta.status !== 'active') {
      return reply.status(400).send({ success: false, error: `Gateway "${gatewayId}" is not available yet` });
    }

    let credentials: Record<string, string>;
    try {
      credentials = await getTenantCredentials(tenant.id, gatewayId as GatewayId);
    } catch (err) {
      return reply.status(400).send({ success: false, error: String(err) });
    }

    // Create Payment record
    const amountInSmallest = toSmallestUnit(Number(booking.totalAmount), country);
    const payment = await prisma.payment.create({
      data: {
        tenantId:   tenant.id,
        bookingId,
        amount:     booking.totalAmount,
        currency:   getCurrency(country).code,
        method:     gatewayId.toUpperCase() as any,
        gateway:    gatewayId,
        status:     'PENDING',
        payerName:  `${booking.guest?.firstName ?? ''} ${booking.guest?.lastName ?? ''}`.trim() || undefined,
        payerEmail: booking.guest?.email  ?? undefined,
        payerPhone: booking.guest?.phone  ?? undefined,
      },
    });

    const callbackUrl = `${API_BASE}/api/payments/webhook/${gatewayId}`;
    const successUrl  = returnUrl ?? `${WEB_BASE}/${tenant.slug}/checkout/verify`;

    const result = await gw.initiate(
      {
        amount:        amountInSmallest,
        currency:      getCurrency(country).code,
        orderId:       payment.id,
        customerName:  payment.payerName  ?? 'Guest',
        customerEmail: payment.payerEmail ?? undefined,
        customerPhone: payment.payerPhone ?? undefined,
        callbackUrl,
        returnUrl:     `${successUrl}?paymentId=${payment.id}`,
        description:   `Booking #${bookingId.slice(-8).toUpperCase()}`,
      },
      credentials,
    );

    if (!result.success) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      return reply.status(500).send({ success: false, error: result.error });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayPaymentId: result.gatewayPaymentId,
        gatewayOrderId:   result.gatewayOrderId,
        gatewaySessionId: result.sessionToken,
        status:           'PROCESSING',
      },
    });

    return reply.send({
      success: true,
      data: {
        paymentId:   payment.id,
        type:        result.redirectUrl ? 'redirect' : 'inline',
        redirectUrl: result.redirectUrl,
        inlineData:  result.inlineData,
        gateway:     gatewayId,
        amount:      formatAmount(Number(booking.totalAmount), country),
      },
    });
  });

  // ── POST /checkout/verify — verify after return redirect ──────────────────
  app.post('/checkout/verify', {
    schema: { tags: ['Payments'], summary: 'Verify payment after redirect' },
  }, async (req, reply) => {
    const body = z.object({
      paymentId:        z.string(),
      gatewayPaymentId: z.string().optional(),
      queryParams:      z.record(z.string()).optional(),
    }).safeParse(req.body);

    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() });

    const { paymentId, queryParams } = body.data;

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return reply.status(404).send({ success: false, error: 'Payment not found' });
    if (payment.status === 'PAID') {
      return reply.send({ success: true, data: { status: 'SUCCESS', alreadyPaid: true } });
    }

    const gw = getGateway(payment.gateway as GatewayId);
    let credentials: Record<string, string>;
    try {
      credentials = await getTenantCredentials(payment.tenantId, payment.gateway as GatewayId);
    } catch (err) {
      return reply.status(400).send({ success: false, error: String(err) });
    }

    const result = await gw.verify(
      {
        gatewayPaymentId: payment.gatewayPaymentId ?? body.data.gatewayPaymentId ?? '',
        gatewayOrderId:   payment.gatewayOrderId   ?? undefined,
        orderId:          payment.id,
        queryParams:      queryParams ?? {},
      },
      credentials,
    );

    const dbStatus = { SUCCESS: 'PAID', FAILED: 'FAILED', PENDING: 'PENDING', CANCELLED: 'CANCELLED' }[result.status];

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status:           dbStatus as any,
        gatewayPaymentId: result.gatewayPaymentId ?? payment.gatewayPaymentId,
        paidAt:           result.status === 'SUCCESS' ? (result.paidAt ?? new Date()) : undefined,
        webhookData:      result.rawData as any ?? undefined,
      },
    });

    if (result.status === 'SUCCESS' && payment.bookingId) {
      await markBookingPaid(
        payment.bookingId,
        payment.gateway ?? 'unknown',
        result.transactionId ?? result.gatewayPaymentId ?? paymentId,
        result.gatewayPaymentId ?? paymentId,
        Number(payment.amount) * 100,
      );
    }

    return reply.send({
      success: result.status === 'SUCCESS',
      data: {
        status:        result.status,
        paymentId,
        bookingId:     payment.bookingId,
        transactionId: result.transactionId,
        error:         result.error,
      },
    });
  });

  // ── POST /webhook/:provider — gateway callbacks ───────────────────────────
  app.post<{ Params: { provider: string } }>('/webhook/:provider', {
    schema: { tags: ['Payments'], summary: 'Gateway webhook callback (called by gateway)' },
  }, async (req, reply) => {
    const provider = req.params.provider as GatewayId;
    const rawBody  = (req as any).rawBody as string ?? JSON.stringify(req.body);
    const headers  = req.headers as Record<string, string>;
    const body     = (req.body ?? {}) as Record<string, string>;
    const query    = (req.query ?? {}) as Record<string, string>;

    try {
      const gw = getGateway(provider);

      // Find orderId in body/query — each gateway sends it differently
      const orderId =
        body.orderId  || body.tran_id || body.merchantInvoiceNumber ||
        query.orderId || query.paymentID || body.paymentID || '';

      if (!orderId) {
        app.log.warn(`[webhook:${provider}] No orderId in payload`);
        return reply.status(200).send({ received: true });
      }

      const payment = await prisma.payment.findFirst({
        where: { OR: [{ id: orderId }, { gatewayPaymentId: orderId }] },
      });

      if (!payment || payment.status === 'PAID' || payment.status === 'FAILED') {
        return reply.status(200).send({ received: true, skipped: !payment });
      }

      // Verify signature if gateway supports it
      if (gw.verifyWebhookSignature) {
        const creds = await getTenantCredentials(payment.tenantId, provider);
        if (!gw.verifyWebhookSignature(rawBody, headers, creds)) {
          app.log.warn(`[webhook:${provider}] Signature invalid`);
          return reply.status(401).send({ error: 'Invalid signature' });
        }
      }

      const credentials = await getTenantCredentials(payment.tenantId, provider);
      const result = await gw.verify(
        {
          gatewayPaymentId: payment.gatewayPaymentId ?? orderId,
          orderId:          payment.id,
          rawBody,
          headers,
          queryParams:      { ...body, ...query },
        },
        credentials,
      );

      app.log.info(`[webhook:${provider}] ${payment.id} → ${result.status}`);

      const dbStatus = { SUCCESS: 'PAID', FAILED: 'FAILED', PENDING: 'PENDING', CANCELLED: 'CANCELLED' }[result.status];
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status:           dbStatus as any,
          gatewayPaymentId: result.gatewayPaymentId ?? payment.gatewayPaymentId,
          paidAt:           result.status === 'SUCCESS' ? new Date() : undefined,
          webhookData:      { ...(result.rawData ?? {}), provider } as any,
        },
      });

      if (result.status === 'SUCCESS' && payment.bookingId) {
        await markBookingPaid(
          payment.bookingId, provider,
          result.transactionId ?? result.gatewayPaymentId ?? orderId,
          result.gatewayPaymentId ?? orderId,
          Number(payment.amount) * 100,
        );
      }

      return reply.status(200).send({ received: true });
    } catch (err) {
      app.log.error(`[webhook:${provider}] ${err}`);
      return reply.status(200).send({ received: true }); // always 200 to gateway
    }
  });

  // ── GET /config ───────────────────────────────────────────────────────────
  app.get('/config', {
    preHandler: [requireAuth],
    schema: { tags: ['Payments'], summary: 'Get tenant payment config' },
  }, async (req, reply) => {
    const { db } = req;
    const { tenantId } = req.user as JwtPayload;

    const [config, tenant] = await Promise.all([
      db.tenantPaymentConfig.findUnique({ where: { tenantId } }),
      db.tenant.findUnique({ where: { id: tenantId }, select: { country: true } }),
    ]);

    const country  = tenant?.country ?? 'BD';
    const gateways = getGatewaysForCountry(country);

    // Mask secret credential values for display
    const safeCredentials: Record<string, Record<string, string>> = {};
    if (config?.credentials) {
      const raw = config.credentials as Record<string, Record<string, string>>;
      for (const [gwId, gwCreds] of Object.entries(raw)) {
        safeCredentials[gwId] = {};
        for (const [key, value] of Object.entries(gwCreds)) {
          const isSecret = /secret|password|key/i.test(key);
          safeCredentials[gwId][key] = isSecret && value
            ? '••••••••' + String(value).slice(-4)
            : value;
        }
      }
    }

    return reply.send({
      success: true,
      data: {
        activeGateway:      config?.activeGateway  ?? 'manual',
        enabledMethods:     config?.enabledMethods ?? ['manual'],
        manualInstructions: config?.manualInstructions ?? '',
        testMode:           config?.testMode ?? true,
        credentials:        safeCredentials,
        country,
        currency:           getCurrency(country),
        availableGateways:  gateways.map(gw => ({
          id:               gw.meta.id,
          name:             gw.meta.name,
          logo:             gw.meta.logo,
          methods:          gw.meta.methods,
          status:           gw.meta.status,
          credentialFields: gw.meta.credentialFields,
        })),
      },
    });
  });

  // ── PUT /config ───────────────────────────────────────────────────────────
  app.put('/config', {
    preHandler: [requireAuth],
    schema: { tags: ['Payments'], summary: 'Save payment gateway config (OWNER only)' },
  }, async (req, reply) => {
    const { db } = req;
    const { tenantId, role } = req.user as JwtPayload;
    if (role !== 'OWNER') return reply.status(403).send({ success: false, error: 'Owner only' });

    const body = z.object({
      activeGateway:      z.string(),
      enabledMethods:     z.array(z.string()).optional(),
      manualInstructions: z.string().optional(),
      testMode:           z.boolean().optional(),
      credentials:        z.record(z.record(z.string())).optional(),
    }).safeParse(req.body);

    if (!body.success) return reply.status(400).send({ success: false, error: body.error.flatten() });

    const { activeGateway, enabledMethods, manualInstructions, testMode, credentials } = body.data;

    // Merge credentials — don't overwrite masked values
    const existing = await db.tenantPaymentConfig.findUnique({
      where: { tenantId }, select: { credentials: true },
    });
    const merged = (existing?.credentials ?? {}) as Record<string, Record<string, string>>;

    if (credentials) {
      for (const [gwId, gwCreds] of Object.entries(credentials)) {
        if (!merged[gwId]) merged[gwId] = {};
        for (const [key, value] of Object.entries(gwCreds)) {
          if (value.startsWith('••••••••')) continue; // masked — keep existing
          merged[gwId][key] = value;
        }
      }
    }

    const config = await db.tenantPaymentConfig.upsert({
      where:  { tenantId },
      create: {
        tenantId, activeGateway,
        enabledMethods: enabledMethods ?? ['manual'],
        manualInstructions,
        testMode: testMode ?? true,
        credentials: merged,
      },
      update: {
        activeGateway,
        ...(enabledMethods              ? { enabledMethods }     : {}),
        ...(manualInstructions !== undefined ? { manualInstructions } : {}),
        ...(testMode           !== undefined ? { testMode }       : {}),
        credentials: merged,
      },
    });

    return reply.send({ success: true, data: { id: config.id, activeGateway: config.activeGateway } });
  });

  // ── GET /history ──────────────────────────────────────────────────────────
  app.get('/history', {
    preHandler: [requireAuth],
    schema: { tags: ['Payments'], summary: 'Payment transaction history' },
  }, async (req, reply) => {
    const { db } = req;
    const q     = req.query as { page?: string; limit?: string; gateway?: string; status?: string };
    const page  = Math.max(1, parseInt(q.page ?? '1'));
    const limit = Math.min(50, parseInt(q.limit ?? '20'));

    const where = {
      ...(q.gateway ? { gateway: q.gateway }       : {}),
      ...(q.status  ? { status: q.status as any } : {}),
    };

    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { booking: { select: { id: true, checkIn: true, checkOut: true } } },
      }),
      db.payment.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: { payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  });

  // ── GET /history/:id ──────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/history/:id', {
    preHandler: [requireAuth],
    schema: { tags: ['Payments'], summary: 'Single payment record' },
  }, async (req, reply) => {
    const { db } = req;
    const payment = await db.payment.findFirst({
      where: { id: req.params.id },
      include: { booking: { select: { id: true, checkIn: true, checkOut: true, totalAmount: true } } },
    });
    if (!payment) return reply.status(404).send({ success: false, error: 'Payment not found' });
    return reply.send({ success: true, data: payment });
  });
}
