/**
 * Role-based UI tests
 * Each role logs in via demo and we assert what they can/can't see.
 *
 * Runs against two Playwright projects — "chromium" (desktop viewport) and
 * "Mobile Safari" (iPhone 14 viewport) — which render two ENTIRELY different
 * navigation UIs. See helpers.ts for the full explanation and the shared
 * login/nav helpers used throughout this file (also reused by
 * dashboard.spec.ts, which used to hand-roll a localStorage auth mock that
 * drifted out of sync with the app's real login flow).
 */
import { test, expect } from '@playwright/test';
import { loginAsRole, isDesktopNav, mobileSheet, ensureNavOpen, navItem, groupHeader, expandGroup, logout } from './helpers';

// ── OWNER ──────────────────────────────────────────────────────────────────────
test.describe('OWNER role', () => {
  test('sees full sidebar navigation', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await ensureNavOpen(page);
    // Daily tier — always rendered on desktop, no group expand needed.
    await expect(await navItem(page, 'Rooms')).toBeVisible({ timeout: 8000 });
    await expect(await navItem(page, 'Bookings')).toBeVisible();
    // Grouped tier — Inventory & F&B Orders live under the collapsed
    // "Restaurant" section (desktop only — already flattened on mobile).
    await expandGroup(page, 'Restaurant');
    await expect(await navItem(page, 'Inventory')).toBeVisible();
    await expect(await navItem(page, 'F&B Orders')).toBeVisible();
  });

  test('sees Monthly Revenue card on dashboard', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await page.goto('/dashboard');
    await expect(page.getByText('Monthly Revenue')).toBeVisible({ timeout: 8000 });
  });

  test('can access Roles & Team page', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    // /dashboard/roles is a server-redirect shim to /dashboard/staff — the
    // actual staff/team management page. Going straight there sidesteps a
    // redirect-timing quirk and tests the same access. Its heading copy is
    // "Add Staff" + a "Total Staff" stat card, not "Team Members" /
    // "Invite Member" (those never existed on the current page — stale
    // assertions from an earlier design).
    await page.goto('/dashboard/staff');
    await expect(page.getByText('Add Staff')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Total Staff')).toBeVisible();
  });
});

// ── SHAREHOLDER ────────────────────────────────────────────────────────────────
test.describe('SHAREHOLDER role', () => {
  test('sees only Dashboard and Analytics in sidebar', async ({ page }) => {
    await loginAsRole(page, 'SHAREHOLDER');
    await ensureNavOpen(page);
    await expect(await navItem(page, 'Dashboard')).toBeVisible({ timeout: 8000 });
    await expandGroup(page, 'Overview');
    await expect(await navItem(page, 'Analytics')).toBeVisible();
    // A SHAREHOLDER has zero visible items in every other section, so those
    // group headers never render at all — absence of the header (not old,
    // now-nonexistent item text like "Rooms & Villas") is the real signal.
    for (const group of ['Rooms & Bookings', 'Guests', 'Operations', 'Restaurant', 'Marketing', 'Account']) {
      await expect(await groupHeader(page, group)).not.toBeVisible();
    }
  });

  test('sees Monthly Revenue card on dashboard', async ({ page }) => {
    await loginAsRole(page, 'SHAREHOLDER');
    await page.goto('/dashboard');
    await expect(page.getByText('Monthly Revenue')).toBeVisible({ timeout: 8000 });
  });

  test('shows role badge "Shareholder" in sidebar', async ({ page }) => {
    await loginAsRole(page, 'SHAREHOLDER');
    await ensureNavOpen(page);
    // Desktop sidebar renders "Shareholder"; the mobile sheet's header
    // renders it lowercase ("shareholder") — match case-insensitively.
    // "Shareholder" also appears twice on desktop (tenant subtitle + user
    // footer badge) — .first() avoids a strict-mode multi-match failure.
    const container = (await isDesktopNav(page)) ? page.locator('aside') : mobileSheet(page);
    await expect(container.getByText(/shareholder/i).first()).toBeVisible({ timeout: 8000 });
  });
});

// ── RECEPTIONIST ───────────────────────────────────────────────────────────────
test.describe('RECEPTIONIST role', () => {
  test('sees Rooms, Bookings, Guests, Housekeeping, F&B Orders', async ({ page }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await ensureNavOpen(page);
    await expect(await navItem(page, 'Rooms')).toBeVisible({ timeout: 8000 });
    await expect(await navItem(page, 'Bookings')).toBeVisible();
    await expandGroup(page, 'Guests');
    await expect(await navItem(page, 'Guests')).toBeVisible();
    await expandGroup(page, 'Operations');
    await expect(await navItem(page, 'Housekeeping')).toBeVisible();
    await expandGroup(page, 'Restaurant');
    await expect(await navItem(page, 'F&B Orders')).toBeVisible();
  });

  test('does NOT see Monthly Revenue on dashboard', async ({ page }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Monthly Revenue')).not.toBeVisible();
  });

  test('does NOT see Inventory in sidebar', async ({ page }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await ensureNavOpen(page);
    // Inventory is filtered out of RECEPTIONIST's nav items entirely, so it
    // never renders regardless of the Restaurant group's collapse state.
    await expect(await navItem(page, 'Inventory')).not.toBeVisible();
  });
});

// ── STAFF ──────────────────────────────────────────────────────────────────────
test.describe('STAFF role', () => {
  test('sees only Housekeeping in sidebar', async ({ page }) => {
    await loginAsRole(page, 'STAFF');
    await ensureNavOpen(page);
    await expandGroup(page, 'Operations');
    await expect(await navItem(page, 'Housekeeping')).toBeVisible({ timeout: 8000 });
    // Should NOT see these — filtered out of visibleItems for STAFF entirely.
    await expect(await navItem(page, 'Rooms')).not.toBeVisible();
    await expect(await navItem(page, 'Bookings')).not.toBeVisible();
    await expect(await navItem(page, 'F&B Orders')).not.toBeVisible();
    await expect(await navItem(page, 'Inventory')).not.toBeVisible();
  });

  test('dashboard shows housekeeping banner, not stat cards', async ({ page }) => {
    await loginAsRole(page, 'STAFF');
    await page.goto('/dashboard');
    // STAFF gets a dedicated "Your Tasks" banner instead of the stat-card
    // dashboard (see app/(dashboard)/dashboard/page.tsx).
    await expect(page.getByText('Your Tasks')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Monthly Revenue')).not.toBeVisible();
    await expect(page.getByText('Total Bookings')).not.toBeVisible();
  });

  test('Housekeeping page shows tasks but no Add Task button', async ({ page }) => {
    await loginAsRole(page, 'STAFF');
    await page.goto('/dashboard/housekeeping');
    await page.waitForTimeout(2000);
    // "New Task" is gated to canManage roles (OWNER/MANAGER/RECEPTIONIST) —
    // STAFF should never see it. Scoped to the button role (not getByText)
    // so an unrelated toast/badge that happens to contain the same words
    // can never trip a strict-mode multi-match here either.
    await expect(page.getByRole('button', { name: /New Task/i })).not.toBeVisible();
  });
});

// ── CHEF ───────────────────────────────────────────────────────────────────────
test.describe('CHEF role', () => {
  test('sees only F&B Orders in sidebar', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await ensureNavOpen(page);
    await expandGroup(page, 'Restaurant');
    await expect(await navItem(page, 'F&B Orders')).toBeVisible({ timeout: 8000 });
    // Should NOT see these — CHEF has no daily items and no other groups.
    await expect(await navItem(page, 'Rooms')).not.toBeVisible();
    await expect(await navItem(page, 'Bookings')).not.toBeVisible();
    await expect(await navItem(page, 'Housekeeping')).not.toBeVisible();
    await expect(await navItem(page, 'Inventory')).not.toBeVisible();
  });

  test('dashboard shows F&B Orders banner, not stat cards', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await page.goto('/dashboard');
    // CHEF gets a dedicated "Kitchen Orders" banner (linking to F&B Orders)
    // instead of the stat-card dashboard.
    await expect(page.getByText('Kitchen Orders')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Monthly Revenue')).not.toBeVisible();
  });

  test('F&B Orders page shows Kitchen Display (dark background)', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await page.goto('/dashboard/orders');
    // Kitchen Display has "Kitchen Display" heading
    await expect(page.getByText('Kitchen Display')).toBeVisible({ timeout: 8000 });
    // Should NOT see a "New Order" button — Kitchen Display is a distinct,
    // read/act-only view with no order-creation control. getByText('New
    // Order') is case-insensitive substring matching, which also caught a
    // live "🔔 New order received!" toast and a "NEW ORDER" status badge on
    // this real-time page (confirmed failing in CI) — neither is the create
    // button in question, so scope to the button role instead.
    await expect(page.getByRole('button', { name: /New Order/i })).not.toBeVisible();
  });

  test('Kitchen Display shows live clock', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await page.goto('/dashboard/orders');
    // Clock shows HH:MM format. The same pattern also matches the
    // "Last updated: HH:MM:SS" footer text below it — .first() picks the
    // big header clock and avoids a strict-mode multi-match failure.
    await expect(page.locator('text=/\\d{1,2}:\\d{2}/').first()).toBeVisible({ timeout: 8000 });
  });
});

// ── Demo logout ─────────────────────────────────────────────────────────────
test.describe('Demo logout', () => {
  test('logout redirects back to /try not /auth/login', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    // MobileMoreSheet's "Sign out" used to hardcode '/auth/login' and skip
    // the isDemo check the desktop sidebar's handleLogout has — a demo
    // session on mobile got bounced to the real login screen instead of
    // back to /try. Fixed in components/dashboard/MobileMoreSheet.tsx.
    await logout(page);
    await page.waitForURL(/\/try|\/auth\/login/, { timeout: 8000 });
    expect(page.url()).toContain('/try');
  });
});
