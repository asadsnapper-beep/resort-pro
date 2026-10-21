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

  // The page shipped with no route to `/auth/register` at all: every call to
  // action went to the demo or the pricing, and the header offered only Log
  // in. A visitor could read all of it and still have no way to start. These
  // two cover the path that was missing, which is the one thing on this page
  // a launch depends on.
  test('a visitor can reach sign-up from the hero', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Create your account' }).first().click();
    await expect(page).toHaveURL('/auth/register');
    // Landing on the page is not the same as being able to use it.
    await expect(page.locator('input[name="resortName"]')).toBeVisible();
  });

  // Runs on both projects, and the phone one is the point: the header is
  // `lg:` only, so on a phone this passes solely because the menu now carries
  // sign-up too. It used to carry the three anchors and the demo and nothing
  // else — no way to sign in, no way to start.
  test('and from the navigation, on a phone as well as a desktop', async ({ page, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.getByRole('button', { name: /Open menu|Menu/ }).click();
    await page.getByRole('link', { name: 'Sign up' }).first().click();
    await expect(page).toHaveURL('/auth/register');
  });
});
