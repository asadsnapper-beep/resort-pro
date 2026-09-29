import { test, expect, type Page } from '@playwright/test';

/**
 * The landing page as a visitor meets it.
 *
 * Every assertion in here used to describe a page that no longer existed — a
 * hero reading "Let your resort feel effortless.", a "Build your workspace"
 * button going to /plans, four feature headings starting "The morning view".
 * The copy was rewritten and the tests were not, so four of them failed in both
 * browser projects and had been failing long enough that a red landing suite
 * meant nothing (release-readiness review M-07). A test nobody believes is
 * worse than no test.
 *
 * Rewritten against the page that is actually served, and split by how durable
 * each thing is:
 *
 *   - Where a visitor *ends up* is the contract, so the journeys assert the
 *     destination and let the wording on the button be whatever marketing
 *     wants this month.
 *   - The hero sentence is the product's promise, so it is asserted exactly.
 *     If someone rewrites it this should go red and a person should look. That
 *     is the point, not an accident — update the string with the new copy.
 *
 * It runs under both projects, and on a phone the header collapses to a toggle,
 * so the journeys open it first. That is not a workaround: on a phone, opening
 * that menu *is* how a visitor reaches the trial, and it was never covered.
 */

const HERO = 'Run your resort without the daily confusion.';

/** On a narrow viewport the nav links live behind "Toggle menu". */
async function openNavIfCollapsed(page: Page) {
  const toggle = page.getByRole('button', { name: /toggle menu/i });
  if (await toggle.isVisible()) await toggle.click();
}

test.describe('Landing Page', () => {
  test('greets a visitor with the hero and a way in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ResortPro/);
    await expect(page.getByRole('heading', { name: HERO, level: 1 })).toBeVisible();
    // Somewhere on the page, without opening anything, there is a way to start.
    await expect(page.locator('a[href="/try"]:visible').first()).toBeVisible();
  });

  test('offers the sections its own menu points at', async ({ page }) => {
    await page.goto('/');
    for (const anchor of ['how', 'features', 'pricing']) {
      await expect(page.locator(`#${anchor}`)).toHaveCount(1);
    }
  });

  test('the main call to action leads to the trial', async ({ page }) => {
    await page.goto('/');
    await openNavIfCollapsed(page);
    await page.locator('header').getByRole('link', { name: /Try ResortPro/ }).click();
    await expect(page).toHaveURL(/\/try$/);
  });

  test('signing in leads to the login page', async ({ page }) => {
    await page.goto('/');
    await openNavIfCollapsed(page);
    await page.locator('header').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('offers Bangla rather than imposing it', async ({ page }) => {
    // The one piece of copy that is a rule and not a preference: an unasked
    // visitor gets English, and Bangla is a link they can choose.
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(HERO);
    await openNavIfCollapsed(page);
    // The header carries a desktop and a phone copy of the nav; exactly one of
    // them is on screen, so match on that rather than on either markup.
    await expect(page.locator('header a[href="/bn"]:visible')).toHaveCount(1);
  });
});
