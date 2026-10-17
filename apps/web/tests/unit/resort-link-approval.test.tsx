/**
 * Answering a request to connect this resort.
 *
 * The one thing both surfaces must say before anything is clicked: full access
 * really is everything this owner can do, billing included. Somebody handing
 * that over deserves to read it first, so it is asserted here rather than left
 * to survive a redesign by luck.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.hoisted(() => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() { return data.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
  }
});

const incoming = vi.fn();
const byToken = vi.fn();
const approve = vi.fn();
const declineReq = vi.fn();
const authState = { user: { role: 'OWNER' }, token: 'tok' } as Record<string, unknown>;

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  resortGroupApi: {
    incoming: () => incoming(),
    byToken: (t: string) => byToken(t),
    approve: (id: string, access: string) => approve(id, access),
    decline: (id: string) => declineReq(id),
  },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select(authState),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { ResortLinkDecision } from '@/components/dashboard/ResortLinkDecision';
import { ResortLinkBanner } from '@/components/dashboard/ResortLinkBanner';
import ResortLinkPage from '@/app/resort-link/[token]/page';

const request = {
  id: 'req-1', groupName: 'Sea Pearl Group', askerName: 'Asha Rahman',
  askerEmail: 'asha@example.com', askerResort: 'Sea Pearl', resortName: 'Hill View',
};

let client: QueryClient;
function mount(ui: React.ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const rejectWith = (status: number) => {
  const err = new Error('nope') as Error & { response: { status: number } };
  err.response = { status };
  return err;
};

beforeEach(() => {
  incoming.mockReset();
  byToken.mockReset();
  approve.mockReset();
  declineReq.mockReset();
  authState.user = { role: 'OWNER' };
  authState.token = 'tok';
});
afterEach(cleanup);

describe('the choice itself', () => {
  it('says what full access really includes before anything is clicked', () => {
    mount(<ResortLinkDecision request={request} />);
    expect(screen.getByText(/everything you can in this resort, including its billing/)).toBeTruthy();
  });

  it('promises the figures stay figures', () => {
    mount(<ResortLinkDecision request={request} />);
    expect(screen.getByText(/cannot open this resort or see a single guest/)).toBeTruthy();
  });

  it('grants full access', async () => {
    approve.mockResolvedValue({});
    mount(<ResortLinkDecision request={request} />);

    fireEvent.click(screen.getByText('Give full access'));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('req-1', 'FULL'));
    expect(await screen.findByText(/they can now open this resort/)).toBeTruthy();
  });

  it('grants figures only', async () => {
    approve.mockResolvedValue({});
    mount(<ResortLinkDecision request={request} />);

    fireEvent.click(screen.getByText('Share the figures only'));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('req-1', 'NUMBERS_ONLY'));
  });

  it('declines', async () => {
    declineReq.mockResolvedValue({});
    mount(<ResortLinkDecision request={request} />);

    fireEvent.click(screen.getByText('Decline'));
    await waitFor(() => expect(declineReq).toHaveBeenCalledWith('req-1'));
    expect(await screen.findByText(/Nothing was shared/)).toBeTruthy();
  });

  it('says so, and grants nothing, when the answer does not go through', async () => {
    approve.mockRejectedValue(new Error('500'));
    mount(<ResortLinkDecision request={request} />);

    fireEvent.click(screen.getByText('Give full access'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText(/they can now open this resort/)).toBeNull();
  });
});

describe('the banner', () => {
  it('stays away when nothing is waiting', async () => {
    incoming.mockResolvedValue({ data: { data: [] } });
    mount(<ResortLinkBanner />);
    await waitFor(() => expect(client.getQueryState(['resort-link-requests'])?.status).toBe('success'));
    expect(screen.queryByText('Review')).toBeNull();
  });

  it('never asks on behalf of staff who cannot answer', async () => {
    authState.user = { role: 'RECEPTIONIST' };
    incoming.mockResolvedValue({ data: { data: [request] } });
    mount(<ResortLinkBanner />);

    await waitFor(() => expect(screen.queryByText('Review')).toBeNull());
    expect(incoming).not.toHaveBeenCalled();
  });

  it('tells the owner who is asking', async () => {
    incoming.mockResolvedValue({ data: { data: [request] } });
    mount(<ResortLinkBanner />);
    expect(await screen.findByText('Asha Rahman')).toBeTruthy();
  });

  it('opens the same choice the email would', async () => {
    incoming.mockResolvedValue({ data: { data: [request] } });
    mount(<ResortLinkBanner />);

    fireEvent.click(await screen.findByText('Review'));
    expect(await screen.findByText('Give full access')).toBeTruthy();
  });
});

describe('the page the emailed link opens', () => {
  const page = () => mount(<ResortLinkPage params={{ token: 'a'.repeat(64) }} />);

  it('asks an unauthenticated reader to sign in, and looks nothing up', async () => {
    authState.token = null;
    page();
    expect(await screen.findByText('Sign in to answer this')).toBeTruthy();
    expect(byToken).not.toHaveBeenCalled();
  });

  it('shows the choice to the right owner', async () => {
    byToken.mockResolvedValue({ data: { data: request } });
    page();
    expect(await screen.findByText('Give full access')).toBeTruthy();
    // The heading names the resort being asked about, split across two nodes.
    expect(screen.getByRole('heading', { name: /Hill View/ })).toBeTruthy();
  });

  it('gives a forwarded link nothing to open', async () => {
    byToken.mockRejectedValue(rejectWith(404));
    page();
    expect(await screen.findByText('This link is not for this account')).toBeTruthy();
    expect(screen.queryByText('Give full access')).toBeNull();
  });

  it('says when the request has already been answered or has expired', async () => {
    byToken.mockRejectedValue(rejectWith(410));
    page();
    expect(await screen.findByText('This request is closed')).toBeTruthy();
  });
});
