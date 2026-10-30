/**
 * Which section controls an uploaded theme is offered.
 *
 * WB-001 was closed for the four hardcoded themes and left standing for every
 * uploaded and AI-generated one: `themeSections` fell back to the full set for
 * any key it did not recognise, and a bespoke key is never recognised. There
 * is no `ConfigAmenities` component anywhere in the product, so an owner on an
 * uploaded theme got a switch and two reorder arrows for a section that
 * nothing would ever draw — the same "UI exists but does not work" the audit
 * called WB-001's clearest case.
 *
 * The key could not answer this; the theme's kind can, because every uploaded
 * and AI-generated theme is drawn by the one ConfigThemeRenderer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

/** A resort on a bought uploaded theme, as `GET /website` now answers. */
const UPLOADED = {
  heroTitle: 'Your Paradise Awaits',
  templateId: 'copper-and-clay',
  themeType: 'UPLOADED',
  galleryImages: [],
  testimonials: [],
  hiddenSections: [],
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
  tenantApi:  { get: vi.fn(), getDomainStatus: vi.fn(), setDomain: vi.fn(), verifyDomain: vi.fn() },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({
    tenant: { id: 't1', slug: 'palm-paradise-resort' },
    user: { role: 'OWNER' },
    token: 'tok',
  }),
}));
// Stands in for the real picker so a theme can be chosen without saving it,
// which is the one case the kind must not be trusted for.
vi.mock('@/components/dashboard/website/ThemePicker', () => ({
  ThemePicker: ({ onSelect }: { onSelect: (key: string) => void }) => (
    <button type="button" onClick={() => onSelect('some-other-theme')}>
      Choose a different theme
    </button>
  ),
}));
vi.mock('@/components/dashboard/website/CustomDesignModal', () => ({
  CustomDesignModal: () => null,
  CustomDesignCta: () => null,
}));
vi.mock('@/components/ui/ImageUpload', () => ({ ImageUpload: () => null }));

import WebsitePage from '@/app/(dashboard)/dashboard/website/page';

const load = (content: Record<string, unknown>) => {
  Object.assign(q.states.website, { data: { data: { data: content } } });
};

const openTab = (name: RegExp) => {
  render(<WebsitePage />);
  fireEvent.click(screen.getByRole('button', { name }));
};

beforeEach(() => {
  load(UPLOADED);
  Object.assign(q.states['tenant-domain'], { data: undefined, isLoading: false, isError: false, isFetching: false });
});

afterEach(cleanup);

describe('an uploaded theme', () => {
  it('is offered no Amenities switch, because nothing would draw it', () => {
    openTab(/^Sections$/i);
    expect(screen.queryByRole('switch', { name: /Amenities/i })).toBeNull();
  });

  it('is told so, instead of the control simply vanishing', () => {
    // An owner who finds no control at all would reasonably conclude the
    // product cannot do it. The truthful answer is that this theme cannot.
    openTab(/^Sections$/i);
    const notice = screen.getByText(/Not supported by this theme/i).parentElement;
    expect(notice?.textContent).toMatch(/Amenities/i);
  });

  it('keeps every control the config renderer does draw', () => {
    // The fix must not overshoot. These nine are all in the renderer's map.
    openTab(/^Sections$/i);
    for (const label of [
      /About \/ Our Story/i, /Photo Gallery/i, /Testimonials/i, /Restaurant Menu/i,
      /Venues & Events/i, /Vehicle Rental/i, /Availability Calendar/i,
      /Offers & Promotions/i, /Contact \/ Feedback/i,
    ]) {
      expect(screen.getByRole('switch', { name: label })).toBeTruthy();
    }
  });

  it('still shows the two a resort site exists for, without switches', () => {
    openTab(/^Sections$/i);
    expect(screen.getAllByText(/Always shown/i).length).toBe(2);
    expect(screen.queryByRole('switch', { name: /Rooms & Villas/i })).toBeNull();
  });

  it('drops Amenities from an order saved before this fix', () => {
    // Existing sites carry it in `sectionOrder`. It has to go without taking
    // the rest of the order with it.
    load({ ...UPLOADED, sectionOrder: ['contact', 'amenities', 'about'] });
    openTab(/^Sections$/i);
    expect(screen.queryByRole('switch', { name: /Amenities/i })).toBeNull();
    expect(screen.getByRole('switch', { name: /Contact \/ Feedback/i })).toBeTruthy();
  });
});

describe('an AI-generated theme', () => {
  it('is the same renderer, so the same answer', () => {
    load({ ...UPLOADED, themeType: 'AI_GENERATED' });
    openTab(/^Sections$/i);
    expect(screen.queryByRole('switch', { name: /Amenities/i })).toBeNull();
  });
});

describe('the themes this must not change', () => {
  it('Coastal keeps Amenities, which it is the one theme to render', () => {
    // The positive control. Without it, a test that simply could not find any
    // switch would pass for the wrong reason.
    load({ ...UPLOADED, templateId: 'coastal', themeType: 'HARDCODED' });
    openTab(/^Sections$/i);
    expect(screen.getByRole('switch', { name: /Amenities/i })).toBeTruthy();
  });

  it('a Tier 2 template keeps every control, because only its markup knows', () => {
    // TemplateThemeRenderer hides whichever `id="<section>"` it finds in the
    // uploaded HTML. Neither the key nor the kind can answer for that.
    load({ ...UPLOADED, themeType: 'TEMPLATE' });
    openTab(/^Sections$/i);
    expect(screen.getByRole('switch', { name: /Amenities/i })).toBeTruthy();
  });

  it('a theme whose kind did not arrive keeps every control', () => {
    load({ ...UPLOADED, themeType: null });
    openTab(/^Sections$/i);
    expect(screen.getByRole('switch', { name: /Amenities/i })).toBeTruthy();
  });
});

describe('choosing a different theme before saving', () => {
  it('stops trusting the kind, rather than applying it to the new key', () => {
    // `themeType` describes the saved theme. The moment another is picked the
    // key has changed and that answer is about the old one, so the controls
    // fall back to the full set until Save. Cautious, not wrong.
    render(<WebsitePage />);
    fireEvent.click(screen.getByRole('button', { name: /^Template$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Choose a different theme/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sections$/i }));
    expect(screen.getByRole('switch', { name: /Amenities/i })).toBeTruthy();
  });
});
