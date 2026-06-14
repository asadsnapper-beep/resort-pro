/**
 * Role-based UI tests
 * Each role logs in via demo and we assert what they can/can't see.
 */
import { test, expect, type Page } from '@playwright/test';

// ── Helper: login via demo as a specific role ─────────────────────────────────
async function loginAsRole(page: Page, role: string) {
  await page.goto('/demo');
  // Click the role card
  await page.getByText(`Explore as ${roleLabel(role)}`).click();
  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  // Wait for sidebar to render
  await page.waitForSelector('[data-testid="sidebar"], nav, aside', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
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

// ── OWNER ──────────────────────────────────────────────────────────────────────
test.describe('OWNER role', () => {
  test('sees full sidebar navigation', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await expect(page.getByText('Rooms & Villas')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Bookings')).toBeVisible();
    await expect(page.getByText('Inventory')).toBeVisible();
    await expect(page.getByText('F&B Orders')).toBeVisible();
  });

  test('sees Monthly Revenue card on dashboard', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await page.goto('/dashboard');
    await expect(page.getByText('Monthly Revenue')).toBeVisible({ timeout: 8000 });
  });

  test('can access Roles & Team page', async ({ page }) => {
    await loginAsRole(page, 'OWNER');
    await page.goto('/dashboard/roles');
    await expect(page.getByText('Team Members')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Invite Member')).toBeVisible();
  });
});

// ── SHAREHOLDER ────────────────────────────────────────────────────────────────
test.describe('SHAREHOLDER role', () => {
  test('sees only Dashboard and Analytics in sidebar', async ({ page }) => {
    await loginAsRole(page, 'SHAREHOLDER');
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Analytics')).toBeVisible();
    // Should NOT see these
    await expect(page.getByText('Rooms & Villas')).not.toBeVisible();
    await expect(page.getByText('Bookings')).not.toBeVisible();
    await expect(page.getByText('Invoices')).not.toBeVisible();
    await expect(page.getByText('F&B Orders')).not.toBeVisible();
  });

  test('sees Monthly Revenue card on dashboard', async ({ page }) => {
    await loginAsRole(page, 'SHAREHOLDER');
    await page.goto('/dashboard');
    await expect(page.getByText('Monthly Revenue')).toBeVisible({ timeout: 8000 });
  });

  test('shows role badge "Shareholder" in sidebar', async ({ page }) => {
    await loginAsRole(page, 'SHAREHOLDER');
    await expect(page.getByText('Shareholder')).toBeVisible({ timeout: 8000 });
  });
});

// ── RECEPTIONIST ───────────────────────────────────────────────────────────────
test.describe('RECEPTIONIST role', () => {
  test('sees Rooms, Bookings, Guests, Housekeeping, F&B Orders', async ({ page }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await expect(page.getByText('Rooms & Villas')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Bookings')).toBeVisible();
    await expect(page.getByText('Guests')).toBeVisible();
    await expect(page.getByText('Housekeeping')).toBeVisible();
    await expect(page.getByText('F&B Orders')).toBeVisible();
  });

  test('does NOT see Monthly Revenue on dashboard', async ({ page }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await page.goto('/dashboard');
    await page.waitForTimeout(2000);
    await expect(page.getByText('Monthly Revenue')).not.toBeVisible();
  });

  test('does NOT see Inventory in sidebar', async ({ page }) => {
    await loginAsRole(page, 'RECEPTIONIST');
    await expect(page.getByText('Inventory')).not.toBeVisible();
  });
});

// ── STAFF ──────────────────────────────────────────────────────────────────────
test.describe('STAFF role', () => {
  test('sees only Housekeeping in sidebar', async ({ page }) => {
    await loginAsRole(page, 'STAFF');
    await expect(page.getByText('Housekeeping')).toBeVisible({ timeout: 8000 });
    // Should NOT see these
    await expect(page.getByText('Rooms & Villas')).not.toBeVisible();
    await expect(page.getByText('Bookings')).not.toBeVisible();
    await expect(page.getByText('F&B Orders')).not.toBeVisible();
    await expect(page.getByText('Inventory')).not.toBeVisible();
  });

  test('dashboard shows housekeeping banner, not stat cards', async ({ page }) => {
    await loginAsRole(page, 'STAFF');
    await page.goto('/dashboard');
    await expect(page.getByText(/Housekeeping/i)).toBeVisible({ timeout: 8000 });
    // Should NOT see revenue/booking stats
    await expect(page.getByText('Monthly Revenue')).not.toBeVisible();
    await expect(page.getByText('Total Bookings')).not.toBeVisible();
  });

  test('Housekeeping page shows tasks but no Add Task button', async ({ page }) => {
    await loginAsRole(page, 'STAFF');
    await page.goto('/dashboard/housekeeping');
    await page.waitForTimeout(2000);
    // "New Task" button should NOT be visible
    await expect(page.getByText('New Task')).not.toBeVisible();
  });
});

// ── CHEF ───────────────────────────────────────────────────────────────────────
test.describe('CHEF role', () => {
  test('sees only F&B Orders in sidebar', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await expect(page.getByText('F&B Orders')).toBeVisible({ timeout: 8000 });
    // Should NOT see these
    await expect(page.getByText('Rooms & Villas')).not.toBeVisible();
    await expect(page.getByText('Bookings')).not.toBeVisible();
    await expect(page.getByText('Housekeeping')).not.toBeVisible();
    await expect(page.getByText('Inventory')).not.toBeVisible();
  });

  test('dashboard shows F&B Orders banner, not stat cards', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await page.goto('/dashboard');
    await expect(page.getByText(/F&B Orders/i)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Monthly Revenue')).not.toBeVisible();
  });

  test('F&B Orders page shows Kitchen Display (dark background)', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await page.goto('/dashboard/orders');
    // Kitchen Display has "Kitchen Display" heading
    await expect(page.getByText('Kitchen Display')).toBeVisible({ timeout: 8000 });
    // Should NOT see "New Order" button
    await expect(page.getByText('New Order')).not.toBeVisible();
  });

  test('Kitchen Display shows live clock', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    await page.goto('/dashboard/orders');
    // Clock shows HH:MM format
    await expect(page.locator('text=/\\d{1,2}:\\d{2}/')).toBeVisible({ timeout: 8000 });
  });
});

// ── Demo logout ─────────────────────────────────────────────────────────────
test.describe('Demo logout', () => {
  test('logout redirects back to /demo not /auth/login', async ({ page }) => {
    await loginAsRole(page, 'CHEF');
    // Click logout button in sidebar
    await page.locator('button[title*="logout"], button:has-text("logout"), [data-testid="logout"]').first().click().catch(async () => {
      // Try clicking the logout icon at bottom of sidebar
      await page.locator('aside button').last().click();
    });
    await page.waitForURL(/\/demo|\/auth\/login/, { timeout: 8000 });
    expect(page.url()).toContain('/demo');
  });
});
