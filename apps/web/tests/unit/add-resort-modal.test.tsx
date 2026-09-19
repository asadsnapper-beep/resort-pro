/**
 * Opening another resort.
 *
 * This one spends money, so the test that matters most is that it says so
 * before the button: a separate subscription, and the tenth off that an owner
 * deciding whether a fourth resort is worth it should be told about now rather
 * than discover on the invoice.
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

const newResort = vi.fn();
const switchResort = vi.fn();
const push = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  resortGroupApi: { newResort: (d: unknown) => newResort(d) },
  authApi: { switchResort: (id: string) => switchResort(id) },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ tenant: { id: 't1' }, setAuth: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import { AddResortModal, slugify } from '@/components/dashboard/AddResortModal';

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AddResortModal open onClose={() => {}} />
    </QueryClientProvider>,
  );
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  newResort.mockReset();
  switchResort.mockReset();
  push.mockReset();
});
afterEach(cleanup);

describe('the web address', () => {
  it('is made from the name, and stays usable', () => {
    expect(slugify('Sea Pearl Retreat')).toBe('sea-pearl-retreat');
    expect(slugify('  Hill & View!  ')).toBe('hill-view');
    expect(slugify('ব্লু লেগুন')).toBe('');
  });

  it('follows the name until it is edited by hand', () => {
    mount();
    type('Resort name', 'Sea Pearl Retreat');
    expect((screen.getByLabelText('Web address') as HTMLInputElement).value).toBe('sea-pearl-retreat');

    type('Web address', 'pearl');
    type('Resort name', 'Something Else');
    expect((screen.getByLabelText('Web address') as HTMLInputElement).value).toBe('pearl');
  });
});

describe('before the button', () => {
  it('says this is a separate subscription, and names the discount', () => {
    mount();
    expect(screen.getByText(/separate subscription/)).toBeTruthy();
    expect(screen.getByText(/10% less/)).toBeTruthy();
  });

  it('will not create a resort with no name', () => {
    mount();
    expect((screen.getByText('Create it') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('creating it', () => {
  it('opens the new resort so its plan can be chosen', async () => {
    newResort.mockResolvedValue({ data: { data: { tenantId: 't2', slug: 'hill-view' } } });
    switchResort.mockResolvedValue({ data: { data: { token: 'tk', user: {}, tenant: { id: 't2' } } } });
    mount();

    type('Resort name', 'Hill View');
    fireEvent.click(screen.getByText('Create it'));

    await waitFor(() => expect(newResort).toHaveBeenCalledWith({ name: 'Hill View', slug: 'hill-view' }));
    await waitFor(() => expect(switchResort).toHaveBeenCalledWith('t2'));
  });

  it('says which web addresses are taken, rather than a generic failure', async () => {
    const err = new Error('409') as Error & { response: { data: { code: string } } };
    err.response = { data: { code: 'SLUG_TAKEN' } };
    newResort.mockRejectedValue(err);
    mount();

    type('Resort name', 'Hill View');
    fireEvent.click(screen.getByText('Create it'));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('already taken'));
    expect(switchResort).not.toHaveBeenCalled();
  });

  it('does not pretend it worked when it did not', async () => {
    newResort.mockRejectedValue(new Error('500'));
    mount();

    type('Resort name', 'Hill View');
    fireEvent.click(screen.getByText('Create it'));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(switchResort).not.toHaveBeenCalled();
  });
});
