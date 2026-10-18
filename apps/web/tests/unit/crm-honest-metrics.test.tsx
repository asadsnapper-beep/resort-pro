/**
 * The CRM only shows numbers something actually records.
 *
 * `CampaignStats` has columns for delivered, opened, clicked and unsubscribed,
 * and the page used to render Open Rate and Click Rate from them. Nothing in
 * the API writes any of the four — there is no open pixel, no click redirect
 * and no Resend webhook — so those were percentages of zero, and the demo
 * seeded 87 opens on 142 sends to make them look alive (CRM QA 2026-10-07,
 * finding 008).
 *
 * These tests assert the absence, which is unusual and deliberate. A test that
 * only checked "Sent is shown" would stay green if somebody re-added the Open
 * Rate tile. When real tracking does ship, deleting this file is the explicit
 * act of re-making the claim — which is the point: it should take a decision,
 * not a copy-paste.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const get = vi.fn();

vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn(), delete: vi.fn(), put: vi.fn() },
}));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const openTab = (label: string) => fireEvent.click(screen.getByText(label));

/** A campaign that went out, with the stats shape the API returns. */
const sentCampaign = {
  id: 'c1', name: 'Eid Promo', subject: 'Eid Mubarak', status: 'SENT',
  recipientCount: 142, sentAt: '2026-09-20T00:00:00.000Z',
  stats: { sent: 138, bounced: 4 },
  _count: { sends: 142 },
};

const analytics = {
  totalContacts: 120,
  subscribed: 118,
  tierCounts: [],
  campaignStats: [
    { campaign: { name: 'Eid Promo', sentAt: '2026-09-20T00:00:00.000Z' }, sent: 138, bounced: 4 },
    { campaign: { name: 'Win-Back', sentAt: '2026-09-27T00:00:00.000Z' }, sent: 61, bounced: 2 },
  ],
  topGuests: [],
};

beforeEach(() => { get.mockReset(); });
afterEach(cleanup);

describe('a campaign that has been sent', () => {
  beforeEach(() => { get.mockResolvedValue({ data: { data: [sentCampaign] } }); });

  it('reports what went out and what failed', async () => {
    render(<CRMPage />);
    openTab('Campaigns');

    expect(await screen.findByText('Eid Promo')).toBeTruthy();
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('138')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('claims nothing about opens or clicks', async () => {
    render(<CRMPage />);
    openTab('Campaigns');
    await screen.findByText('Eid Promo');

    expect(screen.queryByText('Opened')).toBeNull();
    expect(screen.queryByText('Clicked')).toBeNull();
  });
});

describe('the analytics tab', () => {
  beforeEach(() => { get.mockResolvedValue({ data: { data: analytics } }); });

  it('shows no Open Rate and no Click Rate', async () => {
    render(<CRMPage />);
    openTab('Analytics');
    await screen.findByText('Total Contacts');

    expect(screen.queryByText('Open Rate')).toBeNull();
    expect(screen.queryByText('Click Rate')).toBeNull();
    // Nor a bare percentage where those tiles used to be.
    expect(screen.queryByText(/^\d+%$/)).toBeNull();
  });

  it('totals the sends and the failures across the campaigns it was given', async () => {
    render(<CRMPage />);
    openTab('Analytics');

    expect(await screen.findByText('Sent (last 5 campaigns)')).toBeTruthy();
    expect(screen.getByText('199')).toBeTruthy();   // 138 + 61
    expect(screen.getByText('Failed to send')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();     // 4 + 2
  });

  it('breaks each campaign down by delivery, not by engagement', async () => {
    render(<CRMPage />);
    openTab('Analytics');

    expect(await screen.findByText('Recent Campaign Delivery')).toBeTruthy();
    expect(screen.queryByText('Recent Campaign Performance')).toBeNull();
    expect(screen.getByText('Win-Back')).toBeTruthy();
  });
});
