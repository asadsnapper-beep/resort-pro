import { test, expect } from '@playwright/test';
import { loginAsRole, ensureNavOpen, navItem } from './helpers';

// Used to hand-roll a localStorage auth mock (a fake `resort-pro-auth`
// entry injected via addInitScript) instead of actually logging in. That
// mock drifted out of sync with the real app twice over: the mocked
// session was rejected outright (the app redirected to /auth/login instead
// of showing the dashboard, so the assertions below were silently checking
// the login page — see project-integration-test-results.md), and even if it
// hadn't been, it asserted a retired nav label ("Rooms & Villas") that no
// longer exists (current label is just "Rooms"). Switched to the same real
// demo-role login helper roles.spec.ts already uses — see helpers.ts.

test.describe('Dashboard', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8000 });
  });
});

test.describe('Dashboard (authenticated via demo)', () => {
  test('sidebar shows core navigation items', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await ensureNavOpen(page);
    // Daily tier — always rendered on desktop (and always in the flattened
    // mobile sheet), no group expand needed. "Guests" and everything else
    // lives inside a collapsible group instead (confirmed by running this:
    // asserting it here without expanding its group failed) — role-by-role
    // coverage of the grouped/collapsible items lives in roles.spec.ts.
    await expect(await navItem(page, 'Rooms')).toBeVisible({ timeout: 8000 });
    await expect(await navItem(page, 'Bookings')).toBeVisible();
  });

  test('rooms page accessible from sidebar', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await ensureNavOpen(page);
    await (await navItem(page, 'Rooms')).click();
    await expect(page).toHaveURL('/dashboard/rooms');
  });
});
