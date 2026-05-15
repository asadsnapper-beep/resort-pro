/**
 * Pre-arrival reminder cron job.
 * Runs daily at 9 AM — finds all CONFIRMED bookings with checkIn = tomorrow
 * and sends a reminder email to each guest (respecting tenant toggle).
 */
import cron from 'node-cron';
import { prisma } from '@resort-pro/database';
import { sendPreArrivalReminder } from '../utils/guest-emails';

export function startPreArrivalCron() {
  // Every day at 9:00 AM server time
  cron.schedule('0 9 * * *', async () => {
    console.log('[pre-arrival-cron] Running pre-arrival reminder job...');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);

      const bookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          checkIn: { gte: tomorrowStart, lte: tomorrowEnd },
        },
        select: { id: true, confirmationNo: true },
      });

      console.log(`[pre-arrival-cron] Found ${bookings.length} booking(s) checking in tomorrow`);

      for (const booking of bookings) {
        try {
          await sendPreArrivalReminder(booking.id);
          console.log(`[pre-arrival-cron] Sent reminder for booking ${booking.confirmationNo}`);
        } catch (err) {
          console.error(`[pre-arrival-cron] Failed for booking ${booking.confirmationNo}:`, err);
        }
      }
    } catch (err) {
      console.error('[pre-arrival-cron] Job error:', err);
    }
  });

  console.log('[pre-arrival-cron] Scheduled — runs daily at 9:00 AM');
}
