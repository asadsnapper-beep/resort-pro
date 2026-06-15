import Fastify from 'fastify';
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
import { bookingRoutes } from './routes/bookings';
import { guestRoutes } from './routes/guests';
import { staffRoutes } from './routes/staff';
import { housekeepingRoutes } from './routes/housekeeping';
import { menuRoutes } from './routes/menu';
import { foodOrderRoutes } from './routes/foodOrders';
import { inventoryRoutes } from './routes/inventory';
import { ticketRoutes } from './routes/tickets';
import { ticketWebhookRoutes } from './routes/ticketWebhooks';
import { websiteRoutes, publicWebsiteRoutes } from './routes/website';
import { dashboardRoutes } from './routes/dashboard';
import { notificationRoutes } from './routes/notifications';
import { chatRoutes } from './routes/chat';
import { crmRoutes, crmPublicRoutes } from './routes/crm';
import { billingRoutes, stripeWebhookRoute } from './routes/billing';
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
import { metrics, normalizePath } from './utils/metrics';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ── Plugins ──────────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cookie, { secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'cookie-secret' });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error: 'Too many requests. Please slow down.',
    }),
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
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
        contact: { name: 'ResortPro Support', email: 'support@resortpro.com' },
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

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
    staticCSP: false,
  });

  // ── Request metrics hook ─────────────────────────────────────────────────
  app.addHook('onResponse', (request, reply, done) => {
    // Skip health check, static, and swagger to keep metrics clean
    const url = request.url ?? '';
    if (!url.startsWith('/api/') && !url.startsWith('/site/') && !url.startsWith('/embed/')) { done(); return; }
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

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(tenantRoutes, { prefix: '/api/tenant' });
  await app.register(roomRoutes, { prefix: '/api/rooms' });
  await app.register(bookingRoutes, { prefix: '/api/bookings' });
  await app.register(guestRoutes,         { prefix: '/api/guests' });
  await app.register(guestDocumentRoutes, { prefix: '/api/guests' });
  await app.register(staffRoutes, { prefix: '/api/staff' });
  await app.register(housekeepingRoutes, { prefix: '/api/housekeeping' });
  await app.register(menuRoutes, { prefix: '/api/menu' });
  await app.register(foodOrderRoutes, { prefix: '/api/food-orders' });
  await app.register(inventoryRoutes, { prefix: '/api/inventory' });
  await app.register(ticketRoutes, { prefix: '/api/tickets' });
  await app.register(ticketWebhookRoutes, { prefix: '/api/ticket-webhooks' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(websiteRoutes, { prefix: '/api/website' });
  await app.register(publicWebsiteRoutes, { prefix: '/site' });
  await app.register(notificationRoutes, { prefix: '/api/notifications' });
  await app.register(crmRoutes, { prefix: '/api/crm' });
  await app.register(crmPublicRoutes, { prefix: '/crm' });
  await app.register(billingRoutes, { prefix: '/api/billing' });
  await app.register(stripeWebhookRoute, { prefix: '/api/stripe' });
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(frontDeskRoutes, { prefix: '/api/front-desk' });
  await app.register(ratePlanRoutes, { prefix: '/api/rate-plans' });
  await app.register(maintenanceRoutes, { prefix: '/api/maintenance' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(packageRoutes, { prefix: '/api/packages' });
  await app.register(groupBookingRoutes, { prefix: '/api/group-bookings' });
  await app.register(loyaltyRoutes, { prefix: '/api/loyalty' });
  await app.register(externalCalendarRoutes, { prefix: '/api/external-calendars' });
  await app.register(marketingRoutes, { prefix: '/api/marketing' });
  await app.register(paymentRoutes, { prefix: '/api/payments' });
  await app.register(expenseRoutes,   { prefix: '/api/expenses' });
  await app.register(invoicesRoutes,  { prefix: '/api/invoices' });
  await app.register(embedRoutes,   { prefix: '/embed' });
  await app.register(uploadRoutes,  { prefix: '/api/upload' });
  await app.register(offersRoutes,        { prefix: '/api/offers' });
  await app.register(publicOffersRoutes,  { prefix: '/site' });
  await app.register(discoveryRoutes,     { prefix: '/api' });
  await app.register(syncRoutes,          { prefix: '/api/sync' });

  // ── Error Handler ─────────────────────────────────────────────────────────
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

  return app;
}
