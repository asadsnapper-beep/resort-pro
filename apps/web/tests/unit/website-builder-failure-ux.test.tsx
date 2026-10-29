/**
 * What the Website Builder does when it cannot load.
 *
 * `useQuery` was destructured as `{ data, isLoading }` only, so a failed load
 * fell through to the full builder with every field at its blank default. The
 * honest reading of that screen is "my website content is gone". It was also a
 * dead end: the effect that fills the form never ran, so `savedSnapshot` stayed
 * null, `dirty` stayed false, and Save stayed disabled insisting "No changes to
 * publish" however much the owner retyped. Nothing could be overwritten from
 * there — but nothing said why, either.
 *
 * The domain card had the same shape of silence: a failed tenant query left the
 * field blank, which is indistinguishable from owning no domain.
 *
 * (Website Builder QA 2026-10-28, WB-012.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const WEBSITE = {
  heroTitle: 'Your Paradise Awaits',
  templateId: 'luxe',
  primaryColor: '#183153',
  accentColor: '#d4a853',
  galleryImages: [],
  testimonials: [],
  hiddenSections: [],
  sectionOrder: [],
};

const TENANT = {
  slug: 'palm-paradise-resort',
  customDomain: 'www.palmparadise.com',
  domainVerified: true,
  domainVerifiedAt: '2026-10-01T00:00:00.000Z',
};

/**
 * Stable per-key identities. The page runs an effect on each query's `data`,
 * so a mock handing back a fresh object every render would set state, re-render
 * and run again until the worker dies — a harness failure that looks like a
 * product bug.
 */
const q = vi.hoisted(() => {
  const states: Record<string, Record<string, unknown>> = {
    website:         { data: undefined, isLoading: false, isError: false, isFetching: false },
    'tenant-domain': { data: undefined, isLoading: false, isError: false, isFetching: false },
  };
  const refetch  = { website: vi.fn(), 'tenant-domain': vi.fn() };
  const client   = { invalidateQueries: () => {} };
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(async () => {}), isPending: false };
  return { states, refetch, client, mutation };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => q.client,
  useMutation: () => q.mutation,
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    ...q.states[queryKey[0]],
    refetch: q.refetch[queryKey[0] as keyof typeof q.refetch],
  }),
}));

vi.mock('@/lib/api', () => ({
  websiteApi: { get: vi.fn(), update: vi.fn() },
  tenantApi:  { get: vi.fn(), setDomain: vi.fn(), verifyDomain: vi.fn() },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@/store/auth', () => ({
  // An OWNER: the Custom Domain tab is owner/manager-only now (WB-007).
  useAuthStore: () => ({
    tenant: { id: 't1', slug: 'palm-paradise-resort' },
    user: { role: 'OWNER' },
    token: 'tok',
  }),
}));
// Whole features of their own, and none of them is this test's subject.
vi.mock('@/components/dashboard/website/ThemePicker', () => ({ ThemePicker: () => null }));
vi.mock('@/components/dashboard/website/CustomDesignModal', () => ({
  CustomDesignModal: () => null,
  CustomDesignCta: () => null,
}));
vi.mock('@/components/ui/ImageUpload', () => ({ ImageUpload: () => null }));

import WebsitePage from '@/app/(dashboard)/dashboard/website/page';

/** Put one query into a given state, keeping the object identity stable. */
function setQuery(key: 'website' | 'tenant-domain', patch: Record<string, unknown>) {
  Object.assign(q.states[key], patch);
}

const loaded = () => setQuery('website', { data: { data: { data: WEBSITE } }, isError: false, isFetching: false });
const failed = () => setQuery('website', { data: undefined, isError: true, isFetching: false });

beforeEach(() => {
  setQuery('website',         { data: undefined, isLoading: false, isError: false, isFetching: false });
  setQuery('tenant-domain',   { data: { data: { data: TENANT } }, isLoading: false, isError: false, isFetching: false });
  q.refetch.website.mockClear();
  q.refetch['tenant-domain'].mockClear();
  q.mutation.mutate.mockClear();
  q.mutation.mutateAsync.mockClear();
});

afterEach(cleanup);

describe('a website query that fails', () => {
  it('says so instead of rendering an empty builder', () => {
    failed();
    render(<WebsitePage />);
    expect(screen.getByText(/Could not load your website content/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Website Builder/i })).toBeNull();
  });

  it('does not offer fields to retype, which is what made it a dead end', () => {
    // The old screen showed every input blank. An owner filling them in could
    // never publish: Save is gated on `dirty`, which cannot become true when
    // the snapshot was never taken.
    failed();
    render(<WebsitePage />);
    expect(screen.queryByDisplayValue(WEBSITE.heroTitle)).toBeNull();
    expect(screen.queryByRole('button', { name: /Save & Publish/i })).toBeNull();
  });

  it('tells the owner their live website is still serving visitors', () => {
    // The failure is in this page reaching the API, not in the published site.
    failed();
    render(<WebsitePage />);
    expect(screen.getByText(/still serving visitors/i)).toBeTruthy();
  });

  it('is announced, not only drawn', () => {
    failed();
    render(<WebsitePage />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('offers a retry that actually refetches', () => {
    failed();
    render(<WebsitePage />);
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(q.refetch.website).toHaveBeenCalledTimes(1);
  });

  it('reports the retry in flight rather than looking inert', () => {
    setQuery('website', { data: undefined, isError: true, isFetching: true });
    render(<WebsitePage />);
    const btn = screen.getByRole('button', { name: /Retrying…/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('gets out of the way once the content loads', () => {
    loaded();
    render(<WebsitePage />);
    expect(screen.queryByText(/Could not load your website content/i)).toBeNull();
    expect(screen.getByRole('heading', { name: /Website Builder/i })).toBeTruthy();
  });

  it('is not shown while the first load is still running', () => {
    // isLoading already has its own skeleton; an error state on top of it
    // would accuse the server before anything has gone wrong.
    setQuery('website', { data: undefined, isLoading: true, isError: false });
    render(<WebsitePage />);
    expect(screen.queryByText(/Could not load your website content/i)).toBeNull();
  });
});

describe('a tenant query that fails', () => {
  const openDomainTab = () => {
    render(<WebsitePage />);
    fireEvent.click(screen.getByRole('button', { name: /^Custom Domain$/i }));
  };

  beforeEach(() => {
    loaded();
    setQuery('tenant-domain', { data: undefined, isError: true, isFetching: false });
  });

  it('says the domain box is empty because it could not ask', () => {
    openDomainTab();
    expect(screen.getByText(/Could not check your domain settings/i)).toBeTruthy();
    expect(screen.getByText(/not\s+because you have no domain/i)).toBeTruthy();
  });

  it('says any connected domain is still live', () => {
    // The page cannot read the record, so it must not imply the domain stopped
    // working. Serving the domain does not depend on this page.
    openDomainTab();
    expect(screen.getByText(/still live/i)).toBeTruthy();
  });

  it('is announced', () => {
    openDomainTab();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('offers a retry for that query alone', () => {
    openDomainTab();
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    expect(q.refetch['tenant-domain']).toHaveBeenCalledTimes(1);
    expect(q.refetch.website).not.toHaveBeenCalled();
  });

  it('stays quiet when the domain record did load', () => {
    setQuery('tenant-domain', { data: { data: { data: TENANT } }, isError: false });
    openDomainTab();
    expect(screen.queryByText(/Could not check your domain settings/i)).toBeNull();
  });

  it('stays quiet when a later refetch fails but the record is already known', () => {
    // The owner is looking at their real domain. Warning that it could not be
    // read would contradict what is on screen.
    setQuery('tenant-domain', { data: { data: { data: TENANT } }, isError: true });
    openDomainTab();
    expect(screen.queryByText(/Could not check your domain settings/i)).toBeNull();
    expect(screen.getAllByText(TENANT.customDomain).length).toBeGreaterThan(0);
  });
});

describe('removing the domain from the builder', () => {
  const openDomainTab = () => {
    loaded();
    render(<WebsitePage />);
    fireEvent.click(screen.getByRole('button', { name: /^Custom Domain$/i }));
    return screen.getByRole('button', { name: /Remove custom domain www\.palmparadise\.com/i });
  };

  it('asks before removing anything', () => {
    // The sibling button in Settings was fixed first; this one is the likelier
    // of the two to be pressed, because the domain lives on this page.
    fireEvent.click(openDomainTab());
    expect(q.mutation.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/Remove this domain\?/i)).toBeTruthy();
  });

  /**
   * The domain string also appears in the status card and the input behind the
   * dialog, so these read the dialog's own sentence rather than the page.
   */
  const dialogText = () => screen.getByText(/will stop/i).textContent ?? '';

  it('names the domain it is about to take down', () => {
    fireEvent.click(openDomainTab());
    expect(dialogText()).toContain(TENANT.customDomain);
  });

  it('says the free resortpro address keeps working', () => {
    // Otherwise "remove" reads as "take my website offline".
    fireEvent.click(openDomainTab());
    expect(dialogText()).toContain('palm-paradise-resort.resortpro.site');
    expect(dialogText()).toMatch(/keeps working/i);
  });

  it('removes it once confirmed', async () => {
    fireEvent.click(openDomainTab());
    fireEvent.click(screen.getByRole('button', { name: /^Remove domain$/i }));
    await waitFor(() => expect(q.mutation.mutateAsync).toHaveBeenCalledWith(null));
  });

  it('removes nothing when cancelled', () => {
    fireEvent.click(openDomainTab());
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(q.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('names the domain in the trigger for a screen reader', () => {
    // The visible label is just "Remove custom domain"; which domain matters.
    expect(openDomainTab().getAttribute('aria-label')).toContain(TENANT.customDomain);
  });
});
