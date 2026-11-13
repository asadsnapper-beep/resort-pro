/**
 * The dashboard shell's theme toggle, as a screen reader meets it.
 *
 * It is an icon-only button, so without a name it announced as just
 * "button". The name has to say what the click will do, and it has to
 * follow the theme — a label stuck on "Switch to dark theme" while the app
 * is already dark is worse than no label at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Node 25 ships an experimental global localStorage with no methods, and it
// shadows jsdom's working one. The ui store is zustand/persist, so it reads
// localStorage on import — hoisted to be in place before that happens.
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

// A real, if tiny, next-themes: clicking has to actually move the theme, or
// the test would pass on a hardcoded label.
const theme = vi.hoisted(() => ({ current: 'light' as string | undefined }));
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: theme.current,
    setTheme: (next: string) => { theme.current = next; },
  }),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  billingApi: { getStatus: () => Promise.resolve({ data: { data: null } }) },
}));
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ tenant: { id: 't1', planStatus: 'active' } }),
}));

// The toggle's neighbours in the bar each fetch their own data; none of them
// is what this test is about.
vi.mock('@/components/dashboard/NotificationBell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/dashboard/PropertySwitcher', () => ({ PropertySwitcher: () => null }));
vi.mock('@/components/dashboard/ElectronStatusBadge', () => ({ ElectronStatusBadge: () => null }));
vi.mock('@/components/dashboard/GlobalSearch', () => ({
  GlobalSearch: () => null,
  useGlobalSearchShortcut: () => {},
}));

import { TopNav } from '@/components/dashboard/top-nav';

let client: QueryClient;
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><TopNav /></QueryClientProvider>);
}

beforeEach(() => { theme.current = 'light'; });
afterEach(() => { cleanup(); client?.clear(); });

describe('dashboard shell theme toggle — accessible name', () => {
  it('is reachable by its name in the light theme, and no button is nameless', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeDefined();
    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent || button.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('names the light theme once the app is dark', () => {
    theme.current = 'dark';
    mount();
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Switch to dark theme' })).toBeNull();
  });

  it('flips its name when the theme it sets takes effect', () => {
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(theme.current).toBe('dark');

    // next-themes re-renders the tree on a theme change; remounting is how
    // this stand-in delivers that.
    view.unmount();
    mount();
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeDefined();
  });

  it('offers the dark theme when no theme has resolved yet', () => {
    // next-themes reports undefined before mount and 'system' when the choice
    // is the OS's; the first click sets dark in both cases, so the name must
    // say dark rather than fall through to the light label.
    for (const unresolved of [undefined, 'system']) {
      theme.current = unresolved;
      mount();
      expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeDefined();
      cleanup();
    }
  });
});
