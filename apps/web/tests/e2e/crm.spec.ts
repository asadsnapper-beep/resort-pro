import { test, expect } from '@playwright/test';
import { useRole } from './helpers';

/**
 * How long a tab's own fetch is given.
 *
 * Each tab draws a "Loading <thing>…" placeholder while it fetches, and the
 * first version of this file waited for that placeholder to disappear. That
 * is the wrong signal: straight after a navigation the placeholder has not
 * mounted yet, so the wait saw a count of zero and returned at once, leaving
 * the assertion behind it racing the fetch on Playwright's default five
 * seconds. It passed locally and failed on CI's first attempt — CI's two
 * retries then hid it, which is worse than a plain red.
 *
 * Waiting for the expected element itself is the signal that cannot race:
 * absent, the test still fails, just after a bound long enough for a cold
 * WebKit on a shared runner rather than one tuned to a fast laptop.
 */
const FETCHED = { timeout: 30_000 };

/**
 * The CRM had no E2E coverage at all (CRM QA 2026-10-07, finding 014). Ten API
 * integration suites guard the routes, but every browser check was an ad-hoc
 * script run by hand and thrown away, so nothing in CI could tell that the
 * page had stopped rendering — which is how three tabs came to be returning
 * 500s without a failing build.
 *
 * These run against the seeded demo tenant, which is PROFESSIONAL and so has
 * the `crm_v2` entitlement the nav and the API both gate on.
 *
 * `useRole` gives the whole block one login rather than one per test; the
 * reason that matters is written out where it lives, in helpers.ts.
 */
test.describe('CRM', () => {
  const shared = useRole('OWNER');

  test('the page loads with all six tabs', async () => {
    const page = shared.page;
    await page.goto('/dashboard/crm');
    await expect(page.getByText('CRM & Email Marketing')).toBeVisible(FETCHED);
    for (const tab of ['Contacts', 'Tags', 'Campaigns', 'Sequences', 'Templates', 'Analytics']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('contacts load, and each one says where it stands on consent', async () => {
    const page = shared.page;
    await page.goto('/dashboard/crm');
    // A guest with no consent row used to be drawn as subscribed, which is a
    // claim about a person's permission the data did not support (finding
    // 004). Both labels are acceptable here; silence is not.
    //
    // `\s*` either side because the cell renders an icon then the word, so its
    // text is " Subscribed" — and unlike a string, a regex passed to getByText
    // is matched without the whitespace being normalised away. Same reason
    // helpers.ts carries its own `exact()`.
    const consent = page.getByText(/^\s*(Subscribed|Unsubscribed)\s*$/);
    await expect(consent.first()).toBeVisible(FETCHED);
  });

  test('a campaign is listed for each state it can be in', async () => {
    const page = shared.page;
    await page.goto('/dashboard/crm');
    await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
    // The three the demo seed creates — sent, scheduled and draft. The tab was
    // empty before them, which read as a feature that did not exist.
    await expect(page.getByText('Monsoon Weekend Getaway')).toBeVisible(FETCHED);
    await expect(page.getByText('Eid Package — Early Access')).toBeVisible();
    await expect(page.getByText('Winter Season Preview')).toBeVisible();
  });

  test('sequences list, including one that is paused rather than deleted', async () => {
    const page = shared.page;
    await page.goto('/dashboard/crm');
    await page.getByRole('button', { name: 'Sequences', exact: true }).click();
    await expect(page.getByText('Pre-arrival welcome')).toBeVisible(FETCHED);
    await expect(page.getByText('Win back a quiet guest')).toBeVisible();
  });

  /**
   * The one that matters most, and the only one here that is a guard rather
   * than a smoke test.
   *
   * Nothing in the API records an open or a click — no pixel, no redirect, no
   * provider webhook — yet this page used to show an Open Rate and a Click
   * Rate computed from those empty columns, and the demo seeded 87 opens on
   * 142 sends to fill them in. A resort owner could have made decisions on it.
   * If either rate comes back before something populates it, this fails.
   */
  test('analytics shows no open or click rate, because nothing records one', async () => {
    const page = shared.page;
    await page.goto('/dashboard/crm');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByText('Sent (last 5 campaigns)')).toBeVisible(FETCHED);
    await expect(page.getByText(/open rate|click rate/i)).toHaveCount(0);
  });

  test('a contact opens its detail sheet', async () => {
    const page = shared.page;
    await page.goto('/dashboard/crm');
    // The name is the control, not the row: the row also carries a recalc
    // button. `GET /crm/contacts/:id` existed with no screen calling it
    // (finding 016) — this is the screen.
    const firstContact = page.locator('table button.hover\\:underline').first();
    await expect(firstContact).toBeVisible(FETCHED);
    await firstContact.click();
    await expect(page.getByText('Sequences', { exact: true }).last()).toBeVisible(FETCHED);
  });
});
