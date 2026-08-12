/**
 * Shared E2E helpers — real demo-role login + nav helpers that work across
 * both Playwright projects ("chromium" desktop, "Mobile Safari"), which
 * render two ENTIRELY different navigation UIs (see
 * components/dashboard/sidebar.tsx vs. MobileMoreSheet.tsx +
 * app/(dashboard)/layout.tsx's mobile bottom bar):
 *  - Desktop: a persistent <aside> sidebar with a "daily" tier (always
 *    rendered) plus 7 collapsible, role-filtered groups (collapsed by
 *    default — their items aren't even in the DOM until expanded).
 *  - Mobile: the sidebar is `hidden md:flex` (not in the DOM at all). A
 *    fixed bottom bar has 4 static links (not role-filtered) plus a "More"
 *    button that opens a bottom sheet (MobileMoreSheet) listing EVERY item
 *    the role can reach — daily and grouped alike — flattened into always-
 *    expanded sections, rendered as <button> instead of <a>.
 * The helpers below detect which UI is present and operate on whichever is
 * actually rendered, so the same assertions work on both projects.
 *
 * Extracted from roles.spec.ts so other spec files (dashboard.spec.ts) log
 * in the same real way instead of a hand-rolled localStorage auth mock that
 * drifts out of sync with the app's actual auth-store shape/login flow.
 */
import { expect, type Page } from '@playwright/test';

// ── Login via demo as a specific role ───────────────────────────────────────
// The demo entry point moved from /demo (a role-picker) to /try, which now
// gates role selection behind a one-time email capture, and every role
// card's own call-to-action reads the generic "Explore this role" — the
// role itself only appears as that card's title text (see ROLES in
// app/try/page.tsx), so we match on the title, not the old "Explore as X"
// copy that no longer exists anywhere in the app.
export async function loginAsRole(page: Page, role: string) {
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

export function roleLabel(role: string): string {
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
export const mobileSheet = (page: Page) => page.locator('[data-testid="mobile-nav-sheet"]');

export async function isDesktopNav(page: Page): Promise<boolean> {
  return page.locator('aside').first().isVisible().catch(() => false);
}

// On mobile the sidebar isn't in the DOM at all — every item (daily and
// grouped alike) lives inside the bottom sheet instead, and it's closed by
// default. No-op on desktop, where the sidebar is always present.
export async function ensureNavOpen(page: Page) {
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
export function exact(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*$`);
}

// Nav items render as <a> inside <aside> on desktop, or <button> inside the
// mobile sheet. The desktop <aside> stays in the DOM at mobile widths too
// (Tailwind `hidden md:flex` is display:none, not an unmount) — a selector
// that unions both containers would resolve to two elements (one hidden,
// one real) and trip Playwright's strict-mode check on toBeVisible(), so
// pick the container that's actually rendered for this viewport instead.
export async function navItem(page: Page, label: string) {
  const scope = (await isDesktopNav(page)) ? page.locator('aside a') : mobileSheet(page).locator('button');
  return scope.filter({ hasText: exact(label) });
}

// Desktop: the collapsible group's <button> header (has a rotating chevron).
// Mobile: the sheet's plain, always-expanded section <p> label.
export async function groupHeader(page: Page, label: string) {
  const scope = (await isDesktopNav(page)) ? page.locator('aside button') : mobileSheet(page).locator('p');
  return scope.filter({ hasText: exact(label) });
}

export async function expandGroup(page: Page, groupLabel: string) {
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
export async function logout(page: Page) {
  if (await isDesktopNav(page)) {
    await page.getByTitle('Logout').click();
  } else {
    await ensureNavOpen(page);
    await mobileSheet(page).getByText('Sign out').click();
  }
}

// Re-exported so spec files don't also need a direct `expect` import just to
// satisfy TS when they only use it via helpers here.
export { expect };
