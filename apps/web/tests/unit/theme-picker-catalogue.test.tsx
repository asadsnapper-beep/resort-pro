/**
 * What the theme picker shows when the catalogue cannot be loaded.
 *
 * The fallback to three free themes is deliberate — a wall of locks during an
 * outage is worse than three usable themes — but it was shown silently. An
 * owner who had paid for a theme opened this panel during an outage, found
 * three free themes, no trace of the one they bought, and nothing on the page
 * saying the list was incomplete rather than the purchase gone. The outage
 * was invisible to us at the same time. (Website Builder QA 2026-10-28,
 * WB-012.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import { ThemePicker } from '@/components/dashboard/website/ThemePicker';

const BOUGHT = {
  key: 'wb004-uploaded', name: 'WB004 Uploaded', description: 'A theme this resort paid for',
  isPremium: true, tags: ['Bold'], owned: true, isFree: false,
};

const okWith = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

let fetchMock: ReturnType<typeof vi.fn>;
const stub = (impl: () => unknown) => {
  fetchMock = vi.fn(async () => impl());
  vi.stubGlobal('fetch', fetchMock);
};

const picker = () =>
  render(<ThemePicker currentTheme="luxe" slug="palm-paradise-resort" onSelect={() => {}} />);

const notice = () => screen.queryByText(/Could not load your theme catalogue/i);

beforeEach(() => stub(() => okWith([BOUGHT])));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('when the catalogue loads', () => {
  it('shows what the API returned', async () => {
    picker();
    expect(await screen.findByText('WB004 Uploaded')).toBeTruthy();
  });

  it('says nothing about a failure', async () => {
    picker();
    await screen.findByText('WB004 Uploaded');
    expect(notice()).toBeNull();
  });

  it('treats an empty catalogue as an answer, not a failure', async () => {
    // Nothing published yet is a real state. It must not wipe the free themes
    // the fallback guarantees, and must not claim an outage either.
    stub(() => okWith([]));
    picker();
    expect(await screen.findByText('Luxe Gold')).toBeTruthy();
    expect(notice()).toBeNull();
  });
});

describe('when it cannot be loaded', () => {
  const failures: [string, () => unknown][] = [
    ['the request throws',        () => { throw new Error('ECONNREFUSED'); }],
    // A well-formed success envelope behind a non-2xx status. Only the
    // `res.ok` check catches this one — with a malformed body the next test's
    // check catches it too, which is how a weak fixture let a mutation of
    // `res.ok` survive.
    ['the API answers 500 with a body that looks fine',
                                  () => ({ ok: false, status: 500, json: async () => ({ success: true, data: [BOUGHT] }) })],
    ['the body is not JSON',      () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } })],
    ['the body says success:false', () => ({ ok: true, status: 200, json: async () => ({ success: false }) })],
    ['data is not a list',        () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { oops: 1 } }) })],
  ];

  for (const [label, impl] of failures) {
    it(`says so when ${label}`, async () => {
      // The last three used to fall through the success condition rather than
      // fail, which left the fallback in place with nothing said.
      stub(impl);
      picker();
      expect(await screen.findByText(/Could not load your theme catalogue/i)).toBeTruthy();
    });
  }

  it('still leaves the free themes usable', async () => {
    stub(() => { throw new Error('ECONNREFUSED'); });
    picker();
    await screen.findByText(/Could not load your theme catalogue/i);
    expect(screen.getByText('Luxe Gold')).toBeTruthy();
  });

  it('says a bought theme is missing rather than gone', async () => {
    stub(() => { throw new Error('ECONNREFUSED'); });
    picker();
    expect(await screen.findByText(/has not been lost/i)).toBeTruthy();
  });

  it('says the live website is unaffected', async () => {
    stub(() => { throw new Error('ECONNREFUSED'); });
    picker();
    expect(await screen.findByText(/live website is unaffected/i)).toBeTruthy();
  });

  it('announces itself to a screen reader', async () => {
    stub(() => { throw new Error('ECONNREFUSED'); });
    picker();
    await screen.findByText(/Could not load your theme catalogue/i);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('can be retried, and clears the notice when the retry works', async () => {
    let attempt = 0;
    stub(() => {
      attempt += 1;
      if (attempt === 1) throw new Error('ECONNREFUSED');
      return okWith([BOUGHT]);
    });
    picker();
    await screen.findByText(/Could not load your theme catalogue/i);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('WB004 Uploaded')).toBeTruthy();
    await waitFor(() => expect(notice()).toBeNull());
  });

  it('keeps the notice when the retry fails too', async () => {
    stub(() => { throw new Error('ECONNREFUSED'); });
    picker();
    await screen.findByText(/Could not load your theme catalogue/i);
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(notice()).toBeTruthy();
  });
});
