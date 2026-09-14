/**
 * Monthly rollover of SMS/WhatsApp usage — see services/messaging-quota.ts.
 *
 * Runs once when the worker starts and then daily. The query only touches
 * tenants not yet reset this month, so repeating it is harmless, and a worker
 * that was down on the 1st still rolls everyone over when it comes back.
 */
import cron from 'node-cron';
import { resetMonthlyMessagingUsage } from '../services/messaging-quota';

async function run() {
  try {
    const n = await resetMonthlyMessagingUsage();
    if (n > 0) console.log(`[messaging-usage] rolled ${n} tenant(s) over to a new month`);
  } catch (e) {
    console.error('[messaging-usage] reset failed', e);
  }
}

export function startMessagingUsageResetCron() {
  void run();
  cron.schedule('10 0 * * *', () => { void run(); });
  console.log('[messaging-usage] Cron started — daily at 00:10, and once now');
}
