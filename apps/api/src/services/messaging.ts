/**
 * Sending an SMS or a WhatsApp message, and saying honestly whether it went.
 *
 * These senders used to live privately inside the marketing routes and answer
 * a bare boolean, which is why nothing else could use them: the Settings test
 * buttons returned 501, and the guest-notification switches reached nobody.
 * They are shared now, and they answer *why* a message did not go, because the
 * three reasons need three different fixes from three different people.
 *
 * Two modes, per tenant:
 *
 *  - "platform" — ResortPro's own provider account, configured by environment
 *    variable on the server, drawn from the tenant's monthly quota.
 *  - "own" — the resort's own account and credentials, entered in Settings.
 *
 * An "own" tenant is never sent through the platform account. It used to be:
 * choosing your own account and leaving the key blank, or choosing Alpha.Net,
 * which has no implementation, fell through to ResortPro's account — and
 * usage is only counted in platform mode, so those messages were sent on
 * ResortPro's bill and counted against nobody's quota.
 */

export interface MessagingTenant {
  smsMode?: string | null;
  smsProvider?: string | null;
  smsApiKey?: string | null;
  smsApiSecret?: string | null;
  smsSenderId?: string | null;
  waMode?: string | null;
  waApiToken?: string | null;
  waPhoneNumberId?: string | null;
}

export type SendResult =
  | { delivered: true; via: 'platform' | 'own'; provider: string; id?: string }
  | {
      delivered: false;
      /**
       * not_configured — credentials are missing (who must add them depends on `via`)
       * unsupported_provider — offered in Settings, not implemented
       * rejected — the provider received it and refused; `detail` is its reason
       */
      reason: 'not_configured' | 'unsupported_provider' | 'rejected';
      via: 'platform' | 'own';
      provider?: string;
      detail: string;
    };

type ProviderAnswer = { ok: true; id?: string } | { ok: false; detail: string };

// ─── SMS ──────────────────────────────────────────────────────────────────────

export async function sendSms(tenant: MessagingTenant, phone: string, message: string): Promise<SendResult> {
  if (tenant.smsMode === 'own') {
    const provider = tenant.smsProvider ?? '';
    if (provider !== 'ssl_wireless' && provider !== 'twilio') {
      return {
        delivered: false, reason: 'unsupported_provider', via: 'own', provider,
        detail: provider
          ? `Sending through ${provider} is not available yet. Choose SSL Wireless or Twilio.`
          : 'No SMS provider is selected.',
      };
    }
    if (!tenant.smsApiKey || (provider === 'twilio' && !tenant.smsApiSecret)) {
      return {
        delivered: false, reason: 'not_configured', via: 'own', provider,
        detail: 'Your own SMS account is selected, but its credentials are incomplete.',
      };
    }
    const answer = provider === 'ssl_wireless'
      ? await sslWirelessSend(tenant.smsApiKey, tenant.smsSenderId || 'RESORT', phone, message)
      : await twilioSend(tenant.smsApiKey, tenant.smsApiSecret!, tenant.smsSenderId ?? '', phone, message);
    return toResult(answer, 'own', provider);
  }

  const apiKey = process.env.SSL_WIRELESS_API_KEY;
  if (!apiKey) {
    return {
      delivered: false, reason: 'not_configured', via: 'platform', provider: 'ssl_wireless',
      detail: "ResortPro's SMS service is not set up on this server yet.",
    };
  }
  const senderId = process.env.SSL_WIRELESS_SENDER_ID || 'ResortPro';
  return toResult(await sslWirelessSend(apiKey, senderId, phone, message), 'platform', 'ssl_wireless');
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

export async function sendWhatsApp(tenant: MessagingTenant, phone: string, message: string): Promise<SendResult> {
  if (tenant.waMode === 'own') {
    if (!tenant.waApiToken || !tenant.waPhoneNumberId) {
      return {
        delivered: false, reason: 'not_configured', via: 'own', provider: 'meta',
        detail: 'Your own WhatsApp Business account is selected, but its token or phone number ID is missing.',
      };
    }
    return toResult(await metaWaSend(tenant.waApiToken, tenant.waPhoneNumberId, phone, message), 'own', 'meta');
  }

  const token = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return {
      delivered: false, reason: 'not_configured', via: 'platform', provider: 'meta',
      detail: "ResortPro's WhatsApp service is not set up on this server yet.",
    };
  }
  return toResult(await metaWaSend(token, phoneId, phone, message), 'platform', 'meta');
}

function toResult(answer: ProviderAnswer, via: 'platform' | 'own', provider: string): SendResult {
  return answer.ok
    ? { delivered: true, via, provider, id: answer.id }
    : { delivered: false, reason: 'rejected', via, provider, detail: answer.detail };
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function readJson(res: Response): Promise<any> {
  try { return await res.json(); } catch { return null; }
}

function networkFailure(provider: string, e: unknown): ProviderAnswer {
  return { ok: false, detail: `Could not reach ${provider}: ${e instanceof Error ? e.message : String(e)}` };
}

export async function sslWirelessSend(apiKey: string, senderId: string, phone: string, message: string): Promise<ProviderAnswer> {
  try {
    const res = await fetch('https://globalsms.sslwireless.com/api/v3/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_token: apiKey,
        sid: senderId,
        msisdn: phone.replace(/^\+/, ''),
        sms: message,
        csmsid: `rp_${Date.now()}`,
      }),
    });
    const data = await readJson(res);
    // The acceptance test is carried over unchanged from the marketing sender.
    // It has not been checked against a live SSL Wireless response from this
    // codebase — confirm it with the first real test message.
    if (data?.status === 'ACCEPTED' || data?.status === 'SUCCESS' || data?.status_code === 200) {
      return { ok: true, id: data?.smsinfo?.[0]?.reference_id };
    }
    return { ok: false, detail: data?.error_message || data?.status_message || `SSL Wireless answered HTTP ${res.status}` };
  } catch (e) {
    return networkFailure('SSL Wireless', e);
  }
}

export async function twilioSend(accountSid: string, authToken: string, from: string, to: string, message: string): Promise<ProviderAnswer> {
  try {
    const creds = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: to, Body: message }).toString(),
    });
    const data = await readJson(res);
    // Twilio answers 201 with the message sid once it has accepted the
    // message; anything else carries `message` explaining the refusal.
    if (res.ok && data?.sid) return { ok: true, id: data.sid };
    return { ok: false, detail: data?.message || `Twilio answered HTTP ${res.status}` };
  } catch (e) {
    return networkFailure('Twilio', e);
  }
}

export async function metaWaSend(token: string, phoneNumberId: string, to: string, message: string): Promise<ProviderAnswer> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await readJson(res);
    const id = data?.messages?.[0]?.id;
    if (id) return { ok: true, id };

    const err = data?.error;
    // A plain text message is only allowed inside the 24-hour window after the
    // recipient last messaged the business. Anything a resort sends first — a
    // booking confirmation, a reminder — needs a Meta-approved template, and
    // Meta refuses free text with this code. Say so, because the raw message
    // does not make the fix obvious.
    if (err?.code === 131047) {
      return {
        ok: false,
        detail: 'WhatsApp only allows a free-text message within 24 hours of the guest messaging you. '
          + 'Messages a resort starts need an approved template.',
      };
    }
    return { ok: false, detail: err?.message || `WhatsApp answered HTTP ${res.status}` };
  } catch (e) {
    return networkFailure('WhatsApp', e);
  }
}
