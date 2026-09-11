/**
 * Daily Report Auto-Dispatch
 *
 * Runs every minute. For each tenant with dispatch enabled,
 * checks if the current HH:MM matches their dispatchTime,
 * and if this date hasn't been dispatched yet, sends the report
 * to Telegram and/or WhatsApp.
 */

import cron from 'node-cron';
import { prisma } from '@resort-pro/database';
import { buildReport } from '../services/reporting/build-report';
import { localDateToday, resolveReportPeriod } from '../services/reporting/period';

// ── Telegram ──────────────────────────────────────────────────────────────────
async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = await res.json() as any;
    return data?.ok === true;
  } catch (e) {
    console.error('[ReportDispatch] Telegram error:', e);
    return false;
  }
}

// ── WhatsApp (Meta Cloud API via tenant config or env vars) ───────────────────
async function sendWhatsAppReport(
  tenant: { waMode?: string | null; waApiToken?: string | null; waPhoneNumberId?: string | null },
  phone: string,
  message: string,
): Promise<boolean> {
  let token: string | null = null;
  let phoneNumberId: string | null = null;

  if (tenant.waMode === 'own' && tenant.waApiToken && tenant.waPhoneNumberId) {
    token = tenant.waApiToken;
    phoneNumberId = tenant.waPhoneNumberId;
  } else {
    token = process.env.META_WA_TOKEN ?? null;
    phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID ?? null;
  }

  if (!token || !phoneNumberId) {
    console.warn('[ReportDispatch] WhatsApp not configured for tenant');
    return false;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'text',
        text: { body: message },
      }),
    });
    const data = await res.json() as any;
    return !!data?.messages?.[0]?.id;
  } catch (e) {
    console.error('[ReportDispatch] WhatsApp error:', e);
    return false;
  }
}

// ── Report text builder ───────────────────────────────────────────────────────
function buildReportText(report: any): string {
  const cur = report.tenant.currency;
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch { return `${cur} ${n.toFixed(0)}`; }
  };

  return `<b>📊 Daily Report — ${report.tenant.name}</b>
📅 ${report.date}

<b>🏨 Occupancy</b>
Rooms: ${report.occupancy.occupied}/${report.occupancy.totalRooms} (${report.occupancy.rate}%)

<b>💳 Received</b>
Cash: ${fmt(report.financial.cashCollected.byMethod.CASH)}
Card/Online: ${fmt(report.financial.cashCollected.byMethod.CARD + report.financial.cashCollected.byMethod.STRIPE)}
Bank Transfer: ${fmt(report.financial.cashCollected.byMethod.BANK_TRANSFER)}
<b>Total: ${fmt(report.financial.cashCollected.total)}</b>

<b>🧾 Charged to guests</b>
Restaurant: ${fmt(report.financial.chargesPosted.restaurant)}
Extras: ${fmt(report.financial.chargesPosted.extras)}
<i>Charged, not yet all received — not added above.</i>

<b>🛬 Arrivals: ${report.arrivals.length}</b>
<b>🛫 Departures: ${report.departures.length}</b>
${report.noShows.length > 0 ? `⚠️ No-shows: ${report.noShows.length}\n` : ''}
<b>🔧 Operations</b>
Housekeeping: ✅${report.housekeeping.completed} ⏳${report.housekeeping.pending}
Maintenance: 🔴${report.maintenance.open} open, ✅${report.maintenance.resolvedToday} resolved

<i>Sent by ResortPro</i>`;
}

// Plain text version for WhatsApp (no HTML)
function buildReportTextPlain(report: any): string {
  const cur = report.tenant.currency;
  const fmt = (n: number) => {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch { return `${cur} ${n.toFixed(0)}`; }
  };

  return `📊 Daily Report — ${report.tenant.name}
📅 ${report.date}

🏨 Occupancy
Rooms: ${report.occupancy.occupied}/${report.occupancy.totalRooms} (${report.occupancy.rate}%)

💳 Received
Cash: ${fmt(report.financial.cashCollected.byMethod.CASH)}
Card/Online: ${fmt(report.financial.cashCollected.byMethod.CARD + report.financial.cashCollected.byMethod.STRIPE)}
Bank Transfer: ${fmt(report.financial.cashCollected.byMethod.BANK_TRANSFER)}
Total: ${fmt(report.financial.cashCollected.total)}

🧾 Charged to guests
Restaurant: ${fmt(report.financial.chargesPosted.restaurant)}
Extras: ${fmt(report.financial.chargesPosted.extras)}
(Charged, not yet all received - not added above.)

🛬 Arrivals: ${report.arrivals.length}
🛫 Departures: ${report.departures.length}${report.noShows.length > 0 ? `\n⚠️ No-shows: ${report.noShows.length}` : ''}

🔧 Operations
Housekeeping: ✅${report.housekeeping.completed} pending: ${report.housekeeping.pending}
Maintenance: ${report.maintenance.open} open, ${report.maintenance.resolvedToday} resolved today

Sent by ResortPro`;
}

// ── Main cron ─────────────────────────────────────────────────────────────────
export function startReportDispatchJob() {
  // Runs every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // The dispatch time is the resort's wall clock, so the comparison has to be
    // made per tenant. This used to read the server's hour and filter on it in
    // SQL, which meant a resort asking for 20:00 was sent its evening report at
    // 20:00 wherever the container happened to run — 02:00 the next day in
    // Dhaka, on a UTC host. `todayStr` came from toISOString() for the same
    // reason and was a day behind every evening after 18:00 local.
    const settings = await prisma.reportDispatchSettings.findMany({
      where: { enabled: true },
      // The WhatsApp credentials are fetched here rather than carried inside
      // the report. The report object is also the body of an HTTP response, and
      // an API token has no business travelling in one.
      include: {
        tenant: {
          select: {
            timezone: true, waMode: true, waApiToken: true, waPhoneNumberId: true,
          },
        },
      },
    });

    for (const setting of settings) {
      const timezone = setting.tenant?.timezone || 'Asia/Dhaka';
      const localTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(now).replace('24:', '00:');
      const todayStr = localDateToday(timezone, now);

      // Not this resort's minute yet.
      if (setting.dispatchTime !== localTime) continue;

      // Skip if already dispatched today
      if (setting.lastDispatchDate === todayStr) continue;

      // Skip if neither channel is enabled
      if (!setting.telegramEnabled && !setting.whatsappEnabled) continue;

      try {
        const report = await buildReport(
          setting.tenantId,
          resolveReportPeriod({ from: todayStr, to: todayStr, timezone, kind: 'daily' }),
        );
        let tgSent = false;
        let waSent = false;

        if (setting.telegramEnabled && setting.telegramBotToken && setting.telegramChatId) {
          const text = buildReportText(report);
          tgSent = await sendTelegram(setting.telegramBotToken, setting.telegramChatId, text);
        }

        if (setting.whatsappEnabled && setting.whatsappPhone) {
          const text = buildReportTextPlain(report);
          waSent = await sendWhatsAppReport(
            {
              waMode: setting.tenant?.waMode,
              waApiToken: setting.tenant?.waApiToken,
              waPhoneNumberId: setting.tenant?.waPhoneNumberId,
            },
            setting.whatsappPhone,
            text,
          );
        }

        await prisma.reportDispatchSettings.update({
          where: { id: setting.id },
          data: {
            lastDispatchedAt: now,
            lastDispatchDate: todayStr,
          },
        });

        console.log(`[ReportDispatch] Tenant ${setting.tenantId} — Telegram: ${tgSent}, WhatsApp: ${waSent}, date: ${todayStr}`);
      } catch (err) {
        console.error(`[ReportDispatch] Error for tenant ${setting.tenantId}:`, err);
      }
    }
  });

  console.log('[ReportDispatch] Daily report dispatch cron started (every minute)');
}
