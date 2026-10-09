/**
 * A CRM action that fails now says so.
 *
 * Five handlers awaited a mutation with no `catch` at all — recalc score,
 * delete campaign, pause/resume sequence, add step, delete template. A failure
 * was an unhandled promise rejection: the click did nothing visible and
 * nothing explained why. The rest of CRM-012 (2026-10-07), the half that the
 * load-failure fix did not reach.
 *
 * Two of these matter more than the others:
 *
 *  - Delete campaign. The API was taught to refuse a campaign that has gone
 *    out and to explain that it is a record of emails real people received.
 *    With no catch, that sentence reached nobody.
 *  - Pause sequence. "I paused it" is the one thing an owner must not be
 *    wrong about while the sequence keeps sending email.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();
const put = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    delete: (...a: unknown[]) => del(...a),
    put: (...a: unknown[]) => put(...a),
  },
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const rejectWith = (error: string) => Promise.reject({ response: { data: { error } } });

let alerted: string[] = [];
let confirmed = true;

const openTab = (label: string) => fireEvent.click(screen.getByText(label));

beforeEach(() => {
  get.mockReset(); post.mockReset(); del.mockReset(); put.mockReset();
  alerted = [];
  confirmed = true;
  vi.stubGlobal('alert', (m: string) => { alerted.push(m); });
  vi.stubGlobal('confirm', () => confirmed);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// DRAFT, because the delete button only renders for DRAFT and SCHEDULED. The
// refusal is reachable anyway, and this is exactly how: the list was fetched
// while the campaign was still a draft, somebody sent it, and the button is
// still on screen. A stale list is the normal case, not an exotic one.
const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Eid Promo', subject: 'Hi', status: 'DRAFT',
  recipientCount: 40, _count: { sends: 40 }, ...over,
});

const sequence = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Welcome', trigger: 'BOOKING_CONFIRMED', status: 'ACTIVE',
  steps: [], _count: { enrollments: 3 }, ...over,
});

describe('deleting a campaign the API refuses to delete', () => {
  const refusal = 'This campaign is SENT and cannot be deleted — it is a record of emails that went out.';

  it("shows the API's reason instead of doing nothing", async () => {
    get.mockResolvedValue({ data: { data: [campaign()] } });
    del.mockImplementation(() => rejectWith(refusal));

    render(<CRMPage />);
    openTab('Campaigns');
    fireEvent.click(await screen.findByLabelText('Delete campaign'));

    await waitFor(() => expect(alerted).toContain(refusal));
    // Still listed, because the refusal is the correct outcome.
    expect(screen.getByText('Eid Promo')).toBeTruthy();
  });

  it('says something even when the API gives no reason', async () => {
    get.mockResolvedValue({ data: { data: [campaign()] } });
    del.mockRejectedValue(new Error('network'));

    render(<CRMPage />);
    openTab('Campaigns');
    fireEvent.click(await screen.findByLabelText('Delete campaign'));

    await waitFor(() => expect(alerted).toHaveLength(1));
    expect(alerted[0]).toMatch(/Could not delete/);
  });
});

describe('pausing a sequence that will not pause', () => {
  it('does not let the owner believe the emails have stopped', async () => {
    get.mockResolvedValue({ data: { data: [sequence()] } });
    put.mockRejectedValue(new Error('500'));

    render(<CRMPage />);
    openTab('Sequences');
    fireEvent.click(await screen.findByText('Pause'));

    await waitFor(() => expect(alerted).toHaveLength(1));
    expect(alerted[0]).toMatch(/Could not pause/);
    expect(alerted[0]).toMatch(/still ACTIVE/);
    // And the pill has not flipped, which is the truth of it.
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });
});

describe('adding a step that the API rejects', () => {
  it('shows the reason inline — the button used to just do nothing', async () => {
    get.mockResolvedValue({ data: { data: [sequence()] } });
    post.mockImplementation(() => rejectWith('A sequence can hold at most 10 steps'));

    render(<CRMPage />);
    openTab('Sequences');
    fireEvent.click(await screen.findByText(/Steps/));

    fireEvent.change(screen.getByPlaceholderText('Email subject'), { target: { value: 'Day 1' } });
    fireEvent.change(screen.getByPlaceholderText(/Email body/), { target: { value: '<p>Hi</p>' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Step/ }));

    expect(await screen.findByText('A sequence can hold at most 10 steps')).toBeTruthy();
  });

  it('asks for the missing fields rather than ignoring the click', async () => {
    get.mockResolvedValue({ data: { data: [sequence()] } });

    render(<CRMPage />);
    openTab('Sequences');
    fireEvent.click(await screen.findByText(/Steps/));
    fireEvent.click(screen.getByRole('button', { name: /Add Step/ }));

    expect(await screen.findByText(/both required/)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('deleting a template that is not there', () => {
  it('reports it', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 't1', name: 'Welcome', subject: 'Hi', html: '<p>x</p>', createdAt: '2026-01-01' }] } });
    del.mockImplementation(() => rejectWith('Template not found'));

    render(<CRMPage />);
    openTab('Templates');
    fireEvent.click(await screen.findByLabelText('Delete template'));

    await waitFor(() => expect(alerted).toContain('Template not found'));
  });
});

describe('a cancelled confirm', () => {
  it('sends no request and says nothing', async () => {
    confirmed = false;
    get.mockResolvedValue({ data: { data: [campaign()] } });

    render(<CRMPage />);
    openTab('Campaigns');
    fireEvent.click(await screen.findByLabelText('Delete campaign'));

    await waitFor(() => expect(del).not.toHaveBeenCalled());
    expect(alerted).toHaveLength(0);
  });
});
