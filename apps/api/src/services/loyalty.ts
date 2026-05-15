import { prisma } from '@resort-pro/database';

// ── Tier calculation ──────────────────────────────────────────────────────────
export function calcTier(
  lifetimePoints: number,
  prog: { bronzeThreshold: number; silverThreshold: number; goldThreshold: number; platinumThreshold: number },
) {
  if (lifetimePoints >= prog.platinumThreshold) return 'PLATINUM';
  if (lifetimePoints >= prog.goldThreshold) return 'GOLD';
  if (lifetimePoints >= prog.silverThreshold) return 'SILVER';
  return 'BRONZE';
}

// ── Get or create a loyalty account for a guest ───────────────────────────────
export async function getOrCreateAccount(tenantId: string, guestId: string) {
  return prisma.loyaltyAccount.upsert({
    where: { guestId },
    update: {},
    create: { tenantId, guestId, points: 0, lifetimePoints: 0, tier: 'BRONZE' },
    include: { guest: { select: { firstName: true, lastName: true, email: true } } },
  });
}

// ── Award points (earn) ───────────────────────────────────────────────────────
export async function awardPoints(
  tenantId: string,
  guestId: string,
  points: number,
  description: string,
  bookingId?: string,
) {
  if (points <= 0) return null;

  const prog = await prisma.loyaltyProgram.findUnique({ where: { tenantId } });

  const account = await getOrCreateAccount(tenantId, guestId);
  const newLifetime = account.lifetimePoints + points;
  const newBalance = account.points + points;
  const newTier = prog
    ? (calcTier(newLifetime, prog) as any)
    : account.tier;

  const [updated] = await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: newBalance, lifetimePoints: newLifetime, tier: newTier },
    }),
    prisma.loyaltyTransaction.create({
      data: { tenantId, accountId: account.id, type: 'EARN', points, description, bookingId },
    }),
  ]);

  return updated;
}

// ── Redeem points ─────────────────────────────────────────────────────────────
export async function redeemPoints(
  tenantId: string,
  guestId: string,
  points: number,
  description: string,
  bookingId?: string,
) {
  const account = await prisma.loyaltyAccount.findUnique({ where: { guestId } });
  if (!account) throw new Error('No loyalty account found');
  if (account.points < points) throw new Error('Insufficient points');

  await prisma.$transaction([
    prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { points: { decrement: points } },
    }),
    prisma.loyaltyTransaction.create({
      data: { tenantId, accountId: account.id, type: 'REDEEM', points: -points, description, bookingId },
    }),
  ]);

  const prog = await prisma.loyaltyProgram.findUnique({ where: { tenantId } });
  const discountAmount = prog ? points / prog.redemptionRate : 0;
  return { pointsRedeemed: points, discountAmount };
}

// ── Auto-award on checkout ────────────────────────────────────────────────────
export async function awardCheckoutPoints(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guest: true },
  });
  if (!booking || booking.loyaltyPointsAwarded) return;

  const prog = await prisma.loyaltyProgram.findUnique({ where: { tenantId: booking.tenantId } });
  if (!prog?.isEnabled) return;

  const nights = Math.max(
    1,
    Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000),
  );
  const points = Math.floor(Number(booking.totalAmount) * prog.pointsPerDollar);
  if (points <= 0) return;

  await awardPoints(
    booking.tenantId,
    booking.guestId,
    points,
    `Stay: ${booking.room ? '' : ''}${nights} night${nights !== 1 ? 's' : ''} · Booking ${booking.confirmationNo}`,
    bookingId,
  );

  await prisma.booking.update({
    where: { id: bookingId },
    data: { loyaltyPointsAwarded: true },
  });
}
