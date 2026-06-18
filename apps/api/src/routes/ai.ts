import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth';
import { ok } from '../utils/response';
import { aiStatusForTenant, requireAiFeature } from '../utils/ai-guard';
import type { JwtPayload } from '@resort-pro/types';

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

  // POST /api/ai/content/generate — guarded; real Claude call wired in Step 3.
  // For now proves the gate: returns 403 when ai_content is disabled.
  app.post('/content/generate', {
    schema: { tags: ['ai'], summary: 'Generate content draft (AI)', security: [{ bearerAuth: [] }] },
    preHandler: [requireRole('OWNER', 'MANAGER'), requireAiFeature('ai_content')],
    handler: async () => {
      return ok({ pending: true }, 'AI content generation not yet wired (Step 3)');
    },
  });
}
