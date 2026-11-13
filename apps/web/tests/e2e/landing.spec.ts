import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows hero heading and CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ResortPro/);
    await expect(page.getByRole('heading', { name: 'Run your whole resort from one simple dashboard.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore the live demo' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible();
  });

  test('features section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Bookings & calendar' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rooms & housekeeping' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payments & invoices' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Guest records' })).toBeVisible();
  });

  test('hero CTA navigates to the live demo', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Explore the live demo' }).first().click();
    await expect(page).toHaveURL('/try');
  });

  test('sign in link navigates to login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Log in' }).first().click();
    await expect(page).toHaveURL('/auth/login');
  });
});
