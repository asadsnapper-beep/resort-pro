/**
 * Paying for every resort at once.
 *
 * It shows the lines rather than one number on purpose: an owner paying for
 * four resorts should be able to see which of them the money is going to, and
 * which of them is getting the discount.
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

const group = vi.fn();
const checkout = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  billingApi: {
    group: (interval: string) => group(interval),
    createBkashGroupCheckout: (interval: string) => checkout(interval),
  },
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import { GroupBillPanel } from '@/components/dashboard/GroupBillPanel';

const bill = (over: Record<string, unknown> = {}) => ({
  groupName: 'Sea Pearl Group', available: true, interval: 'month', currency: 'BDT',
  lines: [
    { tenantId: 't1', name: 'Sea Pearl', plan: 'STARTER', listPrice: 2000, amount: 2000 },
    { tenantId: 't2', name: 'Hill View', plan: 'PROFESSIONAL', listPrice: 6000, amount: 5400 },
  ],
  total: 7400,
  ...over,
});

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><GroupBillPanel /></QueryClientProvider>);
}

beforeEach(() => {
  group.mockReset();
  checkout.mockReset();
});
afterEach(cleanup);

describe('when it appears', () => {
  it('stays away for an owner with nothing to combine', async () => {
    group.mockResolvedValue({ data: { data: null } });
    mount();
    await waitFor(() => expect(client.getQueryState(['group-bill', 'month'])?.status).toBe('success'));
    expect(screen.queryByText('Pay with bKash')).toBeNull();
  });

  it('says so when a negotiated plan is in the way', async () => {
    group.mockResolvedValue({ data: { data: { groupName: 'G', available: false, reason: 'ENTERPRISE_IN_GROUP' } } });
    mount();
    expect(await screen.findByText(/negotiated plan/)).toBeTruthy();
    expect(screen.queryByText('Pay with bKash')).toBeNull();
  });

  it('stays quiet about reasons nobody can act on', async () => {
    group.mockResolvedValue({ data: { data: { groupName: 'G', available: false, reason: 'NOTHING_TO_COMBINE' } } });
    mount();
    await waitFor(() => expect(client.getQueryState(['group-bill', 'month'])?.status).toBe('success'));
    expect(screen.queryByText(/negotiated plan/)).toBeNull();
  });
});

describe('the bill', () => {
  it('shows what each resort costs, and the total', async () => {
    group.mockResolvedValue({ data: { data: bill() } });
    mount();

    expect(await screen.findByText('Sea Pearl')).toBeTruthy();
    expect(screen.getByText('৳5,400')).toBeTruthy();
    expect(screen.getByText(/৳7,400/)).toBeTruthy();
  });

  it('shows the list price struck through where a discount applied', async () => {
    group.mockResolvedValue({ data: { data: bill() } });
    mount();

    const struck = await screen.findByText('৳6,000');
    expect(struck.className).toContain('line-through');
    // The full-price resort has nothing struck through beside it.
    expect(screen.queryByText('৳2,000')?.className).not.toContain('line-through');
  });

  it('prices a year when a year is asked for', async () => {
    group.mockResolvedValue({ data: { data: bill() } });
    mount();
    await screen.findByText('Sea Pearl');

    fireEvent.click(screen.getByText('Yearly'));
    await waitFor(() => expect(group).toHaveBeenCalledWith('year'));
  });
});

describe('paying', () => {
  it('hands over to bKash for the period on screen', async () => {
    group.mockResolvedValue({ data: { data: bill() } });
    checkout.mockResolvedValue({ data: { data: { url: 'https://bkash.example/pay' } } });
    mount();

    fireEvent.click(await screen.findByText('Pay with bKash'));
    await waitFor(() => expect(checkout).toHaveBeenCalledWith('month'));
  });

  it('passes the gateway\'s own refusal through rather than a shrug', async () => {
    group.mockResolvedValue({ data: { data: bill() } });
    const err = new Error('503') as Error & { response: { data: { error: string } } };
    err.response = { data: { error: 'bKash payments are not available yet.' } };
    checkout.mockRejectedValue(err);
    mount();

    fireEvent.click(await screen.findByText('Pay with bKash'));
    expect(await screen.findByRole('alert'))
      .toHaveProperty('textContent', 'bKash payments are not available yet.');
  });
});
