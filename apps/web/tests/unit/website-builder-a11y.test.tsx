/**
 * Whether the builder's icon-only controls can be used without seeing them.
 *
 * Four kinds of control had no accessible name at all, so a screen reader
 * announced each of them as "button" and nothing more:
 *
 *   - the show/hide control per section — a <button> whose only child is a
 *     styled <span>. It also never reported its state, so "shown" and "hidden"
 *     were indistinguishable, and twelve of them read identically.
 *   - the gallery photo remove buttons, up to twenty of them, all destructive.
 *   - the testimonial remove buttons.
 *   - the reorder arrows, which had `title` only: twelve "Move up" controls
 *     with nothing to say what moves.
 *
 * (Website Builder QA 2026-10-28, WB-012.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const WEBSITE = {
  heroTitle: 'Your Paradise Awaits',
  heroImage: 'https://cdn.example.com/hero.jpg',
  aboutImage: 'https://cdn.example.com/about.jpg',
  templateId: 'coastal',
  galleryImages: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
  testimonials: [
    { name: 'Rahim Uddin', text: 'Lovely stay', rating: 5 },
    { name: '',            text: 'No name given', rating: 4 },
  ],
  hiddenSections: ['gallery'],
  sectionOrder: [],
  primaryColor: '#183153',
  accentColor: '#d4a853',
};

const q = vi.hoisted(() => {
  const states: Record<string, Record<string, unknown>> = {
    website:         { data: undefined, isLoading: false, isError: false, isFetching: false },
    'tenant-domain': { data: undefined, isLoading: false, isError: false, isFetching: false },
  };
  return {
    states,
    client: { invalidateQueries: () => {} },
    mutation: { mutate: vi.fn(), mutateAsync: vi.fn(async () => {}), isPending: false },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => q.client,
  useMutation: () => q.mutation,
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ ...q.states[queryKey[0]], refetch: vi.fn() }),
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
vi.mock('@/components/dashboard/website/ThemePicker', () => ({ ThemePicker: () => null }));
vi.mock('@/components/dashboard/website/CustomDesignModal', () => ({
  CustomDesignModal: () => null,
  CustomDesignCta: () => null,
}));
// ImageUpload is real here: its clear button is one of the four controls.

import WebsitePage from '@/app/(dashboard)/dashboard/website/page';

const openTab = (name: RegExp) => {
  render(<WebsitePage />);
  fireEvent.click(screen.getByRole('button', { name }));
};

beforeEach(() => {
  Object.assign(q.states.website, { data: { data: { data: WEBSITE } }, isLoading: false, isError: false, isFetching: false });
  Object.assign(q.states['tenant-domain'], { data: undefined, isLoading: false, isError: false, isFetching: false });
});

afterEach(cleanup);

describe('the show/hide control for a section', () => {
  it('is a switch, not an unlabelled button', () => {
    openTab(/^Sections$/i);
    expect(screen.getAllByRole('switch').length).toBeGreaterThan(0);
  });

  it('names the section it controls', () => {
    openTab(/^Sections$/i);
    expect(screen.getByRole('switch', { name: /Show Testimonials on your website/i })).toBeTruthy();
  });

  it('reports on for a shown section and off for a hidden one', () => {
    // 'gallery' is in hiddenSections; the rest are not. Without aria-checked
    // the two states were announced identically.
    openTab(/^Sections$/i);
    expect(screen.getByRole('switch', { name: /Photo Gallery/i }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('switch', { name: /Testimonials/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('flips the reported state when used', () => {
    openTab(/^Sections$/i);
    const sw = screen.getByRole('switch', { name: /Photo Gallery/i });
    fireEvent.click(sw);
    expect(screen.getByRole('switch', { name: /Photo Gallery/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('gives a fixed section no switch at all', () => {
    // Rooms and Booking are always shown; a switch that cannot move would
    // promise a choice that does not exist.
    openTab(/^Sections$/i);
    expect(screen.queryByRole('switch', { name: /Rooms & Villas/i })).toBeNull();
    expect(screen.queryByRole('switch', { name: /Booking Form/i })).toBeNull();
    // Two sections are fixed, so there are two badges.
    expect(screen.getAllByText(/Always shown/i).length).toBe(2);
  });
});

describe('the reorder arrows', () => {
  it('say which section they move', () => {
    openTab(/^Sections$/i);
    expect(screen.getByRole('button', { name: /Move Testimonials up/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Move Testimonials down/i })).toBeTruthy();
  });

  it('give every section its own pair, not twelve identical ones', () => {
    openTab(/^Sections$/i);
    const names = screen.getAllByRole('button', { name: /^Move .+ up$/i })
      .map(b => b.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('removing a gallery photo', () => {
  it('says which photo', () => {
    openTab(/^Gallery$/i);
    expect(screen.getByRole('button', { name: /Remove gallery photo 1/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Remove gallery photo 2/i })).toBeTruthy();
  });

  it('still removes the one it names', () => {
    // Photo 2, deliberately. Clicking photo 1 cannot distinguish `idx !== i`
    // from a hardcoded `idx !== 0` — both drop the first photo, and a mutation
    // of that index survived while this test clicked photo 1.
    openTab(/^Gallery$/i);
    fireEvent.click(screen.getByRole('button', { name: /Remove gallery photo 2/i }));
    expect(screen.queryByRole('button', { name: /Remove gallery photo 2/i })).toBeNull();
    expect(screen.getByAltText(/Gallery 1/i).getAttribute('src')).toBe(WEBSITE.galleryImages[0]);
  });
});

describe('removing a testimonial', () => {
  it('names the guest, which is what tells them apart', () => {
    openTab(/^Testimonials$/i);
    expect(screen.getByRole('button', { name: /Remove testimonial from Rahim Uddin/i })).toBeTruthy();
  });

  it('falls back to the position when the guest has no name yet', () => {
    // A testimonial just added is blank; it still needs a distinct name.
    openTab(/^Testimonials$/i);
    expect(screen.getByRole('button', { name: /Remove testimonial 2/i })).toBeTruthy();
  });
});

describe('the image clear button', () => {
  it('names the field it clears', () => {
    openTab(/^Hero & About$/i);
    expect(screen.getByRole('button', { name: /Remove Hero Background Image/i })).toBeTruthy();
  });

  it('names the About field too, so the two are not interchangeable', () => {
    openTab(/^Hero & About$/i);
    expect(screen.getByRole('button', { name: /Remove About Section Image/i })).toBeTruthy();
  });
});
