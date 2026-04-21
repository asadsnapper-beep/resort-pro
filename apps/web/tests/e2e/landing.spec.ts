import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows hero heading and CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ResortPro/);
    await expect(page.getByText('Run your resort,')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get started for free' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('features section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Room Management')).toBeVisible();
    await expect(page.getByText('Booking Engine')).toBeVisible();
    await expect(page.getByText('Guest Support')).toBeVisible();
    await expect(page.getByText('Owner Mobile App')).toBeVisible();
  });

  test('CTA links navigate to register', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Get started for free' }).click();
    await expect(page).toHaveURL('/auth/register');
  });

  test('sign in link navigates to login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/auth/login');
  });
});
