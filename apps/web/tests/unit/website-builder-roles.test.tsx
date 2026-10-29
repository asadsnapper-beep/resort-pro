/**
 * What each role actually sees in the Website Builder.
 *
 * The companion to website-capabilities.test.ts, and not a duplicate: a
 * correct map is worth nothing if the page does not consult it. That was the
 * whole of WB-007 — the page never read the role at all, so every control was
 * offered to everyone who could open it.
 *
 * (Website Builder QA 2026-10-28, WB-007.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const WEBSITE = {
  heroTitle: 'Your Paradise Awaits',
  templateId: 'coastal',
  galleryImages: [],
  testimonials: [],
  hiddenSections: [],
  sectionOrder: [],
  primaryColor: '#183153',
  accentColor: '#d4a853',
};

const TENANT = {
  slug: 'palm-paradise-resort',
  customDomain: 'www.palmparadise.com',
  domainVerified: false,
  domainVerifiedAt: null,
};

const q = vi.hoisted(() => {
  const states: Record<string, Record<string, unknown>> = {
    website:         { data: undefined, isLoading: false, isError: false, isFetching: false },
    'tenant-domain': { data: undefined, isLoading: false, isError: false, isFetching: false },
  };
  return {
    states,
    role: { current: 'OWNER' as string | null },
    enabled: { 'tenant-domain': undefined as unknown },
    client: { invalidateQueries: () => {} },
    mutation: { mutate: vi.fn(), mutateAsync: vi.fn(async () => {}), isPending: false },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => q.client,
  useMutation: () => q.mutation,
  useQuery: (opts: { queryKey: string[]; enabled?: boolean }) => {
    // Record `enabled` so a test can assert the request is not even attempted.
    q.enabled[opts.queryKey[0] as 'tenant-domain'] = opts.enabled;
    return { ...q.states[opts.queryKey[0]], refetch: vi.fn() };
  },
}));
vi.mock('@/lib/api', () => ({
  websiteApi: { get: vi.fn(), update: vi.fn() },
  tenantApi:  { get: vi.fn(), setDomain: vi.fn(), verifyDomain: vi.fn() },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    tenant: { id: 't1', slug: 'palm-paradise-resort' },
    user: q.role.current ? { role: q.role.current } : null,
    token: 'tok',
  }),
}));
vi.mock('@/components/dashboard/website/ThemePicker', () => ({ ThemePicker: () => null }));
vi.mock('@/components/ui/ImageUpload', () => ({ ImageUpload: () => null }));
// Kept real: whether the custom-design call to action renders is the subject.
import WebsitePage from '@/app/(dashboard)/dashboard/website/page';

const as = (role: string | null) => { q.role.current = role; render(<WebsitePage />); };
const domainTab = () => screen.queryByRole('button', { name: /^Custom Domain$/i });

beforeEach(() => {
  q.role.current = 'OWNER';
  Object.assign(q.states.website, { data: { data: { data: WEBSITE } }, isLoading: false, isError: false, isFetching: false });
  Object.assign(q.states['tenant-domain'], { data: { data: { data: TENANT } }, isLoading: false, isError: false, isFetching: false });
  q.enabled['tenant-domain'] = undefined;
  q.mutation.mutate.mockClear();
});

afterEach(cleanup);

describe('a MARKETER', () => {
  it('still gets the content tabs — editing the site is the job', () => {
    as('MARKETER');
    expect(screen.getByRole('button', { name: /^Hero & About$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Gallery$/i })).toBeTruthy();
  });

  it('does not see the Custom Domain tab, which 403s for them', () => {
    as('MARKETER');
    expect(domainTab()).toBeNull();
  });

  it('is not asked for the tenant record at all', () => {
    // GET /tenant is OWNER/MANAGER. Firing it anyway would 403 every time and
    // light up the failure notice for a role that is simply not entitled.
    as('MARKETER');
    expect(q.enabled['tenant-domain']).toBe(false);
  });

  it('is not offered a paid custom design they cannot request', () => {
    as('MARKETER');
    expect(screen.queryByText(/Want something nobody else has/i)).toBeNull();
  });
});

describe('a DEVELOPER', () => {
  it('is treated exactly as a marketer is', () => {
    as('DEVELOPER');
    expect(domainTab()).toBeNull();
    expect(screen.getByRole('button', { name: /^SEO & Branding$/i })).toBeTruthy();
  });
});

describe('a MANAGER', () => {
  const openDomain = () => {
    as('MANAGER');
    fireEvent.click(screen.getByRole('button', { name: /^Custom Domain$/i }));
  };

  it('sees the Custom Domain tab — they may read the tenant record', () => {
    as('MANAGER');
    expect(domainTab()).toBeTruthy();
    expect(q.enabled['tenant-domain']).toBe(true);
  });

  it('sees the domain that is set', () => {
    openDomain();
    expect(screen.getAllByText(TENANT.customDomain).length).toBeGreaterThan(0);
  });

  it('cannot type a new domain', () => {
    openDomain();
    const input = screen.getByPlaceholderText(/www\.yourresort\.com/i) as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('cannot save one', () => {
    // The old page let them press Save and collect a 403.
    openDomain();
    const save = screen.getByRole('button', { name: /^(Save|Remove)$/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(q.mutation.mutate).not.toHaveBeenCalled();
  });

  it('is not offered Verify Domain, which is owner-only', () => {
    openDomain();
    expect(screen.queryByRole('button', { name: /Verify Domain/i })).toBeNull();
  });

  it('is not offered to remove the domain', () => {
    openDomain();
    expect(screen.queryByRole('button', { name: /Remove custom domain/i })).toBeNull();
  });

  it('is told why, rather than left with dead fields', () => {
    // Fields that do nothing and say nothing read as a broken page.
    openDomain();
    expect(screen.getByText(/Only the resort owner can connect, verify or remove a domain/i)).toBeTruthy();
  });

  it('may still ask for a custom design — that is OWNER/MANAGER', () => {
    as('MANAGER');
    expect(screen.getByText(/Want something nobody else has/i)).toBeTruthy();
  });
});

describe('an OWNER', () => {
  const openDomain = () => {
    as('OWNER');
    fireEvent.click(screen.getByRole('button', { name: /^Custom Domain$/i }));
  };

  it('keeps the writable domain form', () => {
    openDomain();
    expect((screen.getByPlaceholderText(/www\.yourresort\.com/i) as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Remove custom domain/i })).toBeTruthy();
  });

  it('is offered Verify Domain while the domain is unverified', () => {
    openDomain();
    expect(screen.getByRole('button', { name: /Verify Domain/i })).toBeTruthy();
  });

  it('sees no owner-only explanation, because nothing is withheld', () => {
    openDomain();
    expect(screen.queryByText(/Only the resort owner can/i)).toBeNull();
  });
});

describe('the custom-design call to action', () => {
  it('renders for an owner in this harness', () => {
    // Without this, the three assertions that it is absent could be passing
    // because it never renders here for any role.
    as('OWNER');
    expect(screen.getByText(/Want something nobody else has/i)).toBeTruthy();
  });
});

describe('before the auth store has loaded', () => {
  it('shows no owner-only control rather than flashing them at everyone', () => {
    as(null);
    expect(domainTab()).toBeNull();
    expect(screen.queryByText(/Want something nobody else has/i)).toBeNull();
  });
});
