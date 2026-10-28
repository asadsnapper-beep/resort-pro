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

/**
 * The live preview's channel to the builder (WB-003).
 *
 * The frame now announces itself and the editor answers with the current form,
 * so neither side has to load first. The frame's half of that — the
 * announcement, and refusing an update from anyone who is not the editor — is
 * covered in preview-page-handshake.test.tsx. The editor's half lives inside
 * the builder page and has no unit test, so it is covered here.
 *
 * The second test is the audit's race made deterministic. sessionStorage used
 * to paper over most of that window, which is why the audit saw one pass and
 * one miss rather than a consistent failure — so the test empties it, leaving
 * the handshake as the only way the owner's unsaved edit can reach a freshly
 * mounted frame.
 *
 * Each covers a different failure, which was checked by mutation rather than
 * assumed: a trust check that can never pass — the way this fix would break if
 * the frame were ever loaded cross-origin — fails the first and not the
 * second, and removing the announcement fails the second and not the first.
 *
 * Nothing here publishes. Typing changes the form in the browser only.
 */
test.describe('Website builder — live preview channel', () => {
  // The preview pane is `hidden lg:flex` — the builder deliberately does not
  // show it on a phone, so on the Mobile Safari project there is no frame to
  // talk to. Skipped rather than loosened: an assertion that passes because
  // the thing is absent is worse than no assertion.
  test.skip(({ viewport }) => (viewport?.width ?? Infinity) < 1024,
    'the builder hides the preview below the lg breakpoint');

  const shared = useRole('OWNER');

  const previewFrame = () =>
    shared.page.frameLocator('iframe[title="Website preview"]');

  /** Opens the builder on the Hero tab, which is a tab away from the default. */
  const openHeroTab = async () => {
    const page = shared.page;
    await page.goto('/dashboard/website');
    await expect(page.locator('iframe[title="Website preview"]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Hero & About', exact: true }).click();
    const heroTitle = page.getByPlaceholder('Welcome to Paradise');
    await expect(heroTitle).toBeVisible({ timeout: 30_000 });
    return heroTitle;
  };

  const RESTORE = 'Where Ocean Meets Luxury';

  test('an unsaved edit reaches the preview', async () => {
    const heroTitle = await openHeroTab();
    const typed = `Unsaved hero ${Date.now()}`;

    await heroTitle.fill(typed);
    await expect(previewFrame().getByText(typed)).toBeVisible({ timeout: 30_000 });

    await heroTitle.fill(RESTORE);
  });

  test('and survives a preview reload with nothing in storage to fall back on', async () => {
    const page = shared.page;
    const heroTitle = await openHeroTab();
    const typed = `Handshake only ${Date.now()}`;

    await heroTitle.fill(typed);
    await expect(previewFrame().getByText(typed)).toBeVisible({ timeout: 30_000 });

    // Take away the fallback. From here the only route into a newly mounted
    // frame is the frame asking for the form and the editor answering.
    await page.evaluate(() => sessionStorage.clear());
    await page.getByTitle('Reload preview').click();

    await expect(previewFrame().getByText(typed)).toBeVisible({ timeout: 30_000 });

    // Leave the form as it was found, so nothing downstream inherits a dirty
    // editor — and so the unsaved-changes guard does not block a navigation.
    await heroTitle.fill(RESTORE);
  });
});
