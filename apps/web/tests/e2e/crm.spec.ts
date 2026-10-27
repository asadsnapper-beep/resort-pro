import { test, expect, type Page } from '@playwright/test';
import { loginAsRole } from './helpers';

/**
 * Every tab draws a "Loading <thing>…" placeholder until its own fetch
 * settles, so an assertion fired straight after the click was racing it.
 * Alone the race was always won; with the other specs running beside it on
 * four workers, WebKit lost it often enough to fail a run while the page was
 * working perfectly. Waiting for the placeholder to go is the condition that
 * actually matters — raising every timeout instead would have bought the same
 * green and hidden a genuine hang just as well.
 */
async function waitForTab(page: Page, thing: string) {
  await expect(page.getByText(new RegExp(`Loading ${thing}`))).toHaveCount(0, { timeout: 30000 });
}

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
 * One login serves the whole file rather than one per test. `loginAsRole` walks /try, the role picker and the dashboard shell, and that
 * shell fires a dozen requests of its own. Twelve of those (six tests on two
 * projects) pushed the run past the API's 300/min global rate limit: a full
 * local run served 770 throttled responses, and even at CI's single worker it
 * still served 147. The suite passed, but only because the 429s happened to
 * land on dashboard widgets rather than on `/api/crm/campaigns` — a gate that
 * green by luck is the kind that gets excluded later for rotting, which is
 * exactly what happened to landing.spec.ts.
 *
 * The context is built from `testInfo.project.use` because a context made by
 * hand does not inherit the project's device emulation, and the Mobile Safari
 * run is half the point of having this file.
 */
test.describe.configure({ mode: 'serial' });

test.describe('CRM', () => {
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext(testInfo.project.use as Parameters<typeof browser.newContext>[0]);
    page = await context.newPage();
    await loginAsRole(page, 'OWNER');
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('the page loads with all six tabs', async () => {
    await page.goto('/dashboard/crm');
    await expect(page.getByText('CRM & Email Marketing')).toBeVisible({ timeout: 10000 });
    for (const tab of ['Contacts', 'Tags', 'Campaigns', 'Sequences', 'Templates', 'Analytics']) {
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
  });

  test('contacts load, and each one says where it stands on consent', async () => {
    await page.goto('/dashboard/crm');
    // A guest with no consent row used to be drawn as subscribed, which is a
    // claim about a person's permission the data did not support (finding
    // 004). Both labels are acceptable here; silence is not.
    //
    // `\s*` either side because the cell renders an icon then the word, so its
    // text is " Subscribed" — and unlike a string, a regex passed to getByText
    // is matched without the whitespace being normalised away. Same reason
    // helpers.ts carries its own `exact()`.
    await waitForTab(page, 'contacts');
    const consent = page.getByText(/^\s*(Subscribed|Unsubscribed)\s*$/);
    await expect(consent.first()).toBeVisible();
  });

  test('a campaign is listed for each state it can be in', async () => {
    await page.goto('/dashboard/crm');
    await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
    await waitForTab(page, 'campaigns');
    // The three the demo seed creates — sent, scheduled and draft. The tab was
    // empty before them, which read as a feature that did not exist.
    await expect(page.getByText('Monsoon Weekend Getaway')).toBeVisible();
    await expect(page.getByText('Eid Package — Early Access')).toBeVisible();
    await expect(page.getByText('Winter Season Preview')).toBeVisible();
  });

  test('sequences list, including one that is paused rather than deleted', async () => {
    await page.goto('/dashboard/crm');
    await page.getByRole('button', { name: 'Sequences', exact: true }).click();
    await waitForTab(page, 'sequences');
    await expect(page.getByText('Pre-arrival welcome')).toBeVisible();
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
    await page.goto('/dashboard/crm');
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await waitForTab(page, 'analytics');
    await expect(page.getByText('Sent (last 5 campaigns)')).toBeVisible();
    await expect(page.getByText(/open rate|click rate/i)).toHaveCount(0);
  });

  test('a contact opens its detail sheet', async () => {
    await page.goto('/dashboard/crm');
    // The name is the control, not the row: the row also carries a recalc
    // button. `GET /crm/contacts/:id` existed with no screen calling it
    // (finding 016) — this is the screen.
    await waitForTab(page, 'contacts');
    const firstContact = page.locator('table button.hover\\:underline').first();
    await expect(firstContact).toBeVisible();
    await firstContact.click();
    await expect(page.getByText('Sequences', { exact: true }).last()).toBeVisible({ timeout: 8000 });
  });
});
