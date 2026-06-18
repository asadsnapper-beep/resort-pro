/**
 * AI Content Generator service — the actual Claude call.
 *
 * Ships behind the ai_content flag (route guards it). Nothing here runs until
 * the master switch + tenant flag are ON and an API key is configured.
 * See plan/ai/ROLLOUT-STRATEGY.md
 */
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@resort-pro/database';

// Cheap model for content generation (cost control — see README cost model).
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;

/** Thrown when AI is enabled but no API key is configured anywhere. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super('No AI API key configured (set a platform key in super-admin Settings, or a BYOK key).');
    this.name = 'AiNotConfiguredError';
  }
}

export interface ContentRequest {
  contentType: 'room_desc' | 'promo_email' | 'social_post' | 'offer_copy' | 'review_response';
  details: string;        // free-text brief / context from the owner
  tone?: string;          // luxury | friendly | formal ...
  language?: string;      // en | bn ...
}

export interface ContentResult {
  content: string;
  tokensUsed: number;
}

/** Resolve the API key: BYOK for the tenant first, else the platform key. */
async function resolveApiKey(tenantId: string): Promise<string> {
  const keys = await prisma.aiKeys.findUnique({
    where: { tenantId },
    select: { mode: true, dashboardKey: true },
  });
  if (keys?.mode === 'byok' && keys.dashboardKey) return keys.dashboardKey;

  const settings = await prisma.platformSettings.findUnique({
    where: { id: 'singleton' },
    select: { aiApiKey: true },
  });
  if (settings?.aiApiKey) return settings.aiApiKey;

  throw new AiNotConfiguredError();
}

function buildPrompt(req: ContentRequest): string {
  const lang = req.language === 'bn' ? 'Bangla' : 'English';
  const tone = req.tone ? `Tone: ${req.tone}.` : '';
  const kindMap: Record<ContentRequest['contentType'], string> = {
    room_desc: 'an SEO-friendly hotel room description (150–200 words)',
    promo_email: 'a promotional email (subject line + body, 150–250 words)',
    social_post: '3 short social media captions with relevant hashtags',
    offer_copy: 'short marketing copy for a special offer',
    review_response: 'a professional, warm reply to a guest review',
  };
  return [
    `Write ${kindMap[req.contentType]} in ${lang}.`,
    tone,
    `Details: ${req.details}`,
    'Do not invent facts or make false claims. Return only the content, no preamble.',
  ].filter(Boolean).join('\n');
}

/** Call Claude and return the generated text + token count. (Costs tokens.) */
export async function generateContent(tenantId: string, req: ContentRequest): Promise<ContentResult> {
  const apiKey = await resolveApiKey(tenantId);
  const client = new Anthropic({ apiKey });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: buildPrompt(req) }],
  });

  const content = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const tokensUsed = (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0);
  return { content, tokensUsed };
}
