import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

const FROM = process.env.EMAIL_FROM || 'ResortPro <noreply@resortpro.app>';

/* ── Template variable replacer ─────────────────────────────────────────────── */
export function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/* ── Default branded HTML wrapper ───────────────────────────────────────────── */
export function wrapEmail({
  body,
  tenantName,
  primaryColor = '#1a6b5e',
  accentColor = '#d4a853',
  unsubscribeUrl,
}: {
  body: string;
  tenantName: string;
  primaryColor?: string;
  accentColor?: string;
  unsubscribeUrl?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${tenantName}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:${primaryColor};padding:28px 40px;text-align:center;">
            <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${tenantName}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;">${tenantName}</p>
            ${unsubscribeUrl ? `<p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#9ca3af;font-size:12px;text-decoration:underline;">Unsubscribe</a></p>` : ''}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ── Send a single email ─────────────────────────────────────────────────────── */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ id: string | null; error: string | null }> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      replyTo,
    });
    if (error) return { id: null, error: error.message };
    return { id: data?.id ?? null, error: null };
  } catch (err: any) {
    return { id: null, error: err.message ?? 'Unknown email error' };
  }
}

/* ── Pre-built sequence email bodies ─────────────────────────────────────────── */
export const SEQUENCE_TEMPLATES = {
  BOOKING_CONFIRMED: (vars: { guestName: string; roomName: string; checkIn: string; checkOut: string; confirmationNo: string; tenantName: string; accentColor: string }) => `
    <h2 style="margin:0 0 16px;font-size:24px;color:#111827;">Your booking is confirmed! 🎉</h2>
    <p style="color:#6b7280;line-height:1.6;">Hi ${vars.guestName},</p>
    <p style="color:#6b7280;line-height:1.6;">We're thrilled to welcome you to <strong>${vars.tenantName}</strong>. Your reservation is confirmed and we can't wait to host you.</p>
    <table width="100%" style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:6px 0;"><strong style="color:#374151;">Confirmation #</strong></td><td style="text-align:right;color:${vars.accentColor};font-weight:700;font-family:monospace;">${vars.confirmationNo}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:#374151;">Room</strong></td><td style="text-align:right;color:#374151;">${vars.roomName}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:#374151;">Check-in</strong></td><td style="text-align:right;color:#374151;">${vars.checkIn}</td></tr>
      <tr><td style="padding:6px 0;"><strong style="color:#374151;">Check-out</strong></td><td style="text-align:right;color:#374151;">${vars.checkOut}</td></tr>
    </table>
    <p style="color:#6b7280;line-height:1.6;">If you have any questions before your arrival, feel free to reach out to us anytime.</p>
    <p style="color:#6b7280;line-height:1.6;margin-top:24px;">Warm regards,<br/><strong>${vars.tenantName} Team</strong></p>
  `,

  PRE_ARRIVAL: (vars: { guestName: string; checkIn: string; tenantName: string; primaryColor: string; slug: string; apiUrl: string }) => `
    <h2 style="margin:0 0 16px;font-size:24px;color:#111827;">Your stay is almost here! ✨</h2>
    <p style="color:#6b7280;line-height:1.6;">Hi ${vars.guestName},</p>
    <p style="color:#6b7280;line-height:1.6;">Just a few days until your arrival on <strong>${vars.checkIn}</strong>. We're preparing everything to make your stay perfect.</p>
    <p style="color:#6b7280;line-height:1.6;margin-top:16px;"><strong>Enhance your stay:</strong></p>
    <ul style="color:#6b7280;line-height:1.8;padding-left:20px;">
      <li>🍽️ Pre-order from our restaurant menu</li>
      <li>🛏️ Request a room upgrade</li>
      <li>🎂 Planning a celebration? Let us know</li>
    </ul>
    <a href="${vars.apiUrl}/${vars.slug}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:${vars.primaryColor};color:#ffffff;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px;">Explore our resort →</a>
    <p style="color:#6b7280;line-height:1.6;margin-top:24px;">See you soon!<br/><strong>${vars.tenantName} Team</strong></p>
  `,

  POST_STAY: (vars: { guestName: string; tenantName: string; primaryColor: string; slug: string; apiUrl: string }) => `
    <h2 style="margin:0 0 16px;font-size:24px;color:#111827;">Thank you for staying with us 🙏</h2>
    <p style="color:#6b7280;line-height:1.6;">Hi ${vars.guestName},</p>
    <p style="color:#6b7280;line-height:1.6;">It was a pleasure hosting you at <strong>${vars.tenantName}</strong>. We hope your stay was everything you'd hoped for.</p>
    <p style="color:#6b7280;line-height:1.6;">We'd love to hear your thoughts — your feedback helps us improve for every future guest.</p>
    <a href="${vars.apiUrl}/${vars.slug}#feedback" style="display:inline-block;margin-top:24px;padding:14px 28px;background:${vars.primaryColor};color:#ffffff;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px;">Share your feedback →</a>
    <p style="color:#6b7280;line-height:1.6;margin-top:24px;">We hope to welcome you back soon!<br/><strong>${vars.tenantName} Team</strong></p>
  `,

  WIN_BACK: (vars: { guestName: string; tenantName: string; primaryColor: string; accentColor: string; slug: string; apiUrl: string }) => `
    <h2 style="margin:0 0 16px;font-size:24px;color:#111827;">We miss you, ${vars.guestName}! 💚</h2>
    <p style="color:#6b7280;line-height:1.6;">It's been a while since your last visit to <strong>${vars.tenantName}</strong>, and we'd love to welcome you back.</p>
    <div style="background:linear-gradient(135deg,${vars.primaryColor}15,${vars.accentColor}15);border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 8px;font-size:28px;font-weight:700;color:${vars.primaryColor};">Special Offer</p>
      <p style="margin:0;color:#374151;font-size:16px;">Mention this email to receive a <strong>10% discount</strong> on your next booking.</p>
    </div>
    <a href="${vars.apiUrl}/${vars.slug}#booking" style="display:inline-block;padding:14px 28px;background:${vars.primaryColor};color:#ffffff;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px;">Book your return stay →</a>
    <p style="color:#6b7280;line-height:1.6;margin-top:24px;">We look forward to seeing you again!<br/><strong>${vars.tenantName} Team</strong></p>
  `,

  BIRTHDAY: (vars: { guestName: string; tenantName: string; primaryColor: string; accentColor: string; slug: string; apiUrl: string }) => `
    <h2 style="margin:0 0 16px;font-size:24px;color:#111827;text-align:center;">🎂 Happy Birthday, ${vars.guestName}!</h2>
    <p style="color:#6b7280;line-height:1.6;text-align:center;">Wishing you a wonderful birthday from all of us at <strong>${vars.tenantName}</strong>.</p>
    <div style="text-align:center;font-size:48px;margin:24px 0;">🎉🥂🌟</div>
    <div style="background:linear-gradient(135deg,${vars.accentColor}20,${vars.primaryColor}20);border-radius:12px;padding:24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:${vars.primaryColor};">Birthday Gift</p>
      <p style="margin:0;color:#374151;">Complimentary room upgrade + welcome amenities on your birthday stay.</p>
    </div>
    <div style="text-align:center;margin-top:28px;">
      <a href="${vars.apiUrl}/${vars.slug}#booking" style="display:inline-block;padding:14px 28px;background:${vars.accentColor};color:#1a1a1a;border-radius:50px;text-decoration:none;font-weight:700;font-size:14px;">Claim your birthday treat →</a>
    </div>
    <p style="color:#6b7280;line-height:1.6;margin-top:24px;text-align:center;">With love,<br/><strong>${vars.tenantName} Team</strong></p>
  `,
};
