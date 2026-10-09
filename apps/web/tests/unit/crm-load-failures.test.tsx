/**
 * The CRM stops reporting a broken backend as an empty resort.
 *
 * Four of the five tabs fetched their list in a try/catch whose catch body was
 * the word "ignore" (CRM QA 2026-10-07, finding 012). So when Templates and
 * Analytics were both returning 500 — which they were during that QA run — the
 * screen said "No templates yet". An owner reads that as "nothing here", not
 * "the server is down", and never reports it. That is the bug: not the 500,
 * the silence about it.
 *
 * Each test below asserts both halves — that the failure is named, AND that
 * the reassuring empty-state copy is absent. Asserting only the first would
 * still pass if both rendered at once.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();

vi.mock('@/lib/api', () => ({ api: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), delete: vi.fn(), put: vi.fn() } }));
vi.mock('@/store/auth', () => ({ useAuthStore: () => ({ token: 'tok' }) }));

import CRMPage from '@/app/(dashboard)/dashboard/crm/page';

const down = () => get.mockRejectedValue(new Error('500'));

/** Move to a tab by its label in the tab strip. */
const openTab = (label: string) => fireEvent.click(screen.getByText(label));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});
afterEach(cleanup);

describe('a tab whose list will not load', () => {
  it('says so on Contacts, and drops the "0 total contacts" line', async () => {
    down();
    render(<CRMPage />);

    expect(await screen.findByText('Could not load contacts')).toBeTruthy();
    expect(screen.queryByText('No contacts found')).toBeNull();
    // This read "0 total contacts" next to the failure, which is its own lie.
    expect(screen.queryByText(/total contacts/)).toBeNull();
  });

  it.each([
    ['Campaigns', 'Could not load campaigns', 'No campaigns yet. Create your first one!'],
    ['Sequences', 'Could not load sequences', 'No sequences yet. Automate your guest communication!'],
    ['Templates', 'Could not load templates', 'No templates yet'],
  ])('says so on %s rather than drawing the empty state', async (tab, failure, emptyCopy) => {
    down();
    render(<CRMPage />);
    openTab(tab);

    expect(await screen.findByText(failure)).toBeTruthy();
    expect(screen.queryByText(emptyCopy)).toBeNull();
  });

  it('says so on Analytics', async () => {
    down();
    render(<CRMPage />);
    openTab('Analytics');

    expect(await screen.findByText('Could not load analytics')).toBeTruthy();
  });
});

describe('the retry button', () => {
  it('fetches again, and the list arrives', async () => {
    down();
    render(<CRMPage />);
    openTab('Campaigns');
    await screen.findByText('Could not load campaigns');

    get.mockResolvedValue({
      data: { data: [{
        id: 'c1', name: 'Eid Promo', subject: 'Hi', status: 'DRAFT',
        recipientCount: 0, _count: { sends: 0 },
      }] },
    });
    fireEvent.click(screen.getByText('Try again'));

    expect(await screen.findByText('Eid Promo')).toBeTruthy();
    expect(screen.queryByText('Could not load campaigns')).toBeNull();
  });
});

describe('a resort that genuinely has nothing yet', () => {
  it('still sees the empty state, not an error', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    render(<CRMPage />);
    openTab('Campaigns');

    expect(await screen.findByText('No campaigns yet. Create your first one!')).toBeTruthy();
    expect(screen.queryByText('Could not load campaigns')).toBeNull();
  });
});

describe('saving a template that the API rejects', () => {
  it('shows the reason instead of leaving the form sitting there', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    post.mockRejectedValue({ response: { data: { error: 'A template with that name already exists' } } });

    render(<CRMPage />);
    openTab('Templates');
    fireEvent.click(await screen.findByText('New Template'));

    fireEvent.change(screen.getByPlaceholderText('Welcome Email'), { target: { value: 'Welcome' } });
    fireEvent.change(screen.getByPlaceholderText('Welcome to {{tenantName}}!'), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByPlaceholderText('<h2>Hi {{guestName}},</h2>'), { target: { value: '<p>Hi</p>' } });
    fireEvent.click(screen.getByText('Save Template'));

    expect(await screen.findByText('A template with that name already exists')).toBeTruthy();
    // And the form is still open with the work in it, not closed as if saved.
    await waitFor(() => expect(screen.getByPlaceholderText('Welcome Email')).toBeTruthy());
  });
});
