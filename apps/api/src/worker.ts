/**
 * ResortPro Background Worker
 *
 * Runs cron jobs and background automation in a separate process from the
 * HTTP server. Start alongside the API:
 *   Production:  node dist/worker.js
 *   Development: tsx src/worker.ts
 *
 * Jobs:
 *  - Pre-arrival reminder     — daily 9:00 AM
 *  - iCal sync                — every 15 min
 *  - Daily report dispatch    — every minute (checks tenant dispatchTime)
 *  - Automation engine        — every 15 min (email sequences)
 *  - Trial lifecycle emails   — every 12 hours
 */

import { startPreArrivalCron } from './jobs/pre-arrival-reminder';
import { startICalSyncCron } from './jobs/ical-sync';
import { startReportDispatchJob } from './jobs/daily-report-dispatch';
import { startAutomationEngine } from './services/automation';
import { runTrialEmailCron } from './services/trial-emails';

async function main() {
  console.log('[worker] Starting ResortPro background worker...');

  startPreArrivalCron();
  startICalSyncCron();
  startReportDispatchJob();
  startAutomationEngine();

  // Trial emails: run once on startup, then every 12 hours
  runTrialEmailCron().catch((e) => console.error('[worker] trial-cron startup error:', e));
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;
  setInterval(() => {
    runTrialEmailCron().catch((e) => console.error('[worker] trial-cron error:', e));
  }, TWELVE_HOURS);

  console.log('[worker] All jobs scheduled. Worker is running.');
}

main().catch((e) => {
  console.error('[worker] Fatal startup error:', e);
  process.exit(1);
});
