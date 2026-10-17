/**
 * "Run Now" no longer emails guests on the click.
 *
 * The button was labelled "▶ Run Now" and sent birthday and anniversary email
 * the moment it was pressed — no recipient list, no confirmation step (CRM QA
 * 2026-10-07, finding 011). Email cannot be recalled, and each send also
 * suppresses that guest for 300 days, so a mistaken press cancels the real
 * message too.
 *
 * It is now two steps: ask who is due, read the names, then send. The
 * assertion that carries the weight is the negative one — that pressing the
 * first button does not send.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: vi.fn(), put: vi.fn() },
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const analytics = {
  totalContacts: 20, subscribed: 20, tierCounts: [], campaignStats: [], topGuests: [],
};

const previewBody = (birthday: { id: string; firstName: string; email: string }[], anniversary: typeof birthday = []) => ({
  data: { data: { dryRun: true, birthday: { found: birthday.length, recipients: birthday }, anniversary: { found: anniversary.length, recipients: anniversary } } },
});

const rafiq = { id: 'g1', firstName: 'Rafiq', email: 'rafiq@example.com' };
const nadia = { id: 'g2', firstName: 'Nadia', email: 'nadia@example.com' };

/** Every non-dry-run POST to the automation route — i.e. real email. */
const realSends = () => post.mock.calls.filter(
  ([url, body]) => url === '/crm/automation/run-daily' && (body as { dryRun?: boolean })?.dryRun !== true,
);

const openAnalytics = async () => {
  render(<CRMPage />);
  fireEvent.click(screen.getByText('Analytics'));
  await screen.findByText('Total Contacts');
};

beforeEach(() => {
  get.mockReset(); post.mockReset();
  get.mockResolvedValue({ data: { data: analytics } });
  vi.stubGlobal('alert', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('asking who is due', () => {
  it('sends nothing — it only asks', async () => {
    post.mockResolvedValue(previewBody([rafiq, nadia]));
    await openAnalytics();

    fireEvent.click(screen.getByText('See who is due'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/crm/automation/run-daily', { dryRun: true }, expect.anything(),
    ));
    expect(realSends()).toHaveLength(0);
  });

  it('shows the names and addresses, not just a count', async () => {
    post.mockResolvedValue(previewBody([rafiq], [nadia]));
    await openAnalytics();
    fireEvent.click(screen.getByText('See who is due'));

    expect(await screen.findByText(/Rafiq/)).toBeTruthy();
    expect(screen.getByText(/rafiq@example.com/)).toBeTruthy();
    expect(screen.getByText(/Nadia/)).toBeTruthy();
    expect(screen.getByText('This will email 2 guests')).toBeTruthy();
  });

  it('offers nothing to send when nobody is due', async () => {
    post.mockResolvedValue(previewBody([]));
    await openAnalytics();
    fireEvent.click(screen.getByText('See who is due'));

    expect(await screen.findByText('Nothing to send today')).toBeTruthy();
    // No jest-dom matchers are set up in this app, so check the property.
    expect((screen.getByText('Nothing to send').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('then confirming', () => {
  it('sends only after somebody has seen the list', async () => {
    post.mockResolvedValue(previewBody([rafiq, nadia]));
    await openAnalytics();
    fireEvent.click(screen.getByText('See who is due'));
    await screen.findByText(/Rafiq/);

    expect(realSends()).toHaveLength(0);

    post.mockResolvedValue({ data: { data: {
      birthday: { found: 2, sent: 2 }, anniversary: { found: 0, sent: 0 },
    } } });
    fireEvent.click(screen.getByText('Send to 2'));

    await waitFor(() => expect(realSends()).toHaveLength(1));
    expect(await screen.findByText(/Birthday: 2\/2 sent/)).toBeTruthy();
  });

  it('cancelling closes the list and sends nothing', async () => {
    post.mockResolvedValue(previewBody([rafiq]));
    await openAnalytics();
    fireEvent.click(screen.getByText('See who is due'));
    await screen.findByText(/Rafiq/);

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => expect(screen.queryByText(/Rafiq/)).toBeNull());
    expect(realSends()).toHaveLength(0);
    // And the first button is back, so the flow can be restarted.
    expect(screen.getByText('See who is due')).toBeTruthy();
  });
});

describe('when the preview itself fails', () => {
  it('says so and still sends nothing', async () => {
    post.mockRejectedValue({ response: { data: { error: 'Database unavailable' } } });
    await openAnalytics();

    fireEvent.click(screen.getByText('See who is due'));

    await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith('Database unavailable'));
    expect(realSends()).toHaveLength(0);
    expect(screen.queryByText(/This will email/)).toBeNull();
  });
});
