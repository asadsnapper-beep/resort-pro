import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByPlaceholder('your-resort-name')).toBeVisible();
    await expect(page.getByPlaceholder('owner@yourresort.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('login shows error on invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByPlaceholder('your-resort-name').fill('invalid-resort');
    await page.getByPlaceholder('owner@yourresort.com').fill('bad@email.com');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Login failed|Invalid credentials/i })).toBeVisible({ timeout: 10000 });
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.getByText('Create your resort')).toBeVisible();
    await expect(page.getByPlaceholder('Palm Paradise Resort')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create my resort' })).toBeVisible();
  });

  test('slug auto-generates from resort name', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByPlaceholder('Palm Paradise Resort').fill('My Amazing Resort');
    const slugInput = page.getByPlaceholder('palm-paradise-resort');
    await expect(slugInput).toHaveValue('my-amazing-resort');
  });

  test('register shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/auth/register');
    await page.getByRole('button', { name: 'Create my resort' }).click();
    await expect(page.getByText(/required|must be/i).first()).toBeVisible();
  });
});
