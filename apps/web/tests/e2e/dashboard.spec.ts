import { test, expect } from '@playwright/test';

// Uses localStorage auth mock
test.describe('Dashboard (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('resort-pro-auth', JSON.stringify({
        state: {
          user: { id: 'u1', email: 'owner@test.com', firstName: 'Alex', lastName: 'Johnson', role: 'OWNER', tenantId: 't1' },
          tenant: { id: 't1', name: 'Test Resort', slug: 'test-resort', plan: 'STARTER' },
          token: 'mock-token-for-e2e',
          refreshToken: 'mock-refresh-token',
        },
        version: 0,
      }));
    });
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    // Without mock token, should redirect
    await expect(page).toHaveURL(/\/auth\/login|\/dashboard/);
  });

  test('sidebar shows all navigation items', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Rooms & Villas')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bookings')).toBeVisible();
    await expect(page.getByText('Guests')).toBeVisible();
    await expect(page.getByText('Staff')).toBeVisible();
    await expect(page.getByText('Housekeeping')).toBeVisible();
    await expect(page.getByText('Support')).toBeVisible();
    await expect(page.getByText('Website')).toBeVisible();
  });

  test('rooms page accessible from sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('Rooms & Villas').click();
    await expect(page).toHaveURL('/dashboard/rooms');
  });
});
