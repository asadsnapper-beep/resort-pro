/**
 * The 360 page — every connected resort side by side.
 *
 * The two that carry weight: a resort shared as figures only must not be
 * openable from here, and a resort whose figures could not be read must not
 * take the rest of the page down with it.
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

const getGroup = vi.fn();
const getOverview = vi.fn();
const switchResort = vi.fn();
const push = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  resortGroupApi: { get: () => getGroup(), overview: () => getOverview() },
  authApi: { switchResort: (id: string) => switchResort(id) },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ tenant: { id: 't1' }, setAuth: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import ResortsPage from '@/app/(dashboard)/dashboard/resorts/page';

const numbers = (over: Partial<Record<string, number>> = {}) => ({
  rooms: 10, occupied: 5, occupancyPct: 50, arrivals: 2, departures: 1,
  revenueMonth: 1000, expensesMonth: 400, profitMonth: 600, outstanding: 50, ...over,
});

const card = (over: Record<string, unknown>) => ({
  tenantId: 'x', name: 'A resort', slug: 'a', access: 'FULL', canOpen: true,
  planStatus: 'active', isActive: true, currency: 'BDT', timezone: 'Asia/Dhaka',
  localDate: '2026-09-20', numbers: numbers(), failed: false, ...over,
});

const group = (count: number) =>
  getGroup.mockResolvedValue({
    data: {
      data: count === 0 ? null : {
        id: 'g1', name: 'Sea Pearl Group', pendingRequests: [],
        resorts: Array.from({ length: count }, (_, i) => ({ tenantId: `t${i + 1}` })),
      },
    },
  });

const overview = (resorts: ReturnType<typeof card>[], currencies: unknown[]) =>
  getOverview.mockResolvedValue({
    data: { data: { group: { id: 'g1', name: 'Sea Pearl Group' }, resorts, currencies, generatedAt: 'now' } },
  });

const bdt = (over: Record<string, unknown> = {}) => ({
  currency: 'BDT', resorts: 2, totals: numbers({ rooms: 102, occupied: 22, occupancyPct: 21.6 }), ...over,
});

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ResortsPage /></QueryClientProvider>);
}

beforeEach(() => {
  getGroup.mockReset();
  getOverview.mockReset();
  switchResort.mockReset();
  push.mockReset();
});
afterEach(cleanup);

describe('with nothing connected', () => {
  it('explains itself instead of showing empty totals, and asks the API for nothing', async () => {
    group(0);
    mount();
    expect(await screen.findByText('No other resorts are connected yet')).toBeTruthy();
    expect(getOverview).not.toHaveBeenCalled();
  });

  it('says the same for an owner whose group holds only their own resort', async () => {
    group(1);
    mount();
    expect(await screen.findByText('No other resorts are connected yet')).toBeTruthy();
    expect(getOverview).not.toHaveBeenCalled();
  });
});

describe('with resorts connected', () => {
  it('shows one row of totals per currency, never a combined one', async () => {
    group(2);
    overview(
      [card({ tenantId: 't1', name: 'Sea Pearl' }), card({ tenantId: 't2', name: 'Hill View', currency: 'USD' })],
      [bdt(), { currency: 'USD', resorts: 1, totals: numbers({ revenueMonth: 900 }) }],
    );
    mount();

    await screen.findByText('Sea Pearl');
    expect(screen.getByText(/Total in\s*BDT/)).toBeTruthy();
    expect(screen.getByText(/Total in\s*USD/)).toBeTruthy();
  });

  it('opens a resort you have full access to', async () => {
    group(2);
    overview([card({ tenantId: 't1', name: 'Sea Pearl' }), card({ tenantId: 't2', name: 'Hill View' })], [bdt()]);
    switchResort.mockResolvedValue({ data: { data: { token: 'tk', user: {}, tenant: { id: 't2' } } } });
    mount();

    fireEvent.click(await screen.findByRole('button', { name: /Hill View/ }));

    await waitFor(() => expect(switchResort).toHaveBeenCalledWith('t2'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('will not open a resort shared as figures only, and says why', async () => {
    group(2);
    overview(
      [
        card({ tenantId: 't1', name: 'Sea Pearl' }),
        card({ tenantId: 't2', name: 'Blue Lagoon', access: 'NUMBERS_ONLY', canOpen: false }),
      ],
      [bdt()],
    );
    mount();

    await screen.findByText('Blue Lagoon');
    expect(screen.queryByRole('button', { name: /Blue Lagoon/ })).toBeNull();
    expect(screen.getByText(/shares its figures, not the resort itself/)).toBeTruthy();
  });

  it('marks a resort whose figures could not be read and keeps the rest', async () => {
    group(2);
    overview(
      [
        card({ tenantId: 't1', name: 'Sea Pearl' }),
        card({ tenantId: 't2', name: 'Broken', numbers: null, failed: true }),
      ],
      [bdt()],
    );
    mount();

    expect(await screen.findByText(/could not be loaded just now/)).toBeTruthy();
    expect(screen.getByText('Sea Pearl')).toBeTruthy();
  });

  it('marks a suspended resort', async () => {
    group(2);
    overview(
      [card({ tenantId: 't1', name: 'Sea Pearl' }), card({ tenantId: 't2', name: 'Stopped', isActive: false, canOpen: false })],
      [bdt()],
    );
    mount();

    await screen.findByText('Stopped');
    expect(screen.getByText('Suspended')).toBeTruthy();
  });
});
