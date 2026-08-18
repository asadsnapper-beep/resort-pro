import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';
import { join } from 'path';
import { mkdirSync } from 'fs';

import { authRoutes } from './routes/auth';
import { tenantRoutes } from './routes/tenants';
import { roomRoutes } from './routes/rooms';
import { propertyRoutes } from './routes/properties';
import { bookingRoutes } from './routes/bookings';
import { guestRoutes } from './routes/guests';
import { staffRoutes } from './routes/staff';
import { shareholderRoutes } from './routes/shareholders';
import { venueRoutes } from './routes/venues';
import { corporateAccountRoutes } from './routes/corporateAccounts';
import { designRequestRoutes } from './routes/designRequests';
import { housekeepingRoutes } from './routes/housekeeping';
import { menuRoutes } from './routes/menu';
import { foodOrderRoutes } from './routes/foodOrders';
import { inventoryRoutes } from './routes/inventory';
import { vendorRoutes } from './routes/vendors';
import { purchaseOrderRoutes } from './routes/purchaseOrders';
import { assetRoutes } from './routes/assets';
import { lostFoundRoutes } from './routes/lostFound';
import { minibarRoutes } from './routes/minibar';
import { laundryRoutes } from './routes/laundry';
import { attendanceRoutes } from './routes/attendance';
import { salaryRoutes } from './routes/salary';
import { trainingRoutes } from './routes/training';
import { vehicleRoutes } from './routes/vehicles';
import { ticketRoutes } from './routes/tickets';
import { ticketWebhookRoutes } from './routes/ticketWebhooks';
import { websiteRoutes, publicWebsiteRoutes } from './routes/website';
import { dashboardRoutes } from './routes/dashboard';
import { notificationRoutes } from './routes/notifications';
import { chatRoutes } from './routes/chat';
import { crmRoutes, crmPublicRoutes } from './routes/crm';
import { billingRoutes, stripeWebhookRoute } from './routes/billing';
import { themePurchaseRoutes } from './routes/themePurchases';
import { startDemoRefreshCron } from './jobs/refresh-demo';
import { adminRoutes } from './routes/admin';
import { frontDeskRoutes } from './routes/frontDesk';
import { ratePlanRoutes } from './routes/ratePlans';
import { maintenanceRoutes } from './routes/maintenance';
import { reportRoutes } from './routes/reports';
import { packageRoutes } from './routes/packages';
import { groupBookingRoutes } from './routes/groupBookings';
import { loyaltyRoutes } from './routes/loyalty';
import { externalCalendarRoutes } from './routes/externalCalendars'
import { marketingRoutes } from './routes/marketing';
import { paymentRoutes } from './routes/payments'
import { expenseRoutes } from './routes/expenses';
import { invoicesRoutes } from './routes/invoices';
import { embedRoutes } from './routes/embed';
import { uploadRoutes } from './routes/upload';
import { offersRoutes, publicOffersRoutes } from './routes/offers';
import { discoveryRoutes } from './routes/discovery';
import { syncRoutes } from './routes/sync';
import { guestDocumentRoutes } from './routes/guestDocuments';
import { idScanRoutes }         from './routes/idScan';
import { restaurantTableRoutes } from './routes/restaurantTables';
import { publicTableRoutes } from './routes/publicTable';
import { aiRoutes } from './routes/ai';
import { requireFlag } from './middleware/auth';
import { metrics, normalizePath } from './utils/metrics';

export async function buildApp() {
  // ── Fail-fast: JWT_SECRET must be set in production ───────────────────────
  // Never fall back to a hardcoded default secret in production — a missing
  // JWT_SECRET would otherwise let the app boot on a publicly-known value,
  // allowing anyone to forge tokens (including SUPER_ADMIN). Crash instead.
  // This also covers the cookie secret, which falls back to JWT_SECRET below.
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error(
      'FATAL: JWT_SECRET is not set in production. ' +
      'Refusing to start with an insecure default secret.',
    );
  }

  const app = Fastify({
    // Behind Coolify/Traefik: without this, request.protocol/hostname reflect
    // the internal http connection instead of the real public https domain —
    // this silently broke every upload URL (defaulted to http://localhost:4000).
    trustProxy: true,
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ── Error Handler ──────────────────────────────────────────────────────────
  // Registered immediately after the Fastify instance is created, BEFORE any
  // plugin/route registration. Fastify resolves which error handler applies
  // to a route based on the encapsulation context in effect when that route
  // was registered — a setErrorHandler call made *after* routes exist does
  // not retroactively apply to them. This used to be the very last statement
  // in this function (after ~100 routes were already registered), which
  // meant literally no route in the API ever used this handler: every
  // validation failure fell back to Fastify's raw default error format
  // (500 Internal Server Error, no `success`/`details` shape) instead of the
  // intended 400 with field-level messages.
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    if (error.statusCode === 429) {
      return reply.status(429).send({ success: false, error: error.message });
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: error.validation,
      });
    }

    return reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal server error',
    });
  });

  // ── Plugins ──────────────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false,
    // API and web app live on different origins in every environment
    // (api.resortpro.site vs resortpro.site/app.resortpro.site, tenant custom
    // domains, local :3000 vs :4000) — helmet's default same-origin CORP
    // silently blocks the browser from rendering /uploads/* images (and any
    // other response) fetched cross-origin. This was blocking every uploaded
    // image even after its URL was fixed to point at the right domain.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(cookie, { secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'cookie-secret' });

  // CORS: always allow resortpro.site + all subdomains (apex landing hosts /try,
  // tenant sites live on <slug>.resortpro.site) plus anything in CORS_ORIGIN.
  const envOrigins = (process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'])
    .map((s) => s.trim())
    .filter(Boolean);
  const RESORTPRO_ORIGIN = /^https?:\/\/([a-z0-9-]+\.)*resortpro\.site$/i;
  await app.register(cors, {
    origin: (origin, cb) => {
      // No Origin header = same-origin / server-to-server (curl, health checks)
      if (!origin) return cb(null, true);
      if (RESORTPRO_ORIGIN.test(origin) || envOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    // A single dashboard page load fires several parallel requests (summary,
    // notifications, invoices, billing status, etc.), and staff on the same
    // office network share one IP — 100/min was tripping during ordinary
    // multi-page browsing, not just abuse. Sensitive routes (login, admin,
    // design-requests) already have their own tighter per-route overrides
    // above this global default.
    max: 300,
    timeWindow: '1 minute',
    // statusCode must be included here — without it the throttled response is
    // sent with a 500 instead of the correct 429 (the returned object is used
    // verbatim as the response). Applies to per-route overrides too.
    errorResponseBuilder: () => ({
      statusCode: 429,
      success: false,
      error: 'Too many requests. Please slow down.',
    }),
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    sign: { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    // Without this the verifier accepts whichever HS* algorithm the token's own
    // header names, i.e. the caller picks. Not a bypass today — every HS
    // variant still needs this same secret, and `alg: none` is already
    // rejected — but "the attacker chooses" is not a property worth keeping,
    // and it stops being harmless the moment `secret` becomes a keypair, where
    // it turns into the classic public-key-as-HMAC-secret forgery.
    verify: { algorithms: ['HS256'] },
  });

  await app.register(websocket);

  // ── Multipart (file uploads — 5 MB limit) ────────────────────────────────
  await app.register(import('@fastify/multipart'), {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  // ── Static files — local upload storage ──────────────────────────────────
  const uploadsDir = process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });
  await app.register(staticPlugin, {
    root:       uploadsDir,
    prefix:     '/uploads/',
    decorateReply: false,
  });

  // ── Swagger / OpenAPI ─────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'ResortPro API',
        description: 'All-in-one SaaS API for resort management',
        version: '1.0.0',
        contact: { name: 'ResortPro Support', email: 'support@resortpro.site' },
      },
      servers: [{ url: process.env.APP_URL || 'http://localhost:4000', description: 'API Server' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'dashboard', description: 'Dashboard & analytics' },
        { name: 'rooms', description: 'Room management' },
        { name: 'bookings', description: 'Booking management' },
        { name: 'guests', description: 'Guest management' },
        { name: 'staff', description: 'Staff management' },
        { name: 'housekeeping', description: 'Housekeeping tasks' },
        { name: 'menu', description: 'Restaurant menu' },
        { name: 'food-orders', description: 'Food & beverage orders' },
        { name: 'inventory', description: 'Inventory management' },
        { name: 'tickets', description: 'Support tickets' },
        { name: 'chat', description: 'Live chat' },
        { name: 'website', description: 'Public website content' },
        { name: 'notifications', description: 'Notifications' },
      ],
    },
  });

  // Only expose the interactive /docs UI (and its /docs/json spec) outside
  // production — in prod it would hand an attacker the full 459-endpoint API
  // surface, parameter names, and schemas. The spec plugin above stays
  // registered so app.swagger() still works for any internal use.
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: false },
      staticCSP: false,
    });
  }

  // ── Request metrics hook ─────────────────────────────────────────────────
  app.addHook('onResponse', (request, reply, done) => {
    // Skip health check, static, and swagger to keep metrics clean
    const url = request.url ?? '';
    if (!url.startsWith('/api/') && !url.startsWith('/site/') && !url.startsWith('/embed/') && !url.startsWith('/table/')) { done(); return; }
    metrics.record({
      method: request.method,
      path: normalizePath(url),
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
    done();
  });

  // ── Health Check ──────────────────────────────────────────────────────────
  app.get('/health', { schema: { hide: true } }, async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // Feature modules are registered inside an encapsulated Fastify scope. That
  // gives every endpoint in the module the same server-side entitlement gate,
  // so a hidden dashboard item can never be bypassed with a direct API call.
  const registerFeatureRoutes = async (
    prefix: string,
    flag: string,
    routes: (instance: FastifyInstance) => Promise<void>,
  ) => app.register(async (featureApp) => {
    featureApp.addHook('preHandler', requireFlag(flag));
    await routes(featureApp);
  }, { prefix });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(tenantRoutes, { prefix: '/api/tenant' });
  await app.register(roomRoutes, { prefix: '/api/rooms' });
  await app.register(propertyRoutes, { prefix: '/api/properties' });
  await app.register(bookingRoutes, { prefix: '/api/bookings' });
  await app.register(guestRoutes,         { prefix: '/api/guests' });
  await app.register(guestDocumentRoutes, { prefix: '/api/guests' });
  await app.register(idScanRoutes,         { prefix: '/api/guests' });
  await app.register(staffRoutes, { prefix: '/api/staff' });
  await app.register(shareholderRoutes, { prefix: '/api/shareholders' });
  await registerFeatureRoutes('/api/venues', 'venues_module', venueRoutes);
  await registerFeatureRoutes('/api/corporate-accounts', 'corporate_accounts_module', corporateAccountRoutes);
  await app.register(designRequestRoutes, { prefix: '/api/design-requests' });
  await registerFeatureRoutes('/api/housekeeping', 'housekeeping_module', housekeepingRoutes);
  await registerFeatureRoutes('/api/menu', 'restaurant_module', menuRoutes);
  await registerFeatureRoutes('/api/food-orders', 'restaurant_module', foodOrderRoutes);
  await registerFeatureRoutes('/api/inventory', 'inventory_module', inventoryRoutes);
  await registerFeatureRoutes('/api/vendors', 'inventory_module', vendorRoutes);
  await registerFeatureRoutes('/api/purchase-orders', 'inventory_module', purchaseOrderRoutes);
  await app.register(assetRoutes, { prefix: '/api/assets' });
  await app.register(lostFoundRoutes, { prefix: '/api/lost-found' });
  await app.register(minibarRoutes, { prefix: '/api/minibar' });
  await app.register(laundryRoutes, { prefix: '/api/laundry' });
  await app.register(attendanceRoutes, { prefix: '/api/attendance' });
  await app.register(salaryRoutes, { prefix: '/api/salary' });
  await app.register(trainingRoutes, { prefix: '/api/training' });
  await registerFeatureRoutes('/api/vehicles', 'vehicles_module', vehicleRoutes);
  await app.register(ticketRoutes, { prefix: '/api/tickets' });
  await app.register(ticketWebhookRoutes, { prefix: '/api/ticket-webhooks' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(websiteRoutes, { prefix: '/api/website' });
  await app.register(publicWebsiteRoutes, { prefix: '/site' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await registerFeatureRoutes('/api/crm', 'crm_v2', crmRoutes);
  await app.register(crmPublicRoutes, { prefix: '/crm' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(themePurchaseRoutes, { prefix: '/api/theme-purchases' });
  await app.register(stripeWebhookRoute, { prefix: '/api/stripe' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(frontDeskRoutes, { prefix: '/api/front-desk' });
  await registerFeatureRoutes('/api/rate-plans', 'rate_plans_module', ratePlanRoutes);
  await registerFeatureRoutes('/api/maintenance', 'maintenance_module', maintenanceRoutes);
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await registerFeatureRoutes('/api/packages', 'offers_module', packageRoutes);
  await registerFeatureRoutes('/api/group-bookings', 'group_bookings_module', groupBookingRoutes);
  await registerFeatureRoutes('/api/loyalty', 'loyalty_module', loyaltyRoutes);
  await registerFeatureRoutes('/api/external-calendars', 'channel_sync', externalCalendarRoutes);
  await registerFeatureRoutes('/api/marketing', 'marketing_module', marketingRoutes);
  await app.register(paymentRoutes, { prefix: '/api/payments' });
  await app.register(expenseRoutes,   { prefix: '/api/expenses' });
  await app.register(invoicesRoutes,  { prefix: '/api/invoices' });
  await app.register(embedRoutes,   { prefix: '/embed' });
  await app.register(uploadRoutes,  { prefix: '/api/upload' });
  await registerFeatureRoutes('/api/offers', 'offers_module', offersRoutes);
  await app.register(publicOffersRoutes,  { prefix: '/site' });
  await app.register(discoveryRoutes,     { prefix: '/api' });
  await app.register(syncRoutes,          { prefix: '/api/sync' });
  await registerFeatureRoutes('/api/restaurant/tables', 'restaurant_module', restaurantTableRoutes);
  await app.register(publicTableRoutes,     { prefix: '/table' });
  await app.register(aiRoutes,              { prefix: '/api/ai' });

  // No-op unless SEED_DEMO_REFRESH=1 — staging only, never production.
  startDemoRefreshCron();

  return app;
}
