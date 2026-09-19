/**
 * The connections screen, which serves both sides of a connection.
 *
 * The half that matters is the lower one. It answers the question an owner
 * should never have to ask support — whose account is attached to my books, at
 * what level, and since when — so these tests hold it to naming the person and
 * to saying plainly that full access includes billing.
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
const getConnection = vi.fn();
const getEvents = vi.fn();
const setAccess = vi.fn();
const disconnect = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  resortGroupApi: {
    get: () => getGroup(),
    connection: () => getConnection(),
    events: () => getEvents(),
    setAccess: (id: string, access: string) => setAccess(id, access),
    disconnect: (id: string) => disconnect(id),
  },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ tenant: { id: 't1' } }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import { ConnectedResortsTab } from '@/components/dashboard/ConnectedResortsTab';

const connection = (access: 'FULL' | 'NUMBERS_ONLY') => ({
  groupName: 'Sea Pearl Group', ownerName: 'Asha Rahman', ownerEmail: 'asha@example.com',
  ownerResort: 'Sea Pearl', access, since: '2026-09-01T00:00:00.000Z',
});

const group = (resorts: { tenantId: string; name: string; access: string }[] | null) =>
  getGroup.mockResolvedValue({
    data: { data: resorts && { id: 'g1', name: 'Group', resorts, pendingRequests: [] } },
  });

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ConnectedResortsTab /></QueryClientProvider>);
}

beforeEach(() => {
  getGroup.mockReset();
  getConnection.mockReset();
  getEvents.mockReset();
  setAccess.mockReset();
  disconnect.mockReset();
  getEvents.mockResolvedValue({ data: { data: [] } });
  getConnection.mockResolvedValue({ data: { data: null } });
  group(null);
});
afterEach(cleanup);

describe('the resorts you can see', () => {
  it('lists them with the level, leaving out the one you are in', async () => {
    group([
      { tenantId: 't1', name: 'This One', access: 'FULL' },
      { tenantId: 't2', name: 'Hill View', access: 'NUMBERS_ONLY' },
    ]);
    mount();

    expect(await screen.findByText('Hill View')).toBeTruthy();
    expect(screen.getByText('Figures only')).toBeTruthy();
    expect(screen.queryByText('This One')).toBeNull();
  });

  it('disconnects one', async () => {
    group([
      { tenantId: 't1', name: 'This One', access: 'FULL' },
      { tenantId: 't2', name: 'Hill View', access: 'FULL' },
    ]);
    disconnect.mockResolvedValue({});
    mount();

    fireEvent.click(await screen.findByText('Disconnect'));
    await waitFor(() => expect(disconnect).toHaveBeenCalledWith('t2'));
  });
});

describe('who can see this resort', () => {
  it('names them and says plainly that full access includes billing', async () => {
    getConnection.mockResolvedValue({ data: { data: connection('FULL') } });
    mount();

    expect(await screen.findByText(/Asha Rahman/)).toBeTruthy();
    expect(screen.getByText(/including its billing/)).toBeTruthy();
  });

  it('reduces full access to figures only', async () => {
    getConnection.mockResolvedValue({ data: { data: connection('FULL') } });
    setAccess.mockResolvedValue({});
    mount();

    fireEvent.click(await screen.findByText('Reduce to figures only'));
    await waitFor(() => expect(setAccess).toHaveBeenCalledWith('t1', 'NUMBERS_ONLY'));
  });

  it('raises figures only back to full', async () => {
    getConnection.mockResolvedValue({ data: { data: connection('NUMBERS_ONLY') } });
    setAccess.mockResolvedValue({});
    mount();

    fireEvent.click(await screen.findByText('Give full access'));
    await waitFor(() => expect(setAccess).toHaveBeenCalledWith('t1', 'FULL'));
  });

  it('ends the connection outright', async () => {
    getConnection.mockResolvedValue({ data: { data: connection('NUMBERS_ONLY') } });
    disconnect.mockResolvedValue({});
    mount();

    fireEvent.click(await screen.findByText('End this connection'));
    await waitFor(() => expect(disconnect).toHaveBeenCalledWith('t1'));
  });

  it('says so when the change does not go through', async () => {
    getConnection.mockResolvedValue({ data: { data: connection('FULL') } });
    setAccess.mockRejectedValue(new Error('403'));
    mount();

    fireEvent.click(await screen.findByText('Reduce to figures only'));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('says nothing at all when nobody is connected', async () => {
    mount();
    await waitFor(() => expect(client.getQueryState(['resort-connection'])?.status).toBe('success'));
    expect(screen.queryByText('Who can see this resort')).toBeNull();
  });
});

describe('the history', () => {
  it('reads the events in words rather than codes', async () => {
    getEvents.mockResolvedValue({
      data: {
        data: [{
          id: 'e1', action: 'access_changed', resortName: 'Hill View',
          actorName: 'Their Owner', metadata: null, createdAt: '2026-09-10T00:00:00.000Z',
        }],
      },
    });
    mount();

    expect(await screen.findByText('Access level changed')).toBeTruthy();
    expect(screen.queryByText('access_changed')).toBeNull();
  });
});
