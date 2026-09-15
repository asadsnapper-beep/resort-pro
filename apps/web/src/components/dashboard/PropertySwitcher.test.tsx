/**
 * Choosing a property in the top bar, and that choice reaching the API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Node 25 ships an experimental global localStorage that has no methods unless
// started with --localstorage-file, and it shadows jsdom's working one. CI runs
// Node 20, where this is not needed; a small in-memory Storage makes the test
// behave the same on both. Hoisted so it exists before the persisted store loads.
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

const list = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  propertyApi: { list: () => list() },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ tenant: { id: 'tenant-1' } }),
}));

import { PropertySwitcher } from './PropertySwitcher';
import { usePropertyStore, selectedPropertyFor } from '@/store/property';

const properties = (rows: { id: string; name: string; isActive?: boolean }[]) =>
  list.mockResolvedValue({ data: { success: true, data: rows } });

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PropertySwitcher /></QueryClientProvider>);
}

beforeEach(() => {
  list.mockReset();
  usePropertyStore.setState({ byTenant: {} });
});
afterEach(cleanup);

describe('when it appears', () => {
  it('stays hidden for a resort with one property — nearly everyone', async () => {
    properties([{ id: 'p1', name: 'Beach' }]);
    mount();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.queryByLabelText('Property')).toBeNull();
  });

  it('does not count a deactivated property', async () => {
    properties([{ id: 'p1', name: 'Beach' }, { id: 'p2', name: 'Old', isActive: false }]);
    mount();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.queryByLabelText('Property')).toBeNull();
  });

  it('offers every active property, and all of them together', async () => {
    properties([{ id: 'p1', name: 'Beach' }, { id: 'p2', name: 'Hill' }]);
    mount();
    const picker = await screen.findByLabelText('Property');
    const options = Array.from((picker as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(['All properties', 'Beach', 'Hill']);
    expect((picker as HTMLSelectElement).value).toBe('');
  });
});

describe('choosing one', () => {
  it('remembers it for this tenant and clears what other pages had loaded', async () => {
    properties([{ id: 'p1', name: 'Beach' }, { id: 'p2', name: 'Hill' }]);
    mount();
    const picker = await screen.findByLabelText('Property');
    // A page's data, loaded while "All properties" was selected.
    client.setQueryData(['rooms'], ['every room']);

    fireEvent.change(picker, { target: { value: 'p2' } });

    expect(usePropertyStore.getState().byTenant['tenant-1']).toBe('p2');
    // Reset, not merely invalidated: the old numbers must not stay on screen
    // looking like the new property's.
    expect(client.getQueryData(['rooms'])).toBeUndefined();
    // The list of properties does not depend on the choice and is kept.
    expect(client.getQueryData(['properties'])).toBeDefined();
  });

  it('going back to all properties forgets the choice', async () => {
    usePropertyStore.setState({ byTenant: { 'tenant-1': 'p1' } });
    properties([{ id: 'p1', name: 'Beach' }, { id: 'p2', name: 'Hill' }]);
    mount();
    fireEvent.change(await screen.findByLabelText('Property'), { target: { value: '' } });
    expect(usePropertyStore.getState().byTenant['tenant-1']).toBeNull();
  });

  it('drops a remembered property that no longer exists, instead of emptying every page', async () => {
    usePropertyStore.setState({ byTenant: { 'tenant-1': 'deleted' } });
    properties([{ id: 'p1', name: 'Beach' }, { id: 'p2', name: 'Hill' }]);
    mount();
    await waitFor(() => expect(usePropertyStore.getState().byTenant['tenant-1']).toBeNull());
  });
});

describe('the API client', () => {
  it('sends the chosen property with every request, and nothing when all are shown', async () => {
    const { api } = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
    const fulfilled = (api.interceptors.request as unknown as {
      handlers: { fulfilled: (c: { headers: Record<string, string> }) => { headers: Record<string, string> } }[];
    }).handlers[0].fulfilled;
    localStorage.setItem('resort-pro-auth', JSON.stringify({ state: { token: 't', tenant: { id: 'tenant-1' } } }));

    expect(fulfilled({ headers: {} }).headers['X-Property-Id']).toBeUndefined();

    usePropertyStore.getState().select('tenant-1', 'p2');
    expect(fulfilled({ headers: {} }).headers['X-Property-Id']).toBe('p2');

    // Another tenant's remembered choice never leaks into this one.
    usePropertyStore.setState({ byTenant: { 'tenant-9': 'p9' } });
    expect(fulfilled({ headers: {} }).headers['X-Property-Id']).toBeUndefined();
    expect(selectedPropertyFor('tenant-9')).toBe('p9');

    localStorage.removeItem('resort-pro-auth');
  });
});
