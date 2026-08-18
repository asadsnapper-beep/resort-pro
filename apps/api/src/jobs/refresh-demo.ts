/**
 * Daily rebuild of the demo tenant.
 *
 * Every date in the demo is relative to the day it was seeded, so it decays:
 * arrivals drift into the past, today's board empties out, and inside a month a
 * prospective customer taking the tour is shown a dead resort. Rebuilding it
 * each night keeps "today" actually today.
 *
 * Opt-in per environment via SEED_DEMO_REFRESH=1, and deliberately not set on
 * production: a refresh *deletes* the demo tenant before recreating it, and
 * production's still holds invoice rows we have not migrated. Staging's demo is
 * disposable, so that is where this belongs.
 *
 * It runs in the API process rather than worker.ts because no worker service is
 * deployed — see docker-compose.staging.yml, which has only postgres, redis,
 * api and web.
 */

import cron from 'node-cron';
import { seedDemo } from '../scripts/seed-demo';

/** 02:00 in Dhaka — the quietest hour, and safely clear of any midnight rollover. */
const SCHEDULE = '0 2 * * *';
const TIMEZONE = 'Asia/Dhaka';

export function startDemoRefreshCron() {
  if (process.env.SEED_DEMO_REFRESH !== '1') return;

  cron.schedule(SCHEDULE, async () => {
    try {
      console.log('[demo-refresh] rebuilding demo tenant…');
      await seedDemo({ refresh: true });
      console.log('[demo-refresh] done');
    } catch (e) {
      // Never rethrow: a failed demo refresh must not be able to stop the API.
      console.error('[demo-refresh] failed:', e);
    }
  }, { timezone: TIMEZONE });

  console.log(`[demo-refresh] scheduled ${SCHEDULE} ${TIMEZONE}`);
}
