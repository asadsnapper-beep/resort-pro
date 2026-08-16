import type { FastifyInstance } from 'fastify';
import { prisma } from '@resort-pro/database';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';
import { createAdminNotification } from '../utils/notifications';
import { bkashGrantToken, bkashCreatePayment, bkashExecutePayment } from '../services/bkash';
import { getPlatformBkash } from './billing';
import { effectiveThemePrice } from '../utils/theme-access';

/**
 * Buying a theme.
 *
 * Themes are sold once and kept forever (see
 * plan/theme-studio-and-design-service.md, 2026-08-13), so a completed purchase
 * writes a single ThemePurchase row and nothing here ever expires it.
 *
 * The bKash flow mirrors the subscription one in billing.ts deliberately —
 * create a payment with the details carried on the callback URL, then on the
 * way back execute it and re-check the amount before believing anything the
 * callback claims.
 */

const THEME_PRICING_SELECT = {
  key: true, name: true, isActive: true, exclusiveToTenantId: true,
  priceUsd: true, priceBdt: true,
  offerPriceUsd: true, offerPriceBdt: true, offerEndsAt: true,
} as const;

export async function themePurchaseRoutes(app: FastifyInstance) {
  // ── GET /api/theme-purchases — what this resort already owns ──────────────
  app.get('/', { preHandler: requireRole('OWNER', 'MANAGER') }, async (request, reply) => {
    const { tenantId } = request.user as JwtPayload;
    const purchases = await prisma.themePurchase.findMany({
      where: { tenantId },
      orderBy: { purchasedAt: 'desc' },
      select: {
        themeKey: true, amountPaid: true, currency: true,
        paymentMethod: true, purchasedAt: true,
        theme: { select: { name: true, previewImage: true } },
      },
    });
    return reply.send(ok(purchases));
  });

  // ── POST /api/theme-purchases/checkout/bkash ──────────────────────────────
  // Only the owner buys — a manager can run the resort without being able to
  // spend its money.
  app.post<{ Body: { themeKey?: string } }>(
    '/checkout/bkash',
    { preHandler: requireRole('OWNER') },
    async (request, reply) => {
      const { tenantId } = request.user as JwtPayload;
      const themeKey = request.body?.themeKey;
      if (!themeKey) return reply.status(400).send({ success: false, error: 'themeKey required' });

      const theme = await prisma.theme.findUnique({ where: { key: themeKey }, select: THEME_PRICING_SELECT });
      if (!theme || !theme.isActive) return reply.status(404).send({ success: false, error: 'Theme not found' });

      // Refuse to take money for something they would get anyway, or cannot
      // have at all — both would end in a refund conversation.
      if (theme.exclusiveToTenantId && theme.exclusiveToTenantId !== tenantId) {
        return reply.status(403).send({ success: false, error: 'That theme is not available for your resort.' });
      }
      const price = effectiveThemePrice(theme);
      if (price.isFree) {
        return reply.status(400).send({ success: false, error: 'This theme is free — no purchase needed.' });
      }
      const already = await prisma.themePurchase.findUnique({
        where: { tenantId_themeKey: { tenantId, themeKey } },
        select: { id: true },
      });
      if (already) {
        return reply.status(409).send({ success: false, error: 'You already own this theme.', code: 'ALREADY_OWNED' });
      }

      const cfg = getPlatformBkash();
      if (!cfg) {
        return reply.status(503).send({ success: false, error: 'bKash payments are not available yet. Please contact support.' });
      }

      // Same reasoning as billing.ts: APP_URL/API_BASE_URL are easy to leave
      // unset in production, which would hand bKash a localhost callback.
      const apiUrl = process.env.API_BASE_URL || process.env.APP_URL || process.env.API_URL
        || `${request.protocol}://${request.hostname}`;
      const invoice = `THM${Date.now().toString(36).toUpperCase()}`;
      const callbackURL =
        `${apiUrl}/api/theme-purchases/bkash/callback` +
        `?tenantId=${encodeURIComponent(tenantId)}&themeKey=${encodeURIComponent(themeKey)}&amt=${price.bdt}`;

      try {
        const idToken = await bkashGrantToken(cfg);
        const created = await bkashCreatePayment(cfg, idToken, {
          amount: price.bdt.toFixed(2),
          currency: 'BDT',
          merchantInvoiceNumber: invoice,
          callbackURL,
        });
        return reply.send(ok({ url: created.bkashURL, paymentID: created.paymentID, amountBdt: price.bdt }));
      } catch (err) {
        request.log.error({ err }, 'bKash theme purchase create failed');
        return reply.status(502).send({ success: false, error: 'Could not start bKash payment. Please try again.' });
      }
    },
  );

  // ── GET /api/theme-purchases/bkash/callback ───────────────────────────────
  // bKash redirects the buyer's browser here, so there is no auth and every
  // query parameter is attacker-controlled. Nothing is trusted: the payment is
  // executed against bKash, and the amount it reports back is compared with
  // what the theme actually costs before ownership is granted.
  app.get<{ Querystring: { paymentID?: string; status?: string; tenantId?: string; themeKey?: string; amt?: string } }>(
    '/bkash/callback',
    async (request, reply) => {
      const appUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const { paymentID, status, tenantId, themeKey } = request.query;
      const back = (query: string) => reply.redirect(`${appUrl}/dashboard/website?tab=template&${query}`);
      const fail = (reason: string) => back(`themePurchase=failed&reason=${encodeURIComponent(reason)}`);

      if (!paymentID || status !== 'success' || !tenantId || !themeKey) return fail('cancelled');

      const cfg = getPlatformBkash();
      if (!cfg) return fail('not_configured');

      try {
        const theme = await prisma.theme.findUnique({ where: { key: themeKey }, select: THEME_PRICING_SELECT });
        if (!theme) return fail('theme_not_found');

        const idToken = await bkashGrantToken(cfg);
        const exec = await bkashExecutePayment(cfg, idToken, paymentID);
        if (exec.transactionStatus !== 'Completed') return fail('payment_incomplete');

        // The price is read from the database, never from the callback URL —
        // otherwise `&amt=1` would buy a $30 theme for one taka.
        const expected = effectiveThemePrice(theme).bdt;
        if (Math.abs(Number(exec.amount) - expected) > 0.5) return fail('amount_mismatch');

        // A buyer who reloads the callback, or a bKash retry, must not create a
        // second purchase — the unique (tenantId, themeKey) index makes that
        // impossible, and upsert turns the collision into a no-op.
        await prisma.themePurchase.upsert({
          where: { tenantId_themeKey: { tenantId, themeKey } },
          update: {},
          create: {
            tenantId, themeKey,
            amountPaid: expected, currency: 'BDT',
            paymentMethod: 'bkash', paymentRef: exec.trxID,
          },
        });

        const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
        await createAdminNotification({
          type: 'theme_purchased',
          title: 'Theme purchased (bKash)',
          message: `${t?.name ?? tenantId} bought "${theme.name}" for ৳${exec.amount} via bKash. trxID ${exec.trxID}.`,
          metadata: { tenantId, themeKey, amount: exec.amount, trxID: exec.trxID, method: 'bkash' },
          linkPath: '/admin/themes',
        });

        return back(`themePurchase=success&theme=${encodeURIComponent(themeKey)}`);
      } catch (err) {
        request.log.error({ err }, 'bKash theme purchase callback failed');
        return fail('execute_failed');
      }
    },
  );
}

