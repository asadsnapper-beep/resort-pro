/**
 * What the Add Room form accepts, in the two places the audit found it
 * disagreeing with the API: the price field's currency (RM-011) and the video
 * link's validation (RM-012).
 *
 * Renamed from `room-price-currency` when the second one arrived. Both are the
 * same shape of defect — a rule the form states one way and the server states
 * another — so they are read together here, against the same real store.
 *
 * ── RM-011 ──
 * Whether the price field asks for money in the resort's currency.
 *
 * It prefixed a literal `$` at every resort, while the room cards beside it
 * ran the same number through `formatCurrency`. The audit read that as "the
 * cards are right and the form is wrong". Measuring it found both were wrong
 * and for one reason: `currency` was in no payload the API returned, so
 * `tenant.currency` was undefined on the client, every page's
 * `?? 'BDT'` took the fallback and `formatCurrency`'s own default is BDT too.
 * A resort billing in dollars was shown taka on its cards and asked for
 * dollars in its form, and the figure it had configured appeared nowhere.
 * (Room Management QA 2026-10-28, RM-011.)
 *
 * Driven through the store rather than a mocked hook, because what broke was
 * a value's journey from the API into the store and out again — mocking
 * `useCurrency` would assert that a stub returns what the stub was given.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RoomModal } from '@/components/rooms/RoomModal';
import { useAuthStore } from '@/store/auth';
import { currencySymbol, formatCurrency } from '@/lib/utils';

/*
  A localStorage the auth store can write to. jsdom does not give this run one
  — `storage.setItem is not a function` — and the store is wrapped in zustand's
  `persist`, so every setState throws without it. Hoisted so it exists before
  the store module is imported. This replaces a browser facility, not any of
  the code under test.
*/
vi.hoisted(() => {
  const jar = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => jar.get(k) ?? null,
      setItem: (k: string, v: string) => void jar.set(k, String(v)),
      removeItem: (k: string) => void jar.delete(k),
      clear: () => jar.clear(),
      // Array.from, not a spread: this tsconfig does not have
      // downlevelIteration, so spreading a Map iterator is a type error.
      key: (i: number) => Array.from(jar.keys())[i] ?? null,
      get length() { return jar.size; },
    },
  });
});

vi.mock('@/lib/api', () => ({
  propertyApi: { list: () => Promise.resolve({ data: { data: [] } }) },
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/hooks/use-room-type-labels', () => ({
  useRoomTypeLabels: () => ({ getLabel: (t: string) => t }),
}));
vi.mock('@/components/ui/ImageUpload', () => ({ ImageUpload: () => null }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }));

const signInWith = (currency?: string) => {
  useAuthStore.setState({
    user: { id: 'u1', email: 'o@test', firstName: 'O', lastName: 'T', role: 'OWNER' },
    tenant: { id: 't1', name: 'Resort', slug: 'resort', ...(currency ? { currency } : {}) },
    token: 'token',
  } as never);
};

const open = () =>
  render(<RoomModal open onClose={() => {}} onSubmit={() => {}} loading={false} />);

/** The decoration in front of the price input. */
const prefix = () => {
  const input = screen.getByLabelText('Price/Night') as HTMLInputElement;
  // The symbol is `aria-hidden`, so it is deliberately not reachable by role
  // or label — it is the sibling span inside the field's wrapper.
  return input.parentElement?.querySelector('span')?.textContent ?? '';
};

beforeEach(() => signInWith('BDT'));
afterEach(() => cleanup());

describe('the video link the form will accept', () => {
  /*
    `isValidUrl` was `new URL(s)` and nothing else, so the form took
    `javascript:` and `data:` and handed them to a save that — once RM-012
    put a real check on the API — refuses them with a 400. A form that
    accepts what the server rejects is the same class of bug RM-005 and
    RM-012 are both about, just pointing the other way. Both ends ask
    `@resort-pro/types` now. (RM-012.)
  */
  const addVideo = (url: string) => {
    const input = screen.getByLabelText('Videos') as HTMLInputElement;
    fireEvent.change(input, { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'Add video' }));
  };

  it.each([
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'file:///etc/passwd',
    'not a url at all',
  ])('refuses %s before the save can', url => {
    signInWith('BDT');
    open();
    addVideo(url);

    expect(screen.getByRole('alert').textContent).toMatch(/http/i);
    expect(screen.queryByRole('button', { name: 'Remove video 1' })).toBeNull();
  });

  it('still takes an ordinary https link', () => {
    signInWith('BDT');
    open();
    addVideo('https://youtube.com/watch?v=dQw4w9WgXcQ');

    expect(screen.getByRole('button', { name: 'Remove video 1' })).toBeTruthy();
  });

  it('refuses a link longer than the column will hold', () => {
    signInWith('BDT');
    open();
    addVideo(`https://youtube.com/${'a'.repeat(2100)}`);

    expect(screen.getByRole('alert').textContent).toMatch(/too long/i);
  });
});

describe('the Add Room price field', () => {
  it('shows taka for a resort billing in taka', () => {
    signInWith('BDT');
    open();
    expect(prefix()).toBe('৳');
  });

  it('shows the dollar sign only when the resort actually bills in dollars', () => {
    signInWith('USD');
    open();
    expect(prefix()).toBe('$');
  });

  it.each(['EUR', 'GBP', 'INR', 'JPY', 'AED'])('and the right symbol for %s', code => {
    signInWith(code);
    open();
    expect(prefix()).toBe(currencySymbol(code));
  });

  it('agrees with the figure the room cards show', () => {
    // The two sat side by side and disagreed, which is the whole finding:
    // whatever symbol the card puts in front of a price, the form that
    // collects it must put the same one.
    signInWith('USD');
    open();

    expect(formatCurrency(2500, 'USD').startsWith(prefix())).toBe(true);
  });

  it('names the currency for a screen reader, since the symbol is decoration', () => {
    signInWith('EUR');
    open();

    const input = screen.getByLabelText('Price/Night');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent)
      .toContain('EUR');
  });

  it('falls back to taka while the store is still rehydrating', () => {
    // `tenant` is null for a tick on a cold load. Rendering a bare number
    // with no symbol at all would be worse than the default, and the default
    // matches `formatCurrency`'s, so a value and its symbol cannot come from
    // two different assumptions.
    useAuthStore.setState({ user: null, tenant: null, token: null } as never);
    open();

    expect(prefix()).toBe('৳');
  });

  it('shows an unknown code rather than guessing a symbol', () => {
    // KRW is not in the symbol table. "KRW 1200" is ungainly; a dollar sign
    // in front of a won figure is a wrong number.
    signInWith('KRW');
    open();

    expect(prefix()).toBe('KRW');
  });
});
