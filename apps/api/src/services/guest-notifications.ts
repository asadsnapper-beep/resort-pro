/**
 * Telling a guest by SMS or WhatsApp that their booking is confirmed.
 *
 * Settings has offered these switches — "Booking Confirmed", SMS and WhatsApp —
 * and stored them, and nothing ever read them (settings-deep-qa C-03). An owner
 * could tick them, save, and no guest would ever receive anything.
 *
 * Each channel goes out only when all of these hold:
 *   - the channel is switched on for the resort (smsEnabled / waEnabled)
 *   - the event is switched on for that channel (notifBookingConfirm /
 *     waNotifBookingConfirm)
 *   - the booking really is confirmed — a PENDING booking awaiting payment is
 *     not, and telling a guest otherwise is how a room gets promised twice
 *   - the guest has a phone number
 *
 * A GuestNotification row is claimed *before* sending, under a unique key on
 * booking + event + channel. One payment fires both a verify callback and a
 * webhook, and each calls this; the second finds the row and sends nothing, so
 * a guest is not messaged twice and ResortPro's allowance is not spent twice.
 *
 * Never throws. Every caller is fire-and-forget after the booking has already
 * been saved, and a messaging problem must not surface as a failed booking.
 */
import { prisma } from '@resort-pro/database';
import { sendCountedMessage, type Channel } from './messaging-quota';

const CONFIRMED = new Set(['CONFIRMED', 'CHECKED_IN']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A number the providers will accept. Guests are usually entered the way they
 * are said aloud — 01712345678 — and SSL Wireless and Twilio both need the
 * country code. Only Bangladesh's local format is rewritten, because it is the
 * only one that can be rewritten without guessing; anything else is passed on
 * for the provider to accept or refuse with its own reason.
 */
export function normalizePhone(raw: string, country: string | null | undefined): string {
  const compact = raw.replace(/[\s\-().]/g, '');
  if (compact.startsWith('+')) return compact;
  if (/^8801\d{9}$/.test(compact)) return `+${compact}`;
  if ((country ?? 'BD') === 'BD' && /^01\d{9}$/.test(compact)) return `+88${compact}`;
  return compact;
}

/**
 * The message itself. Short on purpose: Bangla is sent as Unicode, where one
 * SMS segment holds 70 characters rather than 160, and every extra segment is
 * billed. Dates are read from UTC because check-in is stored as a date with no
 * time, and a local conversion can move it to the previous day.
 */
export function bookingConfirmedText(
  language: string | null | undefined,
  b: { resortName: string; confirmationNo: string; checkIn: Date; checkOut: Date },
): string {
  const nights = Math.max(1, Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000));
  const day = b.checkIn.getUTCDate();
  const month = b.checkIn.getUTCMonth();

  if (language === 'bn') {
    const date = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${b.checkIn.getUTCFullYear()}`;
    return `${b.resortName}: বুকিং ${b.confirmationNo} নিশ্চিত। চেক-ইন ${date}, ${nights} রাত।`;
  }
  return `${b.resortName}: booking ${b.confirmationNo} confirmed. Check-in ${day} ${MONTHS[month]}, ${nights} night${nights === 1 ? '' : 's'}.`;
}

export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, tenantId: true, status: true, confirmationNo: true, checkIn: true, checkOut: true,
        guest: { select: { phone: true } },
        tenant: {
          select: {
            id: true, name: true, country: true, notifLanguage: true,
            smsEnabled: true, notifBookingConfirm: true,
            waEnabled: true, waNotifBookingConfirm: true,
            smsMode: true, smsProvider: true, smsApiKey: true, smsApiSecret: true, smsSenderId: true,
            waMode: true, waApiToken: true, waPhoneNumberId: true,
          },
        },
      },
    });
    if (!booking || !CONFIRMED.has(booking.status) || !booking.guest?.phone) return;

    const { tenant } = booking;
    const channels: Channel[] = [];
    if (tenant.smsEnabled && tenant.notifBookingConfirm) channels.push('sms');
    if (tenant.waEnabled && tenant.waNotifBookingConfirm) channels.push('whatsapp');
    if (channels.length === 0) return;

    const phone = normalizePhone(booking.guest.phone, tenant.country);
    const text = bookingConfirmedText(tenant.notifLanguage, {
      resortName: tenant.name,
      confirmationNo: booking.confirmationNo,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    });

    for (const channel of channels) {
      await sendOnce(booking.tenantId, booking.id, channel, () => sendCountedMessage(tenant, channel, phone, text));
    }
  } catch (e) {
    console.error('[guest-notifications] booking_confirmed failed', { bookingId, error: e });
  }
}

async function sendOnce(
  tenantId: string,
  bookingId: string,
  channel: Channel,
  send: () => ReturnType<typeof sendCountedMessage>,
) {
  const event = 'booking_confirmed';
  let rowId: string;
  try {
    const row = await prisma.guestNotification.create({
      data: { tenantId, bookingId, event, channel, status: 'sending' },
      select: { id: true },
    });
    rowId = row.id;
  } catch (e) {
    // Another trigger for the same booking already claimed this message.
    if ((e as { code?: string }).code === 'P2002') return;
    throw e;
  }

  const result = await send();
  await prisma.guestNotification.update({
    where: { id: rowId },
    data: result.delivered
      ? { status: 'sent', via: result.via, providerId: result.id ?? null }
      : { status: 'failed', via: result.via, detail: result.detail },
  });
}
