/**
 * Role-based UI tests
 * Each role logs in via demo and we assert what they can/can't see.
 *
 * Runs against two Playwright projects — "chromium" (desktop viewport) and
 * "Mobile Safari" (iPhone 14 viewport) — which render two ENTIRELY different
 * navigation UIs (see components/dashboard/sidebar.tsx vs. MobileMoreSheet.tsx
 * + app/(dashboard)/layout.tsx's mobile bottom bar):
 *  - Desktop: a persistent <aside> sidebar with a "daily" tier (always
 *    rendered) plus 7 collapsible, role-filtered groups (collapsed by
 *    default — their items aren't even in the DOM until expanded).
 *  - Mobile: the sidebar is `hidden md:flex` (not in the DOM at all). A
 *    fixed bottom bar has 4 static links (not role-filtered) plus a "More"
 *    button that opens a bottom sheet (MobileMoreSheet) listing EVERY item
 *    the role can reach — daily and grouped alike — flattened into always-
 *    expanded sections, rendered as <button> instead of <a>.
 * The nav helpers below detect which UI is present and operate on whichever
 * is actually rendered, so the same assertions work on both projects.
 */
import { test, expect, type Page } from '@playwright/test';

// ── Helper: login via demo as a specific role ─────────────────────────────────
// The demo entry point moved from /demo (a role-picker) to /try, which now
// gates role selection behind a one-time email capture, and every role
// card's own call-to-action reads the generic "Explore this role" — the
// role itself only appears as that card's title text (see ROLES in
// app/try/page.tsx), so we match on the title, not the old "Explore as X"
// copy that no longer exists anywhere in the app.
async function loginAsRole(page: Page, role: string) {
  await page.goto('/try');

  // Fresh browser context → no rp_demo_email in localStorage yet → the
  // email-capture modal shows, but only after a client-side useEffect checks
  // localStorage — it isn't in the initial HTML. isVisible() doesn't wait
  // for that, it checks synchronously, so on a slower render it always saw
  // "not there yet" and silently skipped the email step even though the
  // gate would have appeared a moment later — the role click then no-opped
  // forever since capturedEmail was never set. Give it a moment to show up.
  const emailInput = page.locator('#demo-email');
  await emailInput.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('e2e-tests@resortpro-tests.invalid');
    await page.getByRole('button', { name: /Continue to demo/i }).click();
  }

  // Click the role card — identified by its title text inside the button,
  // not by call-to-action copy (which is identical on every card).
  await page.locator('button').filter({ hasText: roleLabel(role) }).first().click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  // Wait for whichever nav UI this viewport renders.
  await page.waitForSelector('aside, nav', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  // The URL matching /dashboard doesn't guarantee the client-side
  // router.replace() that got us here has fully settled — a page.goto()
  // fired immediately after can race with it and abort as "interrupted by
  // another navigation" (seen on Mobile Safari, where this settles slower).
  // waitForLoadState('load') doesn't help here: this is a client-side SPA
  // transition, not a real page load, so the 'load' event already fired
  // back when /try first loaded and never fires again — networkidle is the
  // signal that actually correlates with the redirect's data fetches
  // finishing.
  await page.waitForLoadState('networkidle').catch(() => {});
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    OWNER:        'Resort Owner',
    MANAGER:      'General Manager',
    SHAREHOLDER:  'Shareholder',
    RECEPTIONIST: 'Receptionist',
    MARKETER:     'Marketing Manager',
    DEVELOPER:    'Developer',
    STAFF:        'Housekeeping Staff',
    CHEF:         'Chef',
  };
  return labels[role] ?? role;
}

// ── Nav helpers (desktop sidebar vs. mobile "More" sheet) ──────────────────
const mobileSheet = (page: Page) => page.locator('[data-testid="mobile-nav-sheet"]');

async function isDesktopNav(page: Page): Promise<boolean> {
  return page.locator('aside').first().isVisible().catch(() => false);
}

// On mobile the sidebar isn't in the DOM at all — every item (daily and
// grouped alike) lives inside the bottom sheet instead, and it's closed by
// default. No-op on desktop, where the sidebar is always present.
async function ensureNavOpen(page: Page) {
  if (await isDesktopNav(page)) return;
  if (await mobileSheet(page).isVisible().catch(() => false)) return;
  await page.getByRole('button', { name: /open full menu/i }).click();
  await mobileSheet(page).waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
}

// `hasText` with a plain string is a substring match — "Bookings" also
// matches a "Group Bookings" nav item once mobile flattens every item into
// one flat, always-expanded list (desktop never surfaced this: the two
// never appeared together unless their shared group was expanded). Anchor
// to the full trimmed text instead.
function exact(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`);
}

// Nav items render as <a> inside <aside> on desktop, or <button> inside the
// mobile sheet. The desktop <aside> stays in the DOM at mobile widths too
// (Tailwind `hidden md:flex` is display:none, not an unmount) — a selector
// that unions both containers would resolve to two elements (one hidden,
// one real) and trip Playwright's strict-mode check on toBeVisible(), so
// pick the container that's actually rendered for this viewport instead.
async function navItem(page: Page, label: string) {
  const scope = (await isDesktopNav(page)) ? page.locator('aside a') : mobileSheet(page).locator('button');
  return scope.filter({ hasText: exact(label) });
}

// Desktop: the collapsible group's <button> header (has a rotating chevron).
// Mobile: the sheet's plain, always-expanded section <p> label.
async function groupHeader(page: Page, label: string) {
  const scope = (await isDesktopNav(page)) ? page.locator('aside button') : mobileSheet(page).locator('p');
  return scope.filter({ hasText: exact(label) });
}

async function expandGroup(page: Page, groupLabel: string) {
  await ensureNavOpen(page);
  if (!(await isDesktopNav(page))) return; // mobile sheet has no collapse state
  const header = page.locator('aside button', { hasText: groupLabel });
  if ((await header.count()) === 0) return; // role has zero items in this group — no header at all
  const chevron = header.locator('svg').first();
  const isCollapsed = await chevron
    .evaluate((el) => el.classList.contains('-rotate-90'))
    .catch(() => true);
  if (isCollapsed) await header.click();
}

// Click the logout control regardless of viewport: desktop's sidebar button
// (title="Logout") vs. the mobile sheet's "Sign out" button (behind "More").
async function logout(page: Page) {
  if (await isDesktopNav(page)) {
    await page.getByTitle('Logout').click();
  } else {
    await ensureNavOpen(page);
    await mobileSheet(page).getByText('Sign out').click();
  }
}

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
    // STAFF should never see it.
    await expect(page.getByText('New Task')).not.toBeVisible();
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
    // Should NOT see "New Order" button — Kitchen Display is a distinct,
    // read/act-only view with no order-creation control.
    await expect(page.getByText('New Order')).not.toBeVisible();
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
