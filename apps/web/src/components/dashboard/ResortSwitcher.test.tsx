/**
 * Picking which resort the dashboard is showing.
 *
 * The two that matter: it must not appear at all for an owner with one resort,
 * and switching must clear the previous resort's figures off the screen rather
 * than leaving them there under a new name.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Node 25 ships an experimental global localStorage with no methods, which
// shadows jsdom's working one. CI runs Node 20 and does not need this; an
// in-memory Storage makes the test behave the same on both.
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
const switchResort = vi.fn();
const setAuth = vi.fn();
const push = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  resortGroupApi: { get: () => getGroup() },
  authApi: { switchResort: (id: string) => switchResort(id) },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ tenant: { id: 't1' }, setAuth }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
// Untranslated keys come back as the key itself, which is what the component
// treats as "no translation" — so these assertions read the English fallbacks.
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import { ResortSwitcher } from './ResortSwitcher';

type Resort = {
  tenantId: string; name: string; access: 'FULL' | 'NUMBERS_ONLY';
  canOpen: boolean; isCurrent: boolean;
};

const resort = (over: Partial<Resort> & { tenantId: string; name: string }): Resort => ({
  access: 'FULL', canOpen: true, isCurrent: false, ...over,
});

const group = (resorts: Resort[] | null) =>
  getGroup.mockResolvedValue({
    data: { success: true, data: resorts && { id: 'g1', name: 'Group', resorts, pendingRequests: [] } },
  });

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ResortSwitcher /></QueryClientProvider>);
}

const both = () => [
  resort({ tenantId: 't1', name: 'Sea Pearl', isCurrent: true }),
  resort({ tenantId: 't2', name: 'Hill View' }),
];

beforeEach(() => {
  getGroup.mockReset();
  switchResort.mockReset();
  setAuth.mockReset();
  push.mockReset();
});
afterEach(cleanup);

describe('when it appears', () => {
  /**
   * Waiting on the call is not enough — it resolves the moment the request is
   * made, before the answer has rendered, so an absent dropdown proves nothing.
   * Wait for the query itself to settle.
   */
  const settled = () =>
    waitFor(() => expect(client.getQueryState(['resort-group'])?.status).toBe('success'));

  it('stays hidden for an owner with no connected resorts — nearly everyone', async () => {
    group(null);
    mount();
    await settled();
    expect(screen.queryByLabelText('Resort')).toBeNull();
  });

  it('stays hidden while only one resort is connected', async () => {
    group([resort({ tenantId: 't1', name: 'Sea Pearl', isCurrent: true })]);
    mount();
    await settled();
    expect(screen.queryByLabelText('Resort')).toBeNull();
  });

  it('appears once a second resort is connected, showing the current one', async () => {
    group(both());
    mount();
    const select = await screen.findByLabelText('Resort');
    expect((select as HTMLSelectElement).value).toBe('t1');
    expect(screen.getByRole('option', { name: 'Sea Pearl' })).toBeTruthy();
  });

  it('lists a figures-only resort, and will not let it be opened', async () => {
    group([
      resort({ tenantId: 't1', name: 'Sea Pearl', isCurrent: true }),
      resort({ tenantId: 't2', name: 'Blue Lagoon', access: 'NUMBERS_ONLY', canOpen: false }),
    ]);
    mount();
    await screen.findByLabelText('Resort');

    const option = screen.getByRole('option', { name: 'Blue Lagoon — figures only' }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });
});

describe('switching', () => {
  it('takes the new session, clears the old resort\'s data, and goes to the dashboard', async () => {
    group(both());
    switchResort.mockResolvedValue({
      data: { data: { token: 'new-token', user: { id: 'u2' }, tenant: { id: 't2', name: 'Hill View' } } },
    });
    mount();
    const select = await screen.findByLabelText('Resort');
    const reset = vi.spyOn(client, 'resetQueries');

    fireEvent.change(select, { target: { value: 't2' } });

    await waitFor(() => expect(setAuth).toHaveBeenCalledWith({ id: 'u2' }, { id: 't2', name: 'Hill View' }, 'new-token'));
    expect(switchResort).toHaveBeenCalledWith('t2');
    // Reset, not invalidate: invalidated queries keep showing the previous
    // resort's numbers until each refetch lands.
    expect(reset).toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'));
  });

  it('does nothing when the resort you are already in is chosen', async () => {
    group(both());
    mount();
    const select = await screen.findByLabelText('Resort');

    fireEvent.change(select, { target: { value: 't1' } });

    expect(switchResort).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('says so and stays put when the switch is refused', async () => {
    group(both());
    switchResort.mockRejectedValue(new Error('403'));
    mount();
    const select = await screen.findByLabelText('Resort');

    fireEvent.change(select, { target: { value: 't2' } });

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(setAuth).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
