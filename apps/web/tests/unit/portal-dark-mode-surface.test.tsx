/**
 * Panels that render through `createPortal` must be themed surfaces, not
 * literal whites.
 *
 * `globals.css` keeps `bg-white` alive in dark mode with
 *
 *     .dark main .bg-white { background-color: var(--rp-surface) !important; }
 *
 * — scoped to inside `<main>`. Anything `createPortal` sends to
 * `document.body` lands **outside `<main>`**, so that patch cannot match it and
 * the element stays `#ffffff`: a white sheet in the middle of a dark app.
 *
 * `components/ui/modal.tsx` was fixed this way first (a1d0394). These are the
 * other portaled components that carried the same bug. Each now uses the token
 * whose value matches what the `<main>` patch would have given it:
 * `bg-rp-modal` (`--rp-modal`) for a modal or sheet panel, `bg-rp-surface`
 * (`--rp-surface`, which is exactly what the patch substituted) for a smaller
 * surface sitting on one.
 *
 * jsdom applies no stylesheet, so none of this can assert a computed colour.
 * What it pins is the thing that regressed and would regress again: a literal
 * `bg-white` on an element only the `<main>` patch could have rescued — plus
 * the premise the whole fix rests on, that the element really does render
 * outside `<main>`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { StaffDetailSheet } from '@/components/staff/StaffDetailSheet';
import { RoomDetailSheet } from '@/components/rooms/RoomDetailSheet';
import { GuestModal } from '@/components/guests/GuestModal';

// vitest.config.ts does not set `globals`, so Testing Library registers no
// cleanup of its own. Without this each portal would pile up in document.body
// and a query could match the previous case's markup.
afterEach(cleanup);

const staff = {
  id: 's1',
  department: 'FRONT_DESK',
  position: 'Receptionist',
  hireDate: '2024-01-01T00:00:00.000Z',
  isActive: true,
  user: {
    firstName: 'Mina',
    lastName: 'Rahman',
    email: 'mina@example.com',
    role: 'RECEPTIONIST',
    isActive: true,
  },
};

const room = {
  id: 'r1',
  number: '101',
  type: 'DELUXE',
  status: 'OCCUPIED',
  capacity: 2,
  price: 4500,
  images: [],
  amenities: [],
  videos: [],
  // The guest avatar circle only renders when there is a current booking, and
  // that circle is one of the two fixed instances in this component.
  currentBooking: {
    id: 'b1',
    confirmationNo: 'RP-001',
    status: 'CHECKED_IN',
    checkIn: '2026-11-10T00:00:00.000Z',
    checkOut: '2026-11-14T00:00:00.000Z',
    adults: 2,
    children: 0,
    guest: { id: 'g1', firstName: 'Arun', lastName: 'Das', email: 'arun@example.com' },
  },
} as unknown as Parameters<typeof RoomDetailSheet>[0]['room'];

const noop = () => {};

/** The sheet panel is the fixed, full-height column pinned to the right edge. */
const sheetPanel = (maxWidth: string) =>
  Array.from(document.body.querySelectorAll('div')).find(
    el => el.className.includes('inset-y-0') && el.className.includes(maxWidth),
  );

describe('StaffDetailSheet in dark mode', () => {
  it('gives the sheet panel a themed surface rather than a literal white', () => {
    render(
      <StaffDetailSheet
        staff={staff}
        onClose={noop}
        onEdit={noop}
        onDeactivate={noop}
        onReactivate={noop}
      />,
    );

    const panel = sheetPanel('max-w-md');
    expect(panel).toBeDefined();
    expect(panel!.className).toContain('bg-rp-modal');
    expect(panel!.className).not.toContain('bg-white');
  });

  it('still renders outside <main>, which is why the token is needed', () => {
    // If this ever stops being true the `<main>` patch would start covering the
    // panel again, and the reasoning at the top of this file would be wrong.
    render(
      <StaffDetailSheet
        staff={staff}
        onClose={noop}
        onEdit={noop}
        onDeactivate={noop}
        onReactivate={noop}
      />,
    );

    expect(sheetPanel('max-w-md')!.closest('main')).toBeNull();
  });
});

describe('RoomDetailSheet in dark mode', () => {
  const open = () =>
    render(
      <RoomDetailSheet
        room={room}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
        onStatusChange={noop}
        statusLoading={false}
      />,
    );

  it('gives the sheet panel a themed surface rather than a literal white', () => {
    open();

    const panel = sheetPanel('max-w-[420px]');
    expect(panel).toBeDefined();
    expect(panel!.className).toContain('bg-rp-modal');
    expect(panel!.className).not.toContain('bg-white');
  });

  it('gives the guest avatar circle a themed surface too', () => {
    open();

    const circle = Array.from(document.body.querySelectorAll('div')).find(
      el => el.className.includes('h-9 w-9') && el.className.includes('rounded-full'),
    );
    expect(circle).toBeDefined();
    expect(circle!.className).toContain('bg-rp-surface');
    expect(circle!.className).not.toContain('bg-white');
  });

  it('still renders outside <main>, which is why the token is needed', () => {
    open();

    expect(sheetPanel('max-w-[420px]')!.closest('main')).toBeNull();
  });

  it('leaves the header close button its white hover overlay', () => {
    // `hover:bg-white/10` sits on the dark header and is meant to be white at
    // 10% there. It is not a panel and must not be swept up with one.
    open();

    const close = Array.from(document.body.querySelectorAll('button')).find(el =>
      el.className.includes('hover:bg-white/10'),
    );
    expect(close).toBeDefined();
  });
});

describe('GuestModal in dark mode', () => {
  const open = () =>
    render(<GuestModal open onClose={noop} onSubmit={noop} loading={false} />);

  /** The panel is the rounded card inside the portaled overlay. */
  const panel = () =>
    Array.from(document.body.querySelectorAll('div')).find(el =>
      el.className.includes('rounded-2xl') && el.className.includes('max-w-xl'),
    );

  it('gives the modal panel a themed surface rather than a literal white', () => {
    open();

    expect(panel()).toBeDefined();
    expect(panel()!.className).toContain('bg-rp-modal');
    expect(panel()!.className).not.toContain('bg-white');
  });

  it('still renders outside <main>, which is why the token is needed', () => {
    open();

    expect(panel()!.closest('main')).toBeNull();
  });

  it('puts the field labels on a themed colour so they survive the new panel', () => {
    // The inputs already drew themselves with `--rp-surface-3` / `--rp-text`,
    // which was invisible on the old white panel. Moving the panel to
    // `--rp-modal` fixes them and would have stranded the `text-gray-700`
    // labels on a dark navy card instead, so the labels move with it.
    open();

    const label = Array.from(document.body.querySelectorAll('label')).find(el =>
      el.textContent?.startsWith('First Name'),
    );
    expect(label).toBeDefined();
    expect(label!.className).toContain('text-rp-accent');
    expect(label!.className).not.toContain('text-gray-700');
  });
});
