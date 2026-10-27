import { test, expect } from '@playwright/test';
import { useRole } from './helpers';

/**
 * The builder offered every section control for every theme, and the themes
 * disagreed without saying so. On Minimal an owner could add photos and guest
 * reviews, reorder them, publish, open the site and find neither — Minimal
 * renders neither. Amenities was offered everywhere and drawn only by Coastal.
 * Offers was drawn by two themes and offered by none, so it could not be
 * hidden or moved at all. (Website Builder QA 2026-10-28, WB-001, which called
 * it the clearest "UI exists but does not work" issue in the audit.)
 *
 * The contract that fixes it is unit-tested in theme-capabilities.test.ts,
 * including a check that each renderer draws exactly what its theme declares.
 * What those cannot show is whether the builder tells the owner. These do.
 *
 * Nothing here publishes. Choosing a template only changes the form in the
 * browser, so the demo tenant's live site is untouched.
 */
test.describe('Website builder — theme capabilities', () => {
  const shared = useRole('OWNER');

  const choose = async (name: string) => {
    const page = shared.page;
    await page.goto('/dashboard/website');
    await page.getByRole('button', { name: 'Template', exact: true }).click();
    await page.getByText(name, { exact: true }).first().click();
  };

  test('Minimal says it will not show the Gallery you are editing', async () => {
    const page = shared.page;
    await choose('Minimal Clean');
    await page.getByRole('button', { name: 'Gallery', exact: true }).click();
    await expect(page.getByText(/does not show this section/i)).toBeVisible({ timeout: 30_000 });
  });

  test('…and the same for Testimonials', async () => {
    const page = shared.page;
    await choose('Minimal Clean');
    await page.getByRole('button', { name: 'Testimonials', exact: true }).click();
    await expect(page.getByText(/does not show this section/i)).toBeVisible({ timeout: 30_000 });
  });

  test('Minimal lists what it cannot do instead of pretending', async () => {
    const page = shared.page;
    await choose('Minimal Clean');
    await page.getByRole('button', { name: 'Sections', exact: true }).click();
    const unsupported = page.getByText('Not supported by this theme');
    await expect(unsupported).toBeVisible({ timeout: 30_000 });
    // Naming them matters more than the heading: this is the sentence that
    // answers "where did my photos go?".
    const card = page.locator('div').filter({ hasText: /Not supported by this theme/ }).last();
    await expect(card).toContainText('Photo Gallery');
    await expect(card).toContainText('Testimonials');
  });

  test('Luxe shows no such notice for Gallery, because Luxe draws it', async () => {
    const page = shared.page;
    await choose('Luxe Gold');
    await page.getByRole('button', { name: 'Gallery', exact: true }).click();
    await expect(page.getByText(/does not show this section/i)).toHaveCount(0);
  });

  test('Coastal can finally control Offers, which it has always rendered', async () => {
    const page = shared.page;
    await choose('Coastal Breeze');
    await page.getByRole('button', { name: 'Sections', exact: true }).click();
    // Offers was missing from the builder's section list entirely, so the two
    // themes that render it gave owners no way to hide or reorder it.
    await expect(page.getByText('Offers & Promotions')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Amenities')).toBeVisible();
  });
});
