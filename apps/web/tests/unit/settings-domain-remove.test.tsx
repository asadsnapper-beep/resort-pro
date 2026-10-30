/**
 * Taking a resort's own domain off their site asks first.
 *
 * One click on a small trash icon used to do it outright: the address they
 * printed on their cards stops leading to their site and the SSL status goes
 * with it. The admin panel asked before doing exactly the same thing to the
 * same record; the owner's own page did not. The second half is that the
 * failure path was `catch { }`, so a removal that failed and one that worked
 * looked identical from the outside. (Website Builder QA 2026-10-28, WB-012.)
 *
 * The page is mounted rather than the dialog, because neither half of this
 * lives in ConfirmDialog — both are in how the button is wired to it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

const put = vi.fn();
const get = vi.fn();
const toastCalls: unknown[] = [];

vi.mock('@/lib/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: vi.fn() },
  tenantApi: {
    getSettings: vi.fn(),
    getStayTimePolicy: vi.fn(),
    getEmailSettings: vi.fn(),
  },
  paymentGatewayApi: { list: vi.fn() },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: (a: unknown) => { toastCalls.push(a); } }));
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    tenant: { id: 't1', slug: 'palm-paradise-resort', name: 'Palm Paradise' },
    token: 'test-token',
    user: { role: 'OWNER' },
  }),
}));
// Stable identities on purpose. The page's domain effect depends on
// `data.data.data`, so a mock that returns a fresh object each render makes it
// set state, re-render and run again — the test harness spins until the worker
// dies, which is not a failure of the code under test.
const q = vi.hoisted(() => {
  const result = {
    data: { data: { data: { customDomain: 'www.palmparadise.com', domainVerified: true, name: 'Palm Paradise' } } },
    isLoading: false,
  };
  const client = { invalidateQueries: () => {} };
  const mutation = { mutate: () => {}, isPending: false };
  return { result, client, mutation };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => q.client,
  useMutation: () => q.mutation,
  useQuery: () => q.result,
}));
// Child tabs are whole features of their own; none of them is this test's subject.
vi.mock('@/components/dashboard/ConnectedResortsTab', () => ({ ConnectedResortsTab: () => null }));
vi.mock('@/components/settings/RoomTypeSettings', () => ({ RoomTypeSettings: () => null }));

import SettingsPage from '@/app/(dashboard)/dashboard/settings/page';

/** Open the Domain tab, where the custom-domain card lives. */
function openDomainTab() {
  render(<SettingsPage />);
  fireEvent.click(screen.getByRole('button', { name: /^Custom Domain$/i }));
  return screen.getByRole('button', { name: /Remove custom domain www\.palmparadise\.com/i });
}

beforeEach(() => {
  put.mockReset().mockResolvedValue({ data: { success: true } });
  get.mockReset().mockResolvedValue({ data: { data: {} } });
  toastCalls.length = 0;
});

afterEach(cleanup);

describe('removing a custom domain', () => {
  it('does not remove it on the first click', async () => {
    const trash = openDomainTab();
    fireEvent.click(trash);
    expect(put).not.toHaveBeenCalled();
  });

  it('asks, naming the domain and what stops working', async () => {
    const trash = openDomainTab();
    fireEvent.click(trash);
    expect(await screen.findByText(/Remove this domain\?/i)).toBeTruthy();
    expect(screen.getByText('www.palmparadise.com')).toBeTruthy();
    expect(screen.getByText(/can.t be undone/i)).toBeTruthy();
  });

  it('removes it once confirmed', async () => {
    const trash = openDomainTab();
    fireEvent.click(trash);
    fireEvent.click(await screen.findByRole('button', { name: /^Remove domain$/i }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(
      '/tenant/domain', { domain: null }, expect.anything(),
    ));
  });

  it('leaves the domain alone if the owner cancels', async () => {
    const trash = openDomainTab();
    fireEvent.click(trash);
    fireEvent.click(await screen.findByRole('button', { name: /^Cancel$/i }));
    expect(put).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(/Remove this domain\?/i)).toBeNull());
  });

  it('says so when the removal fails, instead of going quiet', async () => {
    // The old `catch { }` swallowed this: no toast, no change on screen, and
    // the domain still live. The owner's only clue was reloading the page.
    put.mockRejectedValue({ response: { data: { error: 'Domain is locked by support' } } });
    const trash = openDomainTab();
    fireEvent.click(trash);
    fireEvent.click(await screen.findByRole('button', { name: /^Remove domain$/i }));
    expect(await screen.findByText(/Domain is locked by support/i)).toBeTruthy();
  });

  it('keeps the dialog open on a failure, so the attempt is not lost', async () => {
    put.mockRejectedValue(new Error('network down'));
    const trash = openDomainTab();
    fireEvent.click(trash);
    fireEvent.click(await screen.findByRole('button', { name: /^Remove domain$/i }));
    expect(await screen.findByText(/network down/i)).toBeTruthy();
    expect(screen.getByText(/Remove this domain\?/i)).toBeTruthy();
  });
});
