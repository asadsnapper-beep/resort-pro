import { randomBytes } from 'crypto';

// How long a PENDING booking (created only by the public /site/:slug/book
// endpoint, while a guest is completing payment) is allowed to hold a room
// before it's treated as abandoned. Shared by the public availability check
// (website.ts) and the expire-pending-bookings background job, so the two
// never drift apart.
export const PENDING_HOLD_MINUTES = 30;

export function generateConfirmationNo(): string {
  const prefix = 'RP';
  const random = randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${timestamp}-${random}`;
}

export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diff = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
