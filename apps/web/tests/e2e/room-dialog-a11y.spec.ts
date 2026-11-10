/**
 * Whether the two room overlays behave like dialogs.
 *
 * Add Room and the room detail sheet were both hand-rolled `<div>`s in a
 * portal. Nothing said they were dialogs, nothing moved focus into them,
 * nothing brought focus back out, Escape did nothing, Tab walked straight
 * past them into the page behind, the visible labels were not attached to
 * their inputs, and every icon-only control announced itself as "button".
 * (Room Management QA 2026-10-28, RM-010.)
 *
 * This is the one finding whose whole content is behaviour the eye does not
 * see, so it is asserted the way the audit found it: through role and label
 * queries, which read the accessibility tree and not the markup, plus real
 * key presses. `getByRole('dialog')` passing is the same statement as a
 * screen reader announcing a dialog.
 *
 * No axe run here. Axe would add a dependency and report on the whole page,
 * most of which is not this finding; these assertions name the specific
 * contract the report asked for, and fail with a sentence about what is
 * missing rather than a rule id.
 */
import { test, expect, type Page } from '@playwright/test';
import { useRole } from './helpers';

const gotoRooms = async (page: Page) => {
  // The shared login may still be redirecting; a goto issued into that is
  // aborted as "interrupted by another navigation" (see room-modal-mobile).
  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {});
  await page.goto('/dashboard/rooms', { waitUntil: 'domcontentloaded' });
};

const addRoomButton = (page: Page) => page.getByRole('button', { name: 'Add Room' }).first();

const openAddRoom = async (page: Page) => {
  await gotoRooms(page);
  await addRoomButton(page).click();
  await expect(page.getByRole('heading', { name: 'Add Room' })).toBeVisible({ timeout: 10000 });
};

/**
 * The first room card, waited for and reloaded once if the grid is still
 * empty. The list can be served a 429 when the suite's logins stack up, and
 * the page's own retry is not guaranteed to land inside one timeout.
 */
const firstCard = async (page: Page) => {
  await gotoRooms(page);
  const card = page.locator('[data-testid="room-card"]').first();
  try {
    await card.waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await card.waitFor({ state: 'visible', timeout: 15000 });
  }
  return card;
};

const openFirstRoom = async (page: Page) => {
  const card = await firstCard(page);
  await card.click();
  await expect(page.getByText('Change Status')).toBeVisible({ timeout: 10000 });
};

/** Where focus is, described well enough to read in a failure message. */
const focusDescription = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return 'nothing';
    const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${name ? ` "${name}"` : ''}`;
  });

/** Whether focus is inside the given dialog. */
const focusIsInside = (page: Page, selector: string) =>
  page.evaluate(
    sel => !!document.querySelector(sel)?.contains(document.activeElement),
    selector,
  );

/*
  One login for both groups. Each `useRole` walks /try, the role picker and the
  dashboard shell, and the shell fires a dozen requests of its own — two of
  them in one file pushed the rooms list far enough into the API's 300/min
  global limit that the card never arrived and a detail-sheet test timed out
  on Mobile Safari. helpers.ts documents the same trap.
*/
test.describe('OWNER role · the room overlays are dialogs', () => {
  const shared = useRole('OWNER');

  test.describe('Add Room', () => {

  test('a screen reader can find it, and it is named', async () => {
    const page = shared.page;
    await openAddRoom(page);

    // The audit's own check: the overlay was not discoverable as a dialog.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Named by its own heading, so the name cannot drift from what is shown.
    await expect(dialog).toHaveAccessibleName('Add Room');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('every visible label is attached to its field', async () => {
    const page = shared.page;
    await openAddRoom(page);

    // "Room #" was the one the report named. All of them were the same.
    for (const [label, placeholder] of [
      ['Room #', '101'],
      ['Name', 'Ocean View Suite'],
      ['Floor', '1'],
    ] as const) {
      const byLabel = page.getByLabel(label, { exact: true });
      await expect.soft(byLabel, `"${label}" is not a label for anything`).toHaveCount(1);
      await expect.soft(byLabel, `"${label}" names the wrong field`)
        .toHaveAttribute('placeholder', placeholder);
    }
    // These two have no placeholder to identify them by, so check the type.
    await expect.soft(page.getByLabel('Guests', { exact: true })).toHaveCount(1);
    await expect.soft(page.getByLabel('Price/Night', { exact: true })).toHaveCount(1);
    await expect.soft(page.getByLabel('Description', { exact: true })).toHaveCount(1);

    expect(test.info().errors, 'see the soft assertions above').toHaveLength(0);
  });

  test('icon-only controls say what they do', async () => {
    const page = shared.page;
    await openAddRoom(page);

    const dialog = page.getByRole('dialog');
    for (const name of ['Close', 'Add amenity', 'Add video']) {
      await expect.soft(dialog.getByRole('button', { name, exact: true }),
        `no control announces itself as "${name}"`).toHaveCount(1);
    }
    expect(test.info().errors, 'see the soft assertions above').toHaveLength(0);
  });

  test('a control added after the form opens is named too', async () => {
    // The nameless icon buttons were not only the fixed ones. Each added
    // video and each added photo gets its own remove button, and they are
    // numbered so that four of them are not four identical "Remove video".
    const page = shared.page;
    await openAddRoom(page);

    const dialog = page.getByRole('dialog');
    await page.getByLabel('Videos', { exact: true })
      .fill('https://youtube.com/watch?v=dQw4w9WgXcQ');
    await dialog.getByRole('button', { name: 'Add video', exact: true }).click();

    await expect(dialog.getByRole('button', { name: 'Remove video 1', exact: true }))
      .toHaveCount(1);

    // And the refusal a sighted user sees is attached to the field, so it is
    // read out to somebody standing in it rather than passed over.
    const videos = page.getByLabel('Videos', { exact: true });
    await videos.fill('not a url');
    await dialog.getByRole('button', { name: 'Add video', exact: true }).click();
    await expect(videos).toHaveAttribute('aria-invalid', 'true');

    /*
      Checked by association rather than by its words. This assertion used to
      match the message's text, and RM-012 then changed that message from
      "Enter a valid URL" to one that names the schemes — so the test failed
      on a change that improved exactly the thing it was guarding. The copy
      belongs to the field; what this test is for is that a screen reader is
      told about it. So: the id the field points at is an element that exists,
      carries role="alert", and is not empty.
    */
    const describedBy = await videos.getAttribute('aria-describedby');
    const errorId = (describedBy ?? '').split(/\s+/).find(id => id.endsWith('-video-error'));
    expect(errorId, 'the field does not point at an error message').toBeTruthy();

    // `[id="..."]` and not `#...`: React's useId() mints ids like ":r3:", and
    // a colon is not legal in a CSS id selector — `#:r3:-video-error` matches
    // nothing at all, silently. The attribute selector takes the id verbatim.
    const alert = dialog.locator(`[id="${errorId}"]`);
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert).not.toBeEmpty();
  });

  test('the toggles say which of them are on', async () => {
    // Room type and the amenity chips are buttons that hold a state, and the
    // only thing that said which were chosen was a tint. `aria-pressed` is
    // what makes "Suite, pressed" different from "Suite".
    const page = shared.page;
    await openAddRoom(page);

    const dialog = page.getByRole('dialog');
    // Standard is the default, so exactly one type starts pressed.
    await expect(dialog.getByRole('button', { pressed: true, name: /Standard/ })).toHaveCount(1);

    const suite = dialog.getByRole('button', { name: /Suite/, pressed: false });
    await expect(suite).toHaveCount(1);
    await suite.click();
    await expect(dialog.getByRole('button', { name: /Suite/, pressed: true })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /Standard/, pressed: true })).toHaveCount(0);

    // And the amenity chips, which are independent rather than exclusive.
    const wifi = dialog.getByRole('button', { name: 'WiFi', exact: true });
    await expect(wifi).toHaveAttribute('aria-pressed', 'false');
    await wifi.click();
    await expect(wifi).toHaveAttribute('aria-pressed', 'true');
  });

  test('opening it moves focus inside', async () => {
    const page = shared.page;
    await gotoRooms(page);

    await addRoomButton(page).click();
    await expect(page.getByRole('heading', { name: 'Add Room' })).toBeVisible({ timeout: 10000 });

    expect(await focusIsInside(page, '[role="dialog"]'),
      `focus stayed outside the dialog, on ${await focusDescription(page)}`).toBe(true);
  });

  test('closing it gives focus back to what opened it', async () => {
    const page = shared.page;
    await gotoRooms(page);

    /*
      Opened from the keyboard, not with a click, and that is the point rather
      than a convenience. WebKit does not focus a <button> when it is clicked
      — a deliberate platform behaviour, not a bug here — so on Mobile Safari
      a mouse-opened dialog has `document.body` as the thing it came from and
      there is nothing to hand focus back to. Restoring focus exists for the
      person navigating by keyboard, and for them the opener is focused on
      every engine. The first draft of this test clicked, and failed only on
      Mobile Safari, which is how this got noticed.
    */
    const trigger = addRoomButton(page);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Add Room' })).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Dropping focus on document.body makes a keyboard user restart from the
    // top of the page to get back to where they were.
    await expect(trigger).toBeFocused();
  });

  test('Escape closes it', async () => {
    const page = shared.page;
    await openAddRoom(page);

    await page.keyboard.press('Escape');

    // Asserted on the heading, not on `getByRole('dialog')`. The role did not
    // exist before this fix, so a count of 0 was true whether the modal was
    // open or shut: the first draft of this test passed against the broken
    // code. The heading is there either way, so it can tell them apart.
    await expect(page.getByRole('heading', { name: 'Add Room' })).toHaveCount(0);
  });

  test('Tab stays inside it', async () => {
    const page = shared.page;
    await openAddRoom(page);

    // Enough presses to walk the whole form and wrap. Without a trap, focus
    // leaves after the last control and lands on the page behind the
    // backdrop — which is still being scrolled under a modal that covers it.
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('Tab');
      if (!(await focusIsInside(page, '[role="dialog"]'))) {
        throw new Error(
          `focus left the dialog after ${i + 1} Tabs, onto ${await focusDescription(page)}`,
        );
      }
    }

    // And backwards from the first control, which wraps the other way.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Shift+Tab');
      if (!(await focusIsInside(page, '[role="dialog"]'))) {
        throw new Error(
          `focus left the dialog after ${i + 1} Shift+Tabs, onto ${await focusDescription(page)}`,
        );
      }
    }
  });
  });

  test.describe('the room detail sheet', () => {

  test('a screen reader can find it, and it is named after the room', async () => {
    const page = shared.page;
    await openFirstRoom(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The room's own name, so two open sheets would not be indistinguishable.
    const name = await dialog.getAttribute('aria-label')
      ?? await page.locator('[role="dialog"] h2').first().textContent();
    expect(name?.trim(), 'the sheet has no accessible name').toBeTruthy();
  });

  test('Escape closes it and focus comes back to the card', async () => {
    const page = shared.page;
    const card = await firstCard(page);
    await card.click();
    // Deliberately not waiting for the sheet's own fetch to land. Closing
    // inside that window used to be undone by the late response — see
    // `openDetail` in the rooms page. Waiting first would hide it.
    await expect(page.getByText('Change Status')).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
    // Again the sheet's own content, not the role, so this cannot pass on a
    // version that has no dialog role at all.
    await expect(page.getByText('Change Status')).toHaveCount(0);
    await expect(card).toBeFocused();
  });

  test('a late room fetch does not reopen a sheet that was closed', async () => {
    /*
      The same defect as the test above, made deterministic instead of
      waiting for luck. `openDetail` shows the cached row at once and then
      replaces it with the full one when its request lands; closing the sheet
      inside that window used to be undone by that second write. The real
      window is however slow the request is, which is why this failed about
      one run in three on Mobile Safari and never on Chrome. Held open here,
      so the ordering is the test's to choose.
    */
    const page = shared.page;
    const card = await firstCard(page);

    let release = () => {};
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/api\/rooms\/[^/?]+$/, async route => {
      await held;
      await route.continue();
    });

    try {
      await card.click();
      await expect(page.getByText('Change Status')).toBeVisible({ timeout: 10000 });

      await page.keyboard.press('Escape');
      await expect(page.getByText('Change Status')).toHaveCount(0);

      // Now let the room arrive, to the sheet the user has already dismissed.
      release();
      // Give it longer than it would need, so this cannot pass by being quick.
      await page.waitForTimeout(1500);
      await expect(page.getByText('Change Status'),
        'the dismissed sheet came back when its request landed').toHaveCount(0);
    } finally {
      release();
      await page.unroute(/\/api\/rooms\/[^/?]+$/);
    }
  });

  test('a card can be opened from the keyboard at all', async () => {
    // Found while measuring the rest: the card is a plain `<div>` with an
    // `onClick`, so it is not in the tab order and Enter does nothing. The
    // sheet's dialog semantics are worth little if the only way to reach it
    // is a mouse — and focus cannot be restored to something that cannot
    // hold focus, so this is also what the test above depends on.
    const page = shared.page;
    const card = await firstCard(page);

    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByText('Change Status')).toBeVisible({ timeout: 10000 });
  });

  test('its close button says what it does', async () => {
    const page = shared.page;
    await openFirstRoom(page);

    // The sheet's only icon-only control. The status buttons below it carry
    // an icon *and* a word, so they already read as "Cleaning", "Available".
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }))
      .toHaveCount(1);
  });
  });
});
