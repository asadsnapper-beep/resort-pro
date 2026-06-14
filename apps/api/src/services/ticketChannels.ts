/**
 * ticketChannels.ts
 *
 * Bidirectional channel bridge for support tickets.
 *
 * Guest → Telegram/WhatsApp → webhook → ticket created/message added → dashboard
 * Staff → reply in dashboard → POST /tickets/:id/messages → forwardReplyToChannel → guest's phone/Telegram
 *
 * Supported channels:
 *   TELEGRAM  — Telegram Bot API (sendMessage)
 *   WHATSAPP  — Meta WhatsApp Cloud API (messages endpoint)
 *   WEB       — no forwarding needed (internal only)
 */

// ─── Telegram ─────────────────────────────────────────────────────────────────

/**
 * Send a text message via Telegram Bot API.
 * @param botToken  Bot token from BotFather
 * @param chatId    Telegram chat_id (number or string — stored as string in DB)
 * @param text      Message text (plain text or Markdown)
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
    const data = await res.json() as any
    if (!data.ok) return { ok: false, error: data.description ?? 'Telegram error' }
    return { ok: true, messageId: data.result?.message_id }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Network error' }
  }
}

/**
 * Register a webhook URL with Telegram so the bot forwards updates to us.
 * Call once when the user saves their bot token.
 */
export async function setTelegramWebhook(
  botToken: string,
  webhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
    })
    const data = await res.json() as any
    return data.ok ? { ok: true } : { ok: false, error: data.description }
  } catch (err: any) {
    return { ok: false, error: err?.message }
  }
}

/**
 * Validate a Telegram bot token by calling getMe.
 * Returns the bot username if valid.
 */
export async function validateTelegramToken(
  botToken: string,
): Promise<{ ok: boolean; username?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const data = await res.json() as any
    if (!data.ok) return { ok: false, error: data.description ?? 'Invalid token' }
    return { ok: true, username: data.result?.username }
  } catch (err: any) {
    return { ok: false, error: err?.message }
  }
}

// ─── WhatsApp Cloud API ───────────────────────────────────────────────────────

/**
 * Send a text message via Meta WhatsApp Cloud API.
 * @param apiToken       Permanent system user token (from Meta Business)
 * @param phoneNumberId  WhatsApp Business Phone Number ID
 * @param to             Recipient phone number in E.164 format (e.g. "+8801712345678")
 * @param text           Message body
 */
export async function sendWhatsAppMessage(
  apiToken: string,
  phoneNumberId: string,
  to: string,
  text: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      },
    )
    const data = await res.json() as any
    if (!res.ok || data.error) {
      return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, messageId: data.messages?.[0]?.id }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Network error' }
  }
}

// ─── Unified forwarder ────────────────────────────────────────────────────────

interface TicketChannelInfo {
  source: string          // "WEB" | "TELEGRAM" | "WHATSAPP"
  externalChatId: string | null
}

interface TenantChannelConfig {
  telegramBotToken: string | null
  waApiToken: string | null
  waPhoneNumberId: string | null
  waEnabled: boolean
}

/**
 * Forward a staff reply back to the guest's original platform.
 * Returns silently if the ticket has no external channel.
 * Logs (but does not throw) on send failure so the ticket message is always saved.
 */
export async function forwardReplyToChannel(
  ticket: TicketChannelInfo,
  tenant: TenantChannelConfig,
  staffReply: string,
  staffName: string,
): Promise<void> {
  if (!ticket.externalChatId) return

  const prefix = `🏨 *Staff reply* (${staffName}):\n\n`
  const text = prefix + staffReply

  if (ticket.source === 'TELEGRAM' && tenant.telegramBotToken) {
    const result = await sendTelegramMessage(tenant.telegramBotToken, ticket.externalChatId, text)
    if (!result.ok) {
      console.warn(`[ticketChannels] Telegram reply failed for chat ${ticket.externalChatId}: ${result.error}`)
    }
  } else if (ticket.source === 'WHATSAPP' && tenant.waEnabled && tenant.waApiToken && tenant.waPhoneNumberId) {
    const result = await sendWhatsAppMessage(
      tenant.waApiToken,
      tenant.waPhoneNumberId,
      ticket.externalChatId,
      `Staff reply (${staffName}):\n\n${staffReply}`,  // WA doesn't support Markdown
    )
    if (!result.ok) {
      console.warn(`[ticketChannels] WhatsApp reply failed for ${ticket.externalChatId}: ${result.error}`)
    }
  }
}
