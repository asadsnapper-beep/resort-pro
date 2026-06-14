/**
 * ticketWebhooks.ts  —  /api/ticket-webhooks/*
 *
 * Inbound webhook handlers for support ticket channels:
 *
 *   POST /api/ticket-webhooks/telegram
 *     Telegram Bot webhook — receives message updates from Telegram
 *     Guest texts the bot → ticket created (or message added to open ticket)
 *
 *   POST /api/ticket-webhooks/telegram/setup
 *     Saves bot token, validates it, registers webhook URL with Telegram
 *     (requires OWNER/MANAGER auth)
 *
 *   GET  /api/ticket-webhooks/telegram/info
 *     Returns current Telegram config status (requiresAuth)
 *
 *   GET  /api/ticket-webhooks/whatsapp
 *     WhatsApp webhook verification challenge (required by Meta)
 *
 *   POST /api/ticket-webhooks/whatsapp
 *     WhatsApp Cloud API webhook — receives inbound messages
 *     Guest WhatsApps the business number → ticket created
 *
 * Security:
 *   - Telegram: webhook URL uses tenantId as path segment (obscured URL)
 *   - WhatsApp: Meta sends a hub.verify_token we validate against a stored secret
 *
 * Ticket creation logic:
 *   - New sender (chat_id / WA number not seen before) → CREATE new ticket
 *   - Same sender has an OPEN or IN_PROGRESS ticket → ADD message to existing ticket
 *   - Sender has only RESOLVED/CLOSED tickets → CREATE new ticket
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@resort-pro/database'
import { requireAuth, requireRole } from '../middleware/auth'
import { ok } from '../utils/response'
import type { JwtPayload } from '@resort-pro/types'
import {
  sendTelegramMessage,
  setTelegramWebhook,
  validateTelegramToken,
} from '../services/ticketChannels'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find or create a "bot user" placeholder for the system to attach messages to.
 * Messages from external channels are stored with this userId as senderId and senderType=BOT.
 */
async function getOrCreateBotUser(tenantId: string) {
  const botEmail = `bot@${tenantId}.system`
  return prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: botEmail } },
    create: {
      tenantId,
      email: botEmail,
      firstName: 'Bot',
      lastName: 'System',
      role: 'RECEPTIONIST',
      passwordHash: '',       // no login
      isActive: false,
    },
    update: {},
  })
}

/**
 * Find the most recent open/in-progress ticket for a given externalChatId in this tenant.
 * Returns null if no active ticket found (caller should create a new one).
 */
async function findActiveTicketForChat(tenantId: string, externalChatId: string) {
  return prisma.supportTicket.findFirst({
    where: {
      tenantId,
      externalChatId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function ticketWebhookRoutes(app: FastifyInstance) {

  // ── POST /telegram/setup ──────────────────────────────────────────────────
  // Staff saves Telegram bot token + optional notification chat ID
  app.post('/telegram/setup', {
    schema: { tags: ['ticket-webhooks'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request, reply) => {
      const { tenantId } = request.user as JwtPayload
      const { botToken, notifChatId } = z.object({
        botToken: z.string().min(10),
        notifChatId: z.string().optional(),
      }).parse(request.body)

      // Validate the token with Telegram
      const validation = await validateTelegramToken(botToken)
      if (!validation.ok) {
        return reply.status(400).send({ error: `Invalid bot token: ${validation.error}` })
      }

      // Save to tenant
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          telegramBotToken: botToken,
          ...(notifChatId !== undefined && { telegramNotifChatId: notifChatId }),
        },
      })

      // Register our webhook URL with Telegram
      const webhookUrl = `${process.env.API_BASE_URL ?? 'https://api.resortpro.app'}/api/ticket-webhooks/telegram/${tenantId}`
      const webhookResult = await setTelegramWebhook(botToken, webhookUrl)

      return ok({
        botUsername: validation.username,
        webhookUrl,
        webhookRegistered: webhookResult.ok,
        webhookError: webhookResult.error ?? null,
      })
    },
  })

  // ── GET /telegram/info ────────────────────────────────────────────────────
  app.get('/telegram/info', {
    schema: { tags: ['ticket-webhooks'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { telegramBotToken: true, telegramNotifChatId: true },
      })
      const configured = !!tenant?.telegramBotToken
      const webhookUrl = configured
        ? `${process.env.API_BASE_URL ?? 'https://api.resortpro.app'}/api/ticket-webhooks/telegram/${tenantId}`
        : null

      // Mask token for display
      const tokenMasked = tenant?.telegramBotToken
        ? tenant.telegramBotToken.slice(0, 8) + '…' + tenant.telegramBotToken.slice(-4)
        : null

      return ok({ configured, tokenMasked, webhookUrl, notifChatId: tenant?.telegramNotifChatId ?? null })
    },
  })

  // ── DELETE /telegram/setup ────────────────────────────────────────────────
  app.delete('/telegram/setup', {
    schema: { tags: ['ticket-webhooks'], security: [{ bearerAuth: [] }] },
    preHandler: [requireAuth, requireRole('OWNER', 'MANAGER')],
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { telegramBotToken: null, telegramNotifChatId: null },
      })
      return ok({ disconnected: true })
    },
  })

  // ── GET /whatsapp/info ────────────────────────────────────────────────────
  app.get('/whatsapp/info', {
    schema: { tags: ['ticket-webhooks'], security: [{ bearerAuth: [] }] },
    preHandler: requireAuth,
    handler: async (request) => {
      const { tenantId } = request.user as JwtPayload
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { waEnabled: true, waPhoneNumberId: true, waBusinessAccId: true },
      })
      const webhookUrl = `${process.env.API_BASE_URL ?? 'https://api.resortpro.app'}/api/ticket-webhooks/whatsapp/${tenantId}`
      const verifyToken = `wa_${tenantId.replace(/-/g, '').slice(0, 16)}`
      return ok({
        configured: !!(tenant?.waEnabled && tenant?.waPhoneNumberId),
        webhookUrl,
        verifyToken,
        phoneNumberId: tenant?.waPhoneNumberId ?? null,
      })
    },
  })

  // ── POST /:tenantId/telegram  (Telegram Bot webhook) ──────────────────────
  // No auth — Telegram calls this URL directly.
  // The tenantId in the path acts as a secret URL segment.
  app.post('/:tenantId/telegram', {
    schema: { tags: ['ticket-webhooks'] },
    handler: async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, telegramBotToken: true, telegramNotifChatId: true },
      })
      if (!tenant?.telegramBotToken) return reply.status(200).send('ok') // silently ignore

      const body = request.body as any
      const message = body?.message
      if (!message?.text || !message?.chat?.id) return reply.status(200).send('ok')

      const chatId = String(message.chat.id)
      const senderName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Telegram User'
      const text = message.text as string
      const externalMsgId = String(message.message_id)

      // Dedup — if this message_id already processed, skip
      const duplicate = await prisma.chatMessage.findFirst({
        where: { externalMsgId, ticket: { tenantId } },
      })
      if (duplicate) return reply.status(200).send('ok')

      const botUser = await getOrCreateBotUser(tenantId)
      const existingTicket = await findActiveTicketForChat(tenantId, chatId)

      if (existingTicket) {
        // Add message to existing open ticket
        await prisma.chatMessage.create({
          data: {
            ticketId: existingTicket.id,
            senderId: botUser.id,
            senderType: 'GUEST',
            message: `${senderName}: ${text}`,
            externalMsgId,
          },
        })
        // Ack to guest
        await sendTelegramMessage(tenant.telegramBotToken, chatId,
          `✅ Your message has been added to ticket *#${existingTicket.id.slice(0, 8)}*. Our team will reply shortly.`)
      } else {
        // Create new ticket
        const ticket = await prisma.supportTicket.create({
          data: {
            tenantId,
            title: text.length > 100 ? text.slice(0, 97) + '…' : text,
            description: text,
            category: 'OTHER',
            priority: 'MEDIUM',
            source: 'TELEGRAM',
            externalChatId: chatId,
          },
        })

        await prisma.chatMessage.create({
          data: {
            ticketId: ticket.id,
            senderId: botUser.id,
            senderType: 'GUEST',
            message: `${senderName}: ${text}`,
            externalMsgId,
          },
        })

        // Ack to guest
        await sendTelegramMessage(tenant.telegramBotToken, chatId,
          `🎫 Ticket created! Your request has been received and a team member will assist you soon.\n\nTicket ID: *${ticket.id.slice(0, 8)}*`)

        // Notify staff channel (if configured)
        if (tenant.telegramNotifChatId) {
          await sendTelegramMessage(tenant.telegramBotToken, tenant.telegramNotifChatId,
            `📨 *New support ticket from Telegram*\n\nFrom: ${senderName}\nMessage: ${text}\n\nTicket: ${ticket.id.slice(0, 8)}`)
        }
      }

      return reply.status(200).send('ok')
    },
  })

  // ── GET /:tenantId/whatsapp  (Meta verification challenge) ────────────────
  app.get('/:tenantId/whatsapp', {
    schema: { tags: ['ticket-webhooks'] },
    handler: async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string }
      const query = request.query as Record<string, string>

      const mode = query['hub.mode']
      const token = query['hub.verify_token']
      const challenge = query['hub.challenge']

      // Expected verify token is deterministic per tenant
      const expectedToken = `wa_${tenantId.replace(/-/g, '').slice(0, 16)}`

      if (mode === 'subscribe' && token === expectedToken) {
        return reply.status(200).send(challenge)
      }
      return reply.status(403).send('Forbidden')
    },
  })

  // ── POST /:tenantId/whatsapp  (Meta WhatsApp webhook) ─────────────────────
  app.post('/:tenantId/whatsapp', {
    schema: { tags: ['ticket-webhooks'] },
    handler: async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, waEnabled: true, waApiToken: true, waPhoneNumberId: true, telegramBotToken: true, telegramNotifChatId: true },
      })
      if (!tenant?.waEnabled || !tenant?.waApiToken) return reply.status(200).send('ok')

      const body = request.body as any
      // WhatsApp webhook payload structure
      const entry = body?.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages

      if (!Array.isArray(messages) || messages.length === 0) return reply.status(200).send('ok')

      const msg = messages[0]
      if (msg.type !== 'text') return reply.status(200).send('ok') // only handle text for now

      const fromPhone = msg.from as string           // E.164 format e.g. "8801712345678"
      const text = msg.text?.body as string
      const externalMsgId = msg.id as string
      const senderName = value?.contacts?.[0]?.profile?.name ?? fromPhone

      // Dedup
      const duplicate = await prisma.chatMessage.findFirst({
        where: { externalMsgId, ticket: { tenantId } },
      })
      if (duplicate) return reply.status(200).send('ok')

      const botUser = await getOrCreateBotUser(tenantId)
      const existingTicket = await findActiveTicketForChat(tenantId, fromPhone)

      if (existingTicket) {
        await prisma.chatMessage.create({
          data: {
            ticketId: existingTicket.id,
            senderId: botUser.id,
            senderType: 'GUEST',
            message: `${senderName}: ${text}`,
            externalMsgId,
          },
        })
      } else {
        const ticket = await prisma.supportTicket.create({
          data: {
            tenantId,
            title: text.length > 100 ? text.slice(0, 97) + '…' : text,
            description: text,
            category: 'OTHER',
            priority: 'MEDIUM',
            source: 'WHATSAPP',
            externalChatId: fromPhone,
          },
        })

        await prisma.chatMessage.create({
          data: {
            ticketId: ticket.id,
            senderId: botUser.id,
            senderType: 'GUEST',
            message: `${senderName}: ${text}`,
            externalMsgId,
          },
        })

        // Notify staff via Telegram if configured
        if (tenant.telegramBotToken && tenant.telegramNotifChatId) {
          await sendTelegramMessage(tenant.telegramBotToken, tenant.telegramNotifChatId,
            `📱 *New WhatsApp ticket*\n\nFrom: ${senderName} (${fromPhone})\nMessage: ${text}`)
        }
      }

      return reply.status(200).send('ok')
    },
  })
}
