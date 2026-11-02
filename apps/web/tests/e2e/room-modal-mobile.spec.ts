/**
 * Whether Add Room can actually be filled in on a phone.
 *
 * The first row of the form was a five-column grid of fixed widths —
 * `100px 1fr 80px 90px 110px` plus four 12px gaps — inside a modal body with
 * `overflow-x: hidden`. On an iPhone 14 that is wider than the space it has,
 * and the overflow was not scrollable but clipped: Price/Night sat off the
 * edge of the modal with no way to reach it. A mobile owner could not add
 * inventory. (Room Management QA 2026-10-28, RM-009.)
 *
 * These run in both Playwright projects on purpose. "Mobile Safari" is the
 * finding; "chromium" is the guard that fixing it did not rearrange the
 * desktop form, which is where this screen is mostly used.
 *
 * Measured rather than eyeballed: every field's own box must sit inside the
 * modal's box. A screenshot proves nothing when the clipped part is invisible
 * by definition.
 */
import { test, expect, type Page } from '@playwright/test';
import { useRole } from './helpers';

/** The fields of the row that overflowed, by their visible labels. */
const ROW_ONE = ['Room #', 'Name', 'Floor', 'Guests', 'Price/Night'];

const openAddRoom = async (page: Page) => {
  // The shared login is still redirecting to /dashboard when the first test
  // starts, and a goto issued into that interrupts it. Let it land first.
  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
  await page.goto('/dashboard/rooms', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add Room' }).first().click();
  await expect(page.getByRole('heading', { name: 'Add Room' })).toBeVisible({ timeout: 10000 });
};

/** The modal panel — the box every field has to fit inside. */
const panel = (page: Page) =>
  page.locator('form#room-form').locator('xpath=ancestor::div[contains(@style,"border-radius: 18px")]');

test.describe('OWNER role · Add Room on a narrow screen', () => {
  const shared = useRole('OWNER');

  test('every field in the first row is inside the modal, not clipped off it', async () => {
    const page = shared.page;
    await openAddRoom(page);

    const box = await panel(page).boundingBox();
    expect(box, 'modal panel should be measurable').not.toBeNull();

    for (const label of ROW_ONE) {
      const field = page.locator('#room-form').getByLabel(label, { exact: true })
        .or(page.locator(`#room-form input`).nth(ROW_ONE.indexOf(label)));
      const f = await field.first().boundingBox();
      expect(f, `${label} should be measurable`).not.toBeNull();

      // The right edge is the one that was lost: Price/Night ran past it.
      expect.soft(f!.x + f!.width,
        `${label} runs past the modal's right edge`).toBeLessThanOrEqual(box!.x + box!.width + 1);
      expect.soft(f!.x, `${label} starts left of the modal`).toBeGreaterThanOrEqual(box!.x - 1);
    }
    expect(test.info().errors, 'see the soft assertions above').toHaveLength(0);
  });

  test('the form does not overflow the width it is given', async () => {
    const page = shared.page;
    await openAddRoom(page);

    // `overflow-x: hidden` means this cannot be seen or scrolled to — the
    // only way to catch it is to compare the two numbers.
    const overflow = await page.locator('#room-form').evaluate(
      el => el.scrollWidth - el.clientWidth,
    );

    expect(overflow, 'the form is wider than its container').toBeLessThanOrEqual(1);
  });

  test('is back to one row at tablet width, where there is room for it', async () => {
    // The report asks for the responsive layout "below tablet width", so 768
    // is the boundary and belongs in a test: moving the breakpoint out to
    // `lg` failed nothing until this existed, and would have left tablets on
    // the phone layout for no reason.
    const page = shared.page;
    const original = page.viewportSize();
    await page.setViewportSize({ width: 768, height: 900 });
    try {
      await openAddRoom(page);

      const tops = await Promise.all(
        ['101', 'Ocean View Suite', '1'].map(ph =>
          page.locator(`#room-form input[placeholder="${ph}"]`).boundingBox()
            .then(b => Math.round(b!.y)),
        ),
      );

      expect(new Set(tops).size, `fields sat on ${new Set(tops).size} rows: ${tops}`).toBe(1);
      const overflow = await page.locator('#room-form')
        .evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      if (original) await page.setViewportSize(original);
    }
  });

  test('every field in the first row can be typed into', async () => {
    const page = shared.page;
    await openAddRoom(page);

    await page.locator('#room-form input[placeholder="101"]').fill('905');
    await page.locator('#room-form input[placeholder="Ocean View Suite"]').fill('Mobile Test Room');
    await page.locator('#room-form input[placeholder="1"]').fill('9');

    await expect(page.locator('#room-form input[placeholder="101"]')).toHaveValue('905');
    await expect(page.locator('#room-form input[placeholder="Ocean View Suite"]'))
      .toHaveValue('Mobile Test Room');
    await expect(page.locator('#room-form input[placeholder="1"]')).toHaveValue('9');
  });
});
