import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@resort-pro/database';
import { requireAuth } from '../middleware/auth';
import { ok } from '../utils/response';
import type { JwtPayload } from '@resort-pro/types';

const registerSchema = z.object({
  resortName: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).regex(/(?=.*[A-Z])(?=.*[0-9])/, 'Must contain uppercase and number'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  slug: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register a new resort (tenant)',
      body: {
        type: 'object',
        required: ['resortName', 'slug', 'firstName', 'lastName', 'email', 'password'],
        properties: {
          resortName: { type: 'string' },
          slug: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = registerSchema.parse(request.body);

      const existingTenant = await prisma.tenant.findUnique({ where: { slug: body.slug } });
      if (existingTenant) {
        return reply.status(409).send({ success: false, error: 'Resort slug already taken' });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      const tenant = await prisma.tenant.create({
        data: {
          name: body.resortName,
          slug: body.slug,
          plan: 'FREE',
          users: {
            create: {
              email: body.email,
              passwordHash,
              firstName: body.firstName,
              lastName: body.lastName,
              role: 'OWNER',
            },
          },
          websiteContent: {
            create: {
              heroTitle: `Welcome to ${body.resortName}`,
              heroSubtitle: 'Experience luxury and comfort',
            },
          },
        },
        include: { users: true },
      });

      const user = tenant.users[0];
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: 'OWNER',
        tenantId: tenant.id,
      };

      const token = app.jwt.sign(payload);
      const refreshToken = app.jwt.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d' },
      );

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return reply.status(201).send(ok({
        token,
        refreshToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
      }, 'Resort registered successfully'));
    },
  });

  // POST /api/auth/login
  app.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'Login to the dashboard',
      body: {
        type: 'object',
        required: ['email', 'password', 'slug'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          slug: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = loginSchema.parse(request.body);

      const tenant = await prisma.tenant.findUnique({ where: { slug: body.slug } });
      if (!tenant || !tenant.isActive) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email: body.email } },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Invalid credentials' });
      }

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role as JwtPayload['role'],
        tenantId: tenant.id,
      };

      const token = app.jwt.sign(payload);
      const refreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return ok({
        token,
        refreshToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan },
      });
    },
  });

  // POST /api/auth/refresh
  app.post('/refresh', {
    schema: { tags: ['auth'], summary: 'Refresh access token' },
    handler: async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken: string };
      if (!refreshToken) {
        return reply.status(400).send({ success: false, error: 'Refresh token required' });
      }

      const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } });
      if (!stored || stored.expiresAt < new Date()) {
        return reply.status(401).send({ success: false, error: 'Invalid or expired refresh token' });
      }

      await prisma.refreshToken.delete({ where: { id: stored.id } });

      const user = stored.user;
      const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
      if (!tenant) return reply.status(401).send({ success: false, error: 'Tenant not found' });

      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role as JwtPayload['role'],
        tenantId: user.tenantId,
      };

      const newToken = app.jwt.sign(payload);
      const newRefreshToken = app.jwt.sign({ sub: user.id, type: 'refresh' }, { expiresIn: '7d' });

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return ok({ token: newToken, refreshToken: newRefreshToken });
    },
  });

  // GET /api/auth/me
  app.get('/me', {
    schema: { tags: ['auth'], summary: 'Get current user', security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const payload = request.user as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, avatarUrl: true, tenantId: true },
      });
      return ok(user);
    },
  });

  // POST /api/auth/logout
  app.post('/logout', {
    schema: { tags: ['auth'], summary: 'Logout (invalidate refresh token)' },
    handler: async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken?: string };
      if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      }
      return reply.send(ok(null, 'Logged out'));
    },
  });
}
