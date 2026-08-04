import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('shows hero heading and CTA buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ResortPro/);
    await expect(page.getByRole('heading', { name: 'Let your resort feel effortless.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Build your workspace' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('features section is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'The morning view' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The payment moment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The guest relationship' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The room turnover' })).toBeVisible();
  });

  test('workspace CTA navigates to plans', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Build your workspace' }).click();
    await expect(page).toHaveURL('/plans');
  });

  test('sign in link navigates to login', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Log in' }).click();
    await expect(page).toHaveURL('/auth/login');
  });
});
