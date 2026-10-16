/**
 * The contact sheet, and the only place a tag can be put on a guest.
 *
 * `GET /crm/contacts/:id` returns the score, consent, tags, stays, email and
 * sequence enrolments; `POST /crm/contacts/:id/tags` applies and removes a
 * tag. No screen called either (CRM QA 2026-10-07, finding 016) — which is the
 * real reason the QA recorded tags as "Fail at assignment".
 *
 * Two of these tests guard against claims rather than bugs:
 *
 *  - the sheet must not report whether an email was opened. The payload
 *    carries `openedAt` and nothing in the API writes it, so showing it would
 *    put back exactly what d56458a removed from Analytics.
 *  - a guest with no consent row counts as *subscribed*, because that is the
 *    rule the campaign audience applies. Showing "unknown" would be a
 *    different claim from the one the sender acts on.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: vi.fn(), put: vi.fn() },
}));

import { ContactDetailSheet } from '@/components/crm/ContactDetailSheet';

const contact = (over: Record<string, unknown> = {}) => ({
  id: 'g1', firstName: 'Rafiq', lastName: 'Islam', email: 'rafiq@example.com',
  score: { score: 79, tier: 'GOLD', totalStays: 4, totalSpend: 48000 },
  consent: null,
  tags: [],
  bookings: [],
  emailSends: [],
  enrollments: [],
  ...over,
});

/** The sheet fetches the contact; the tag list only when the picker opens. */
const route = (detail: unknown, tags: unknown[] = []) => {
  get.mockImplementation((url: string) => {
    if (url === '/crm/tags') return Promise.resolve({ data: { data: tags } });
    return Promise.resolve({ data: { data: detail } });
  });
};

const open = (over: Record<string, unknown> = {}) =>
  render(<ContactDetailSheet contactId="g1" token="tok" onClose={vi.fn()} {...over} />);

beforeEach(() => {
  get.mockReset(); post.mockReset();
  vi.stubGlobal('alert', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('opening a contact', () => {
  it('fetches the detail endpoint nobody was calling, and shows the score', async () => {
    route(contact());
    open();

    expect(await screen.findByText('Rafiq Islam')).toBeTruthy();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/crm/contacts/g1', expect.anything()));
    expect(screen.getByText('Gold')).toBeTruthy();
    expect(screen.getByText('79')).toBeTruthy();
  });

  it('fetches nothing while closed', async () => {
    route(contact());
    render(<ContactDetailSheet contactId={null} token="tok" onClose={vi.fn()} />);

    await waitFor(() => expect(get).not.toHaveBeenCalled());
  });

  it('says a failed load failed', async () => {
    get.mockRejectedValue(new Error('500'));
    open();

    expect(await screen.findByText('Could not load this contact')).toBeTruthy();
  });
});

describe('what it must not claim', () => {
  it('never reports an email as opened, because nothing records that', async () => {
    route(contact({
      emailSends: [{
        id: 'e1', subject: 'Eid Mubarak', status: 'SENT',
        createdAt: '2026-09-20T00:00:00.000Z',
        // Present in the real payload, written by nothing.
        openedAt: '2026-09-20T01:00:00.000Z',
      }],
    }));
    open();

    expect(await screen.findByText('Eid Mubarak')).toBeTruthy();
    expect(screen.queryByText(/Opened/i)).toBeNull();
    expect(screen.queryByText(/opened/)).toBeNull();
  });

  it('treats a missing consent row as subscribed, matching the campaign audience', async () => {
    route(contact({ consent: null }));
    open();

    expect(await screen.findByText(/Subscribed/)).toBeTruthy();
    expect(screen.queryByText(/Unsubscribed/)).toBeNull();
  });

  it('and says plainly when somebody has opted out', async () => {
    route(contact({ consent: { subscribed: false, unsubscribedAt: '2026-09-01T00:00:00.000Z' } }));
    open();

    expect(await screen.findByText(/Unsubscribed/)).toBeTruthy();
    expect(screen.getByText(/skip this guest/)).toBeTruthy();
  });
});

describe('putting a tag on a guest', () => {
  it('sends add, then re-reads so the sheet shows the truth', async () => {
    route(contact(), [{ id: 't1', name: 'Corporate', color: '#183153' }]);
    open();
    await screen.findByText('Rafiq Islam');

    fireEvent.click(screen.getByText('Add tag'));
    fireEvent.click(await screen.findByText('Corporate'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/crm/contacts/g1/tags', { tagId: 't1', action: 'add' }, expect.anything(),
    ));
    // Two detail reads: the first render and the one after the write.
    const detailReads = get.mock.calls.filter(([u]) => u === '/crm/contacts/g1');
    expect(detailReads.length).toBeGreaterThanOrEqual(2);
  });

  it('tells the list behind it, which also renders tags', async () => {
    const onChanged = vi.fn();
    route(contact(), [{ id: 't1', name: 'Corporate', color: '#183153' }]);
    open({ onChanged });
    await screen.findByText('Rafiq Islam');

    fireEvent.click(screen.getByText('Add tag'));
    fireEvent.click(await screen.findByText('Corporate'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('removes one', async () => {
    route(contact({ tags: [{ tag: { id: 't1', name: 'Corporate', color: '#183153' } }] }));
    open();

    fireEvent.click(await screen.findByLabelText('Remove tag Corporate'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/crm/contacts/g1/tags', { tagId: 't1', action: 'remove' }, expect.anything(),
    ));
  });

  it('offers only tags the guest does not already have', async () => {
    route(
      contact({ tags: [{ tag: { id: 't1', name: 'Corporate', color: '#183153' } }] }),
      [{ id: 't1', name: 'Corporate', color: '#183153' }, { id: 't2', name: 'Honeymoon', color: '#c43c3c' }],
    );
    open();
    await screen.findByText('Rafiq Islam');

    fireEvent.click(screen.getByText('Add tag'));

    expect(await screen.findByText('Honeymoon')).toBeTruthy();
    // "Corporate" is on the guest, so it appears once as an applied tag and
    // must not appear again as something to add.
    expect(screen.getAllByText('Corporate')).toHaveLength(1);
  });

  it('points at the Tags tab when no tag exists to apply', async () => {
    route(contact(), []);
    open();
    await screen.findByText('Rafiq Islam');

    fireEvent.click(screen.getByText('Add tag'));

    expect(await screen.findByText(/No tags exist yet/)).toBeTruthy();
  });

  it('reports a refusal rather than silently not applying it', async () => {
    route(contact(), [{ id: 't1', name: 'Corporate', color: '#183153' }]);
    post.mockRejectedValue({ response: { data: { error: 'Guest not found' } } });
    open();
    await screen.findByText('Rafiq Islam');

    fireEvent.click(screen.getByText('Add tag'));
    fireEvent.click(await screen.findByText('Corporate'));

    await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith('Guest not found'));
  });
});
