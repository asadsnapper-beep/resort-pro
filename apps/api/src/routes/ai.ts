import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { aiStatusForTenant, requireAiFeature } from '../utils/ai-guard';
import { generateContent, AiNotConfiguredError } from '../services/ai/contentGenerator';
import { prisma } from '@resort-pro/database';
import type { JwtPayload } from '@resort-pro/types';

const contentSchema = z.object({
  contentType: z.enum(['room_desc', 'promo_email', 'social_post', 'offer_copy', 'review_response']),
  details: z.string().min(3).max(2000),
  tone: z.string().max(40).optional(),
  language: z.string().max(10).optional(),
});

/** YYYY-MM key for usage tracking */
function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * AI routes — all ship dark behind the master switch + per-tenant flags.
 * Feature endpoints (content/chatbot/insights) get added here as they're built,
 * each gated by requireAiFeature(...). See plan/ai/ROLLOUT-STRATEGY.md
 */
export async function aiRoutes(app: FastifyInstance) {
  // GET /api/ai/status — which AI features are live for this tenant (no AI call)
  app.get('/status', {
    schema: { tags: ['ai'], summary: 'AI feature availability for current tenant', security: [{ bearerAuth: [] }] },
    preHandler: requireRole('OWNER', 'MANAGER', 'RECEPTIONIST', 'MARKETER', 'CHEF', 'STAFF'),
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload;
      const status = await aiStatusForTenant(tenantId);
      return ok(status);
    },
  });

  // POST /api/ai/content/generate — calls Claude, saves a DRAFT (never auto-published).
  // Gated by ai_content flag; only runs when master switch + flag are ON and a key is set.
  app.post('/content/generate', {
    schema: { tags: ['ai'], summary: 'Generate content draft (AI)', security: [{ bearerAuth: [] }] },
    preHandler: [requireRole('OWNER', 'MANAGER'), requireAiFeature('ai_content')],
    handler: async (request, reply) => {
      const { tenantId, sub } = request.user as JwtPayload;
      const body = contentSchema.parse(request.body);

      let result;
      try {
        result = await generateContent(tenantId, body);
      } catch (e) {
        if (e instanceof AiNotConfiguredError) {
          return reply.status(503).send({ success: false, error: e.message, code: 'AI_NOT_CONFIGURED' });
        }
        request.log.error(e);
        return reply.status(502).send({ success: false, error: 'AI provider error', code: 'AI_PROVIDER_ERROR' });
      }

      // Save as draft — owner reviews & applies later, nothing auto-publishes.
      const draft = await prisma.generatedContent.create({
        data: {
          tenantId,
          contentType: body.contentType,
          prompt: body.details,
          content: result.content,
          language: body.language ?? 'en',
          status: 'draft',
          tokensUsed: result.tokensUsed,
          createdById: sub,
        },
      });

      // Track usage (token cost visibility / cap).
      await prisma.aiUsage.upsert({
        where: { tenantId_month: { tenantId, month: monthKey() } },
        update: { queryCount: { increment: 1 }, tokenCount: { increment: result.tokensUsed } },
        create: { tenantId, month: monthKey(), queryCount: 1, tokenCount: result.tokensUsed },
      });

      return reply.status(201).send(ok(draft, 'Draft generated'));
    },
  });
}
