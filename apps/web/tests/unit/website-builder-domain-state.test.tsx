/**
 * What the builder's domain card says about DNS and HTTPS.
 *
 * The companion to domain-status.test.ts: a correct state machine is worth
 * nothing if the card does not use it. The card said "Verified & live" from
 * `domainVerified` alone and put an `https://` link beside it, and it read
 * that flag from `GET /tenant`, which does not return a single SSL field — so
 * it could not have told DNS from HTTPS even if it had wanted to.
 * (Website Builder QA 2026-10-28, WB-008.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const WEBSITE = {
  heroTitle: 'Your Paradise Awaits', templateId: 'coastal',
  galleryImages: [], testimonials: [], hiddenSections: [], sectionOrder: [],
  primaryColor: '#183153', accentColor: '#d4a853',
};

const DOMAIN = 'www.palmparadise.com';

const q = vi.hoisted(() => ({
  states: {
    website:         { data: undefined, isLoading: false, isError: false, isFetching: false },
    'tenant-domain': { data: undefined, isLoading: false, isError: false, isFetching: false },
  } as Record<string, Record<string, unknown>>,
  queryFns: {} as Record<string, unknown>,
  client: { invalidateQueries: () => {} },
  mutation: { mutate: vi.fn(), mutateAsync: vi.fn(async () => {}), isPending: false },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => q.client,
  useMutation: () => q.mutation,
  useQuery: (opts: { queryKey: string[]; queryFn: unknown }) => {
    q.queryFns[opts.queryKey[0]] = opts.queryFn;
    return { ...q.states[opts.queryKey[0]], refetch: vi.fn() };
  },
}));

const api = vi.hoisted(() => ({
  get: vi.fn(), getDomainStatus: vi.fn(async () => ({ data: { data: {} } })),
  setDomain: vi.fn(), verifyDomain: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  websiteApi: { get: vi.fn(), update: vi.fn() },
  tenantApi: api,
}));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    tenant: { id: 't1', slug: 'palm-paradise-resort' },
    user: { role: 'OWNER' },
    token: 'tok',
  }),
}));
vi.mock('@/components/dashboard/website/ThemePicker', () => ({ ThemePicker: () => null }));
vi.mock('@/components/dashboard/website/CustomDesignModal', () => ({
  CustomDesignModal: () => null, CustomDesignCta: () => null,
}));
vi.mock('@/components/ui/ImageUpload', () => ({ ImageUpload: () => null }));

import WebsitePage from '@/app/(dashboard)/dashboard/website/page';

/** Render with a given domain record and open the Custom Domain tab. */
function openDomain(over: Record<string, unknown> = {}) {
  Object.assign(q.states['tenant-domain'], {
    data: { data: { data: {
      customDomain: DOMAIN, domainVerified: true, domainVerifiedAt: null,
      slug: 'palm-paradise-resort', sslStatus: 'none', sslError: null, ...over,
    } } },
  });
  render(<WebsitePage />);
  fireEvent.click(screen.getByRole('button', { name: /^Custom Domain$/i }));
}

const openLink = () => screen.queryByRole('link', { name: new RegExp(`Open ${DOMAIN}`, 'i') });

/** The state the row's icon shows — a tick, a warning, or a spinner. */
const rowState = (label: RegExp) =>
  screen.getByText(label).closest('[data-state]')?.getAttribute('data-state');

beforeEach(() => {
  Object.assign(q.states.website, { data: { data: { data: WEBSITE } }, isLoading: false, isError: false, isFetching: false });
  q.queryFns = {};
  api.get.mockClear();
  api.getDomainStatus.mockClear();
});

afterEach(cleanup);

describe('where the card gets its data', () => {
  it('asks the endpoint that actually carries the SSL fields', async () => {
    // GET /tenant returns customDomain and domainVerified but no sslStatus at
    // all, so the card could never have distinguished DNS from HTTPS.
    openDomain();
    await (q.queryFns['tenant-domain'] as () => Promise<unknown>)();
    expect(api.getDomainStatus).toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('DNS resolved, no certificate', () => {
  // The exact state the old card called "Verified & live".
  beforeEach(() => openDomain({ domainVerified: true, sslStatus: 'none' }));

  it('does not claim the domain is live', () => {
    // Scoped to the status block: the top bar has its own "Live" badge for the
    // free resortpro.site subdomain, which genuinely is live.
    expect(screen.queryByText(/Verified & live/i)).toBeNull();
    const card = screen.getByText(/Pointing to ResortPro/i).closest('div')?.parentElement;
    expect(card?.textContent ?? '').not.toMatch(/\blive\b/i);
  });

  it('reports DNS and HTTPS as two separate things', () => {
    expect(screen.getByText(/Pointing to ResortPro/i)).toBeTruthy();
    expect(screen.getByText(/Certificate not issued yet/i)).toBeTruthy();
  });

  it('does not offer a link that cannot load', () => {
    expect(openLink()).toBeNull();
  });

  it('says what will happen and what to do', () => {
    expect(screen.getByText(/will not load/i)).toBeTruthy();
  });

  it('does not put a tick beside the missing certificate', () => {
    // A green tick next to "Certificate not issued yet" contradicts the words
    // beside it, and the icon is what gets read at a glance.
    expect(rowState(/Pointing to ResortPro/i)).toBe('done');
    expect(rowState(/Certificate not issued yet/i)).toBe('pending');
  });
});

describe('DNS not resolved yet', () => {
  beforeEach(() => openDomain({ domainVerified: false, sslStatus: 'none' }));

  it('says the domain is not pointing here', () => {
    expect(rowState(/Not pointing here yet/i)).toBe('pending');
  });

  it('asks for the DNS record before anything about certificates', () => {
    expect(screen.getByText(/Add the DNS record below/i)).toBeTruthy();
  });

  it('offers no link', () => {
    expect(openLink()).toBeNull();
  });
});

describe('a certificate being issued', () => {
  it('says so and still offers no link', () => {
    openDomain({ sslStatus: 'provisioning' });
    expect(screen.getByText(/Certificate being issued/i)).toBeTruthy();
    expect(rowState(/Certificate being issued/i)).toBe('pending');
    expect(openLink()).toBeNull();
  });
});

describe('a failed certificate', () => {
  it('shows the recorded reason', () => {
    openDomain({ sslStatus: 'error', sslError: 'DNS challenge timed out' });
    expect(screen.getByText(/Certificate failed/i)).toBeTruthy();
    expect(rowState(/Certificate failed/i)).toBe('failed');
    expect(screen.getByText(/DNS challenge timed out/i)).toBeTruthy();
    expect(openLink()).toBeNull();
  });
});

describe('DNS and certificate both good', () => {
  beforeEach(() => openDomain({ domainVerified: true, sslStatus: 'active' }));

  it('is the only case that offers the link', () => {
    const link = openLink();
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe(`https://${DOMAIN}`);
  });

  it('shows both halves as done', () => {
    expect(rowState(/Pointing to ResortPro/i)).toBe('done');
    expect(rowState(/Certificate active/i)).toBe('done');
  });

  it('has nothing left to ask of the owner', () => {
    expect(screen.queryByText(/Add the DNS record below/i)).toBeNull();
    expect(screen.queryByText(/will not load/i)).toBeNull();
  });
});

describe('no domain connected', () => {
  it('shows no status block at all', () => {
    openDomain({ customDomain: null });
    expect(screen.queryByText(/Pointing to ResortPro/i)).toBeNull();
    expect(screen.queryByText(/Certificate/i)).toBeNull();
  });
});
