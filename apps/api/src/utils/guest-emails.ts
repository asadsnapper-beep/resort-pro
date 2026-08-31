/**
 * Guest lifecycle email utilities.
 * Each function checks the tenant's EmailSettings toggles before sending.
 */
import { prisma } from '@resort-pro/database';
import { bill } from '../services/billing';
import { sendEmail } from '../services/email';
import { calculateNights } from './booking';
import { createAdminNotification } from './notifications';

// ── Shared helpers ─────────────────────────────────────────────────────────

/**
 * Every guest-lifecycle email is fired-and-forgotten from bookings.ts as
 * `sendXEmail(id).catch(() => {})` — a blank catch, so a genuine failure
 * (Resend down, bad template, expired API key) vanished with zero trace,
 * the exact same silently-swallowed-failure pattern the invoice-creation
 * fix (see sequence.ts / autoCreateInvoice) already addressed elsewhere.
 * Wrap each call site with this instead of a blank catch so a real send
 * failure creates an admin notification instead of disappearing.
 */
export function trackGuestEmail(kind: string, bookingId: string, tenantId: string, promise: Promise<void>) {
  promise.catch(err => {
    createAdminNotification({
      type: 'guest_email_failed',
      title: `Guest email failed: ${kind}`,
      message: `Booking ${bookingId} (tenant ${tenantId}) — ${kind} email failed to send: ${err instanceof Error ? err.message : String(err)}`,
      metadata: { bookingId, tenantId, kind },
      linkPath: `/bookings/${bookingId}`,
    }).catch(() => {});
  });
}

function fmt(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

/** Fetch (or lazily create) the tenant's email settings. */
async function getEmailSettings(tenantId: string) {
  return prisma.emailSettings.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

/** Shared branded header + footer wrapper. */
function wrapGuest({
  tenantName,
  logoUrl,
  primaryColor = '#1a6b5e',
  replyToEmail,
  footerText,
  body,
}: {
  tenantName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  replyToEmail?: string | null;
  footerText?: string | null;
  body: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px">
  <tr><td align="center">
    <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
      <!-- Header -->
      <tr><td style="background:${primaryColor};padding:28px 32px;text-align:center">
        ${logoUrl ? `<img src="${logoUrl}" alt="${tenantName}" height="48" style="margin-bottom:8px;border-radius:4px"><br>` : ''}
        <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.3px">${tenantName}</span>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px">${body}</td></tr>
      <!-- Footer -->
      <tr><td style="background:#f8fafa;border-top:1px solid #e8edf0;padding:20px 32px;text-align:center">
        <p style="color:#888;font-size:12px;margin:0 0 4px">
          ${footerText ?? `Thank you for choosing ${tenantName}. We look forward to welcoming you!`}
        </p>
        ${replyToEmail ? `<p style="color:#aaa;font-size:11px;margin:0">Reply to: <a href="mailto:${replyToEmail}" style="color:${primaryColor}">${replyToEmail}</a></p>` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/** Shared booking details table (room, dates, guests, total). */
function bookingTable({
  room,
  checkIn,
  checkOut,
  nights,
  adults,
  children,
  totalAmount,
  currency,
  confirmationNo,
  primaryColor = '#1a6b5e',
}: {
  room: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  confirmationNo: string;
  primaryColor?: string;
}) {
  const rows = [
    ['Confirmation #', `<strong>${confirmationNo}</strong>`],
    ['Room', room],
    ['Check-in', fmtDate(checkIn)],
    ['Check-out', fmtDate(checkOut)],
    ['Duration', `${nights} night${nights !== 1 ? 's' : ''}`],
    ['Guests', `${adults} adult${adults !== 1 ? 's' : ''}${children > 0 ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}`],
    ['Total', `<strong style="color:${primaryColor};font-size:16px">${fmt(totalAmount, currency)}</strong>`],
  ];
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8edf0;border-radius:8px;overflow:hidden;margin:20px 0">
      ${rows.map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? '#f8fafa' : '#ffffff'}">
          <td style="padding:10px 16px;color:#888;font-size:13px;width:40%">${label}</td>
          <td style="padding:10px 16px;color:#1a1a1a;font-size:13px">${value}</td>
        </tr>
      `).join('')}
    </table>`;
}

// ── Email senders ──────────────────────────────────────────────────────────

export async function sendBookingConfirmation(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      room: true,
      tenant: { select: { name: true, email: true, phone: true, currency: true, logoUrl: true, brandPrimaryColor: true } },
    },
  });
  if (!booking) return;

  const settings = await getEmailSettings(booking.tenantId);
  if (!settings.sendConfirmation) return;

  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const primary = booking.tenant.brandPrimaryColor ?? '#1a6b5e';

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 4px">Booking Confirmed! 🎉</h2>
    <p style="color:#555;margin:0 0 20px">Hi ${booking.guest.firstName}, your reservation at <strong>${booking.tenant.name}</strong> is confirmed.</p>
    ${bookingTable({
      room: `${booking.room.name} (#${booking.room.number})`,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights,
      adults: booking.adults,
      children: booking.children,
      totalAmount: Number(booking.totalAmount),
      currency: booking.tenant.currency,
      confirmationNo: booking.confirmationNo,
      primaryColor: primary,
    })}
    <p style="color:#555;font-size:14px">If you have any questions, please don't hesitate to contact us${booking.tenant.email ? ` at <a href="mailto:${booking.tenant.email}" style="color:${primary}">${booking.tenant.email}</a>` : ''}.</p>
  `;

  await sendEmail({
    to: booking.guest.email,
    subject: `Booking Confirmed — ${booking.tenant.name}`,
    html: wrapGuest({
      tenantName: booking.tenant.name,
      logoUrl: booking.tenant.logoUrl,
      primaryColor: primary,
      replyToEmail: settings.replyToEmail ?? booking.tenant.email,
      footerText: settings.footerText,
      body,
    }),
  });
}

export async function sendPreArrivalReminder(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      room: true,
      tenant: { select: { name: true, email: true, phone: true, currency: true, logoUrl: true, brandPrimaryColor: true, checkInTime: true } },
    },
  });
  if (!booking) return;

  const settings = await getEmailSettings(booking.tenantId);
  if (!settings.sendPreArrival) return;

  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const primary = booking.tenant.brandPrimaryColor ?? '#1a6b5e';

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 4px">We're looking forward to welcoming you tomorrow! 🌟</h2>
    <p style="color:#555;margin:0 0 20px">Hi ${booking.guest.firstName}, just a friendly reminder that your stay at <strong>${booking.tenant.name}</strong> begins tomorrow.</p>
    ${bookingTable({
      room: `${booking.room.name} (#${booking.room.number})`,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights,
      adults: booking.adults,
      children: booking.children,
      totalAmount: Number(booking.totalAmount),
      currency: booking.tenant.currency,
      confirmationNo: booking.confirmationNo,
      primaryColor: primary,
    })}
    <div style="background:#f0faf8;border-left:4px solid ${primary};border-radius:4px;padding:16px;margin:20px 0">
      <p style="margin:0;color:#1a1a1a;font-size:14px"><strong>Check-in time:</strong> ${booking.tenant.checkInTime ?? '14:00'}</p>
      ${booking.tenant.phone ? `<p style="margin:6px 0 0;color:#555;font-size:13px">📞 ${booking.tenant.phone}</p>` : ''}
      ${booking.tenant.email ? `<p style="margin:4px 0 0;color:#555;font-size:13px">✉️ ${booking.tenant.email}</p>` : ''}
    </div>
    <p style="color:#555;font-size:14px">Safe travels! We can't wait to make your stay memorable.</p>
  `;

  await sendEmail({
    to: booking.guest.email,
    subject: `See you tomorrow at ${booking.tenant.name}!`,
    html: wrapGuest({
      tenantName: booking.tenant.name,
      logoUrl: booking.tenant.logoUrl,
      primaryColor: primary,
      replyToEmail: settings.replyToEmail ?? booking.tenant.email,
      footerText: settings.footerText,
      body,
    }),
  });
}

export async function sendCheckoutEmail(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      room: true,
      payments: { where: { status: 'PAID' } },
      invoice: { include: { items: true } },
      tenant: { select: { name: true, email: true, currency: true, logoUrl: true, brandPrimaryColor: true, taxRate: true } },
    },
  });
  if (!booking) return;

  const settings = await getEmailSettings(booking.tenantId);
  if (!settings.sendCheckoutInvoice) return;

  // Claim the send before doing it, not after. Stamping invoiceSentAt only on
  // success left nothing to stop a second call — a retry, or a future queue —
  // from emailing the guest their invoice twice. updateMany filtered on
  // invoiceSentAt = null makes the claim atomic: a concurrent caller matches
  // zero rows and stops here.
  const claimed = await prisma.booking.updateMany({
    where: { id: bookingId, invoiceSentAt: null },
    data: { invoiceSentAt: new Date() },
  });
  if (claimed.count === 0) return; // already sent, or being sent right now

  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const primary = booking.tenant.brandPrimaryColor ?? '#1a6b5e';
  const cur = booking.tenant.currency;

  // The guest is sent the document of record, not a fresh calculation.
  //
  // Check-out freezes an invoice; re-deriving the numbers here is how this
  // email came to disagree with everything else — it priced the room from
  // room.basePrice, so a stay charged 13,500 under a rate plan was invoiced
  // to the guest at 9,000. Falling back to bill() covers a stay that has no
  // finalised invoice yet (a manual send before check-out).
  const finalised = booking.invoice?.finalizedAt ? booking.invoice : null;
  let roomTotal: number, foodTotal: number, extrasTotal: number;
  let subtotal: number, taxRate: number, taxAmount: number, grandTotal: number, paidAmount: number;

  if (finalised) {
    // Grouped by category rather than sourceType, so invoices written before
    // provenance existed still split into the right rows.
    const sumOf = (pred: (c: string) => boolean) =>
      finalised.items.filter((i) => pred(i.category)).reduce((s, i) => s + i.total, 0);
    roomTotal   = sumOf((c) => c === 'ROOM');
    foodTotal   = sumOf((c) => c === 'FOOD');
    extrasTotal = sumOf((c) => c !== 'ROOM' && c !== 'FOOD');
    subtotal    = finalised.subtotal;
    taxRate     = finalised.taxRate;
    taxAmount   = finalised.taxAmount;
    grandTotal  = finalised.total;
    paidAmount  = finalised.paidAmount;
  } else {
    const b = await bill(booking.tenantId, booking.id);
    roomTotal   = b.roomTotal;
    foodTotal   = b.foodTotal;
    extrasTotal = b.extrasTotal + b.packagesTotal;
    subtotal    = b.subtotal;
    taxRate     = b.taxRate;
    taxAmount   = b.taxAmount;
    grandTotal  = b.grandTotal;
    paidAmount  = b.paidAmount;
  }
  const balanceDue = grandTotal - paidAmount;

  // Prefer the invoice's own number: `INV-${confirmationNo}` was a second,
  // incompatible numbering scheme, so one stay could carry two invoice numbers.
  const invoiceNumber = booking.invoice?.invoiceNumber ?? booking.invoiceNumber ?? `INV-${booking.confirmationNo}`;

  const invoiceRows = [
    `<tr style="background:#f8fafa"><td style="padding:8px 16px;font-size:13px">Room: ${booking.room.name} (${nights}n)</td><td style="padding:8px 16px;text-align:right;font-size:13px">${fmt(roomTotal, cur)}</td></tr>`,
    foodTotal > 0 ? `<tr><td style="padding:8px 16px;font-size:13px;color:#555">Food & Beverage</td><td style="padding:8px 16px;text-align:right;font-size:13px">${fmt(foodTotal, cur)}</td></tr>` : '',
    extrasTotal > 0 ? `<tr style="background:#f8fafa"><td style="padding:8px 16px;font-size:13px;color:#555">Additional Charges</td><td style="padding:8px 16px;text-align:right;font-size:13px">${fmt(extrasTotal, cur)}</td></tr>` : '',
    taxRate > 0 ? `<tr><td style="padding:8px 16px;font-size:13px;color:#888">Tax (${taxRate}%)</td><td style="padding:8px 16px;text-align:right;font-size:13px;color:#888">${fmt(taxAmount, cur)}</td></tr>` : '',
    `<tr style="background:${primary}"><td style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff">Total</td><td style="padding:10px 16px;text-align:right;font-size:14px;font-weight:700;color:#fff">${fmt(grandTotal, cur)}</td></tr>`,
    `<tr><td style="padding:8px 16px;font-size:13px;color:#10b981">Amount Paid</td><td style="padding:8px 16px;text-align:right;font-size:13px;color:#10b981">− ${fmt(paidAmount, cur)}</td></tr>`,
    `<tr style="background:${balanceDue > 0 ? '#fff5f5' : '#f0faf8'}"><td style="padding:10px 16px;font-size:14px;font-weight:700;color:${balanceDue > 0 ? '#ef4444' : '#10b981'}">Balance Due</td><td style="padding:10px 16px;text-align:right;font-size:14px;font-weight:700;color:${balanceDue > 0 ? '#ef4444' : '#10b981'}">${fmt(Math.max(0, balanceDue), cur)}</td></tr>`,
  ].filter(Boolean).join('');

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 4px">Thank you for staying with us! 🙏</h2>
    <p style="color:#555;margin:0 0 8px">Hi ${booking.guest.firstName}, we hope you enjoyed your stay at <strong>${booking.tenant.name}</strong>.</p>
    <p style="color:#888;font-size:13px;margin:0 0 20px">Invoice #${invoiceNumber} · Confirmation: ${booking.confirmationNo}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8edf0;border-radius:8px;overflow:hidden;margin-bottom:24px">
      ${invoiceRows}
    </table>

    ${balanceDue > 0.01 ? `
    <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="margin:0;color:#dc2626;font-size:14px;font-weight:600">⚠️ Outstanding balance: ${fmt(balanceDue, cur)}</p>
      <p style="margin:6px 0 0;color:#555;font-size:13px">Please settle this at your earliest convenience. Contact us if you have any questions.</p>
    </div>` : `
    <div style="background:#f0faf8;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin-bottom:20px">
      <p style="margin:0;color:#059669;font-size:14px;font-weight:600">✅ Fully paid — no balance due</p>
    </div>`}

    <p style="color:#555;font-size:14px">We'd love to have you back! We hope to welcome you again at ${booking.tenant.name}.</p>
  `;

  try {
    await sendEmail({
      to: booking.guest.email,
      subject: `Thank you for your stay — Invoice ${invoiceNumber}`,
      html: wrapGuest({
        tenantName: booking.tenant.name,
        logoUrl: booking.tenant.logoUrl,
        primaryColor: primary,
        replyToEmail: settings.replyToEmail ?? booking.tenant.email,
        footerText: settings.footerText,
        body,
      }),
    });
  } catch (err) {
    // Release the claim so the invoice can be sent later. This deliberately
    // re-opens the small duplicate-send window: a guest receiving their
    // invoice twice is an annoyance, never receiving it is a guest who does
    // not know what they owe.
    await prisma.booking.updateMany({ where: { id: bookingId }, data: { invoiceSentAt: null } }).catch(() => {});
    throw err;
  }

  // updateMany (not update) so a booking deleted while this fire-and-forget
  // job was running is a silent 0-row no-op rather than a thrown P2025.
  await prisma.booking.updateMany({
    where: { id: bookingId },
    data: { invoiceNumber },
  });
}

export async function sendCancellationEmail(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      room: true,
      tenant: { select: { name: true, email: true, currency: true, logoUrl: true, brandPrimaryColor: true } },
    },
  });
  if (!booking) return;

  const settings = await getEmailSettings(booking.tenantId);
  if (!settings.sendCancellation) return;

  const nights = calculateNights(booking.checkIn, booking.checkOut);
  const primary = booking.tenant.brandPrimaryColor ?? '#1a6b5e';

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 4px">Booking Cancelled</h2>
    <p style="color:#555;margin:0 0 20px">Hi ${booking.guest.firstName}, your booking at <strong>${booking.tenant.name}</strong> has been cancelled.</p>
    ${bookingTable({
      room: `${booking.room.name} (#${booking.room.number})`,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights,
      adults: booking.adults,
      children: booking.children,
      totalAmount: Number(booking.totalAmount),
      currency: booking.tenant.currency,
      confirmationNo: booking.confirmationNo,
      primaryColor: primary,
    })}
    <p style="color:#555;font-size:14px">If you believe this is an error or would like to rebook, please contact us${booking.tenant.email ? ` at <a href="mailto:${booking.tenant.email}" style="color:${primary}">${booking.tenant.email}</a>` : ''}.</p>
  `;

  await sendEmail({
    to: booking.guest.email,
    subject: `Booking Cancelled — ${booking.tenant.name}`,
    html: wrapGuest({
      tenantName: booking.tenant.name,
      logoUrl: booking.tenant.logoUrl,
      primaryColor: primary,
      replyToEmail: settings.replyToEmail ?? booking.tenant.email,
      footerText: settings.footerText,
      body,
    }),
  });
}

export async function sendWebBookingEmails(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      guest: true,
      room: true,
      tenant: { select: { name: true, email: true, phone: true, currency: true, logoUrl: true, brandPrimaryColor: true, checkInTime: true, checkOutTime: true } },
    },
  });
  if (!booking) return;

  const settings = await getEmailSettings(booking.tenantId);
  const primary = booking.tenant.brandPrimaryColor ?? '#1a6b5e';
  const nights = calculateNights(booking.checkIn, booking.checkOut);

  // ── 1. Guest confirmation email ───────────────────────────────────────────
  if (settings.sendConfirmation) {
    const guestBody = `
      <h2 style="color:#1a1a1a;margin:0 0 4px">Booking Request Received! ✅</h2>
      <p style="color:#555;margin:0 0 20px">Hi ${booking.guest.firstName}, we've received your booking request at <strong>${booking.tenant.name}</strong>. The resort team will review and confirm your reservation shortly.</p>
      ${bookingTable({
        room: `${booking.room.name} (#${booking.room.number})`,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        adults: booking.adults,
        children: booking.children,
        totalAmount: Number(booking.totalAmount),
        currency: booking.tenant.currency,
        confirmationNo: booking.confirmationNo,
        primaryColor: primary,
      })}
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin:20px 0">
        <p style="margin:0;color:#92400e;font-size:14px"><strong>⏳ Status: Pending Confirmation</strong></p>
        <p style="margin:6px 0 0;color:#78350f;font-size:13px">You will receive another email once the resort confirms your reservation.</p>
      </div>
      <p style="color:#555;font-size:14px">If you have any questions, contact us${booking.tenant.email ? ` at <a href="mailto:${booking.tenant.email}" style="color:${primary}">${booking.tenant.email}</a>` : ''}${booking.tenant.phone ? ` or call ${booking.tenant.phone}` : ''}.</p>
    `;
    await sendEmail({
      to: booking.guest.email,
      subject: `Booking Request Received — ${booking.tenant.name} (${booking.confirmationNo})`,
      html: wrapGuest({
        tenantName: booking.tenant.name,
        logoUrl: booking.tenant.logoUrl,
        primaryColor: primary,
        replyToEmail: settings.replyToEmail ?? booking.tenant.email,
        footerText: settings.footerText,
        body: guestBody,
      }),
    });
  }

  // ── 2. Owner notification email ───────────────────────────────────────────
  if (booking.tenant.email) {
    const ownerBody = `
      <h2 style="color:#1a1a1a;margin:0 0 4px">New Booking Request 🔔</h2>
      <p style="color:#555;margin:0 0 20px">A new booking inquiry has been submitted via your resort website.</p>
      ${bookingTable({
        room: `${booking.room.name} (#${booking.room.number})`,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        adults: booking.adults,
        children: booking.children,
        totalAmount: Number(booking.totalAmount),
        currency: booking.tenant.currency,
        confirmationNo: booking.confirmationNo,
        primaryColor: primary,
      })}
      <div style="background:#f0faf8;border-left:4px solid ${primary};border-radius:4px;padding:16px;margin:20px 0">
        <p style="margin:0;color:#1a1a1a;font-size:14px;font-weight:600">Guest Details</p>
        <p style="margin:6px 0 0;color:#555;font-size:13px">Name: ${booking.guest.firstName} ${booking.guest.lastName}</p>
        <p style="margin:4px 0 0;color:#555;font-size:13px">Email: <a href="mailto:${booking.guest.email}" style="color:${primary}">${booking.guest.email}</a></p>
        ${booking.guest.phone ? `<p style="margin:4px 0 0;color:#555;font-size:13px">Phone: ${booking.guest.phone}</p>` : ''}
        ${booking.specialRequests ? `<p style="margin:4px 0 0;color:#555;font-size:13px">Special Requests: ${booking.specialRequests}</p>` : ''}
      </div>
      <p style="color:#555;font-size:14px">Log in to your dashboard to confirm or manage this booking.</p>
    `;
    await sendEmail({
      to: booking.tenant.email,
      subject: `New Booking Request — ${booking.guest.firstName} ${booking.guest.lastName} (${booking.confirmationNo})`,
      html: wrapGuest({
        tenantName: booking.tenant.name,
        logoUrl: booking.tenant.logoUrl,
        primaryColor: primary,
        replyToEmail: booking.guest.email,
        body: ownerBody,
      }),
    });
  }
}

export async function sendTestEmail(tenantId: string, toEmail: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, email: true, logoUrl: true, brandPrimaryColor: true },
  });
  if (!tenant) return;

  const settings = await getEmailSettings(tenantId);
  const primary = tenant.brandPrimaryColor ?? '#1a6b5e';

  const body = `
    <h2 style="color:#1a1a1a;margin:0 0 4px">Test Email ✅</h2>
    <p style="color:#555;margin:0 0 16px">This is a test email from <strong>${tenant.name}</strong>. Your email settings are configured correctly.</p>
    <div style="background:#f0faf8;border-left:4px solid ${primary};border-radius:4px;padding:16px">
      <p style="margin:0;font-size:13px;color:#555"><strong>Active toggles:</strong></p>
      <ul style="margin:8px 0 0;padding-left:20px;color:#555;font-size:13px">
        <li>Booking Confirmation: ${settings.sendConfirmation ? '✅ On' : '❌ Off'}</li>
        <li>Pre-Arrival Reminder: ${settings.sendPreArrival ? '✅ On' : '❌ Off'}</li>
        <li>Checkout Invoice: ${settings.sendCheckoutInvoice ? '✅ On' : '❌ Off'}</li>
        <li>Cancellation Notice: ${settings.sendCancellation ? '✅ On' : '❌ Off'}</li>
      </ul>
    </div>
  `;

  await sendEmail({
    to: toEmail,
    subject: `Test Email — ${tenant.name}`,
    html: wrapGuest({
      tenantName: tenant.name,
      logoUrl: tenant.logoUrl,
      primaryColor: primary,
      replyToEmail: settings.replyToEmail ?? tenant.email,
      footerText: settings.footerText,
      body,
    }),
  });
}
