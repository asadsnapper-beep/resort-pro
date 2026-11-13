/**
 * The phone must not offer what the tenant has not got.
 *
 * The desktop sidebar filtered nav items by role, then by the tenant's module
 * entitlements, then by AI availability. MobileMoreSheet called only
 * `getVisibleItems(role)` — the first of the three — so on the same Owner
 * account the 2026-09-09 sidebar QA counted 36 destinations on desktop and 37
 * on mobile, and every extra tile navigated successfully into a module the
 * tenant had never enabled.
 *
 * reports/qa/2026-09-09-dashboard-sidebar-comprehensive-qa.md, Major.
 *
 * The fix was to give both surfaces one hook, so this test renders the sheet
 * rather than the hook: a future edit that reverts it to `getVisibleItems`
 * would satisfy a hook-level test and still ship the bug.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getModules = vi.fn();
const aiStatus = { ai_content: false, ai_chatbot: false, ai_business_insights: false };

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

// `has` returning false is what the component uses to fall back to the English
// label, so every item renders under its labelFallback.
vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((k: string) => k, { has: () => false }),
  useLocale: () => 'en',
}));

vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    user: { role: 'OWNER', firstName: 'A', lastName: 'B' },
    // ENTERPRISE grants venues_module by plan, so the module flag below is the
    // only thing that can hide it — an assertion that cannot pass vacuously.
    tenant: { name: 'Test Resort', plan: 'ENTERPRISE' },
    clearAuth: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  authApi: { logout: vi.fn() },
  tenantApi: { getModules: () => getModules() },
  dashboardApi: { getStats: vi.fn() },
  api: { get: vi.fn() },
}));

vi.mock('@/hooks/use-ai-status', () => ({
  useAiStatus: () => ({ status: aiStatus, loading: false }),
}));

import { MobileMoreSheet } from './MobileMoreSheet';

function open() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MobileMoreSheet open onClose={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getModules.mockReset();
  aiStatus.ai_content = false;
});

// vitest.config.ts does not set `globals`, so Testing Library never registers
// its own afterEach cleanup. Without this the sheet renders into document.body
// through createPortal and each case inherits the last one's menu — which made
// an early version of these tests pass for the wrong reason.
afterEach(cleanup);

describe('a module the tenant has switched off', () => {
  it('is not listed on the phone', async () => {
    getModules.mockResolvedValue({ data: { data: [{ flag: 'venues_module', enabled: false }] } });
    open();

    await waitFor(() => expect(screen.queryByText('Venues & Events')).toBeNull());
    // Something unflagged is still there, so the absence above is not the whole
    // menu failing to render.
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('is listed once the tenant enables it', async () => {
    getModules.mockResolvedValue({ data: { data: [{ flag: 'venues_module', enabled: true }] } });
    open();

    expect(await screen.findByText('Venues & Events')).toBeTruthy();
  });
});

describe('an AI page while AI is switched off', () => {
  it('is not listed on the phone', async () => {
    getModules.mockResolvedValue({ data: { data: [] } });
    open();

    await waitFor(() => expect(screen.queryByText('AI Content')).toBeNull());
  });

  it('is listed once AI is live', async () => {
    aiStatus.ai_content = true;
    getModules.mockResolvedValue({ data: { data: [] } });
    open();

    expect(await screen.findByText('AI Content')).toBeTruthy();
  });
});

/**
 * The sheet goes through `createPortal` to `document.body`, which is outside
 * `<main>`, so `.dark main .bg-white` in globals.css cannot reach it. The sign
 * out button's `bg-white` therefore stayed a literal `#ffffff` in dark mode —
 * a white slab at the bottom of a dark sheet. `bg-rp-surface` is the token
 * whose value is exactly what that patch would have substituted.
 *
 * jsdom applies no stylesheet, so this asserts the class and the premise (that
 * the button really is outside `<main>`), not a computed colour.
 */
describe('the sign out button in dark mode', () => {
  it('uses a themed surface rather than a literal white', async () => {
    getModules.mockResolvedValue({ data: { data: [] } });
    open();

    const button = await screen.findByText('Sign out');
    expect(button.className).toContain('bg-rp-surface');
    expect(button.className).not.toContain('bg-white');
  });

  it('still renders outside <main>, which is why the token is needed', async () => {
    getModules.mockResolvedValue({ data: { data: [] } });
    open();

    const button = await screen.findByText('Sign out');
    expect(button.closest('main')).toBeNull();
  });

  it('leaves the close button and drag handle their white overlays', async () => {
    // `dark:bg-white/10` and `dark:bg-white/20` are meant to be white there,
    // and `.dark .bg-white\/N` is not scoped to `<main>` anyway.
    getModules.mockResolvedValue({ data: { data: [] } });
    open();

    const close = await screen.findByLabelText('Close menu');
    expect(close.className).toContain('dark:bg-white/10');
  });
});
