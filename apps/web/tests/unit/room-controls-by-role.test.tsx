/**
 * Whether the room screens offer controls the API will refuse.
 *
 * The rooms page and the room detail sheet rendered Add Room, Edit Room and
 * Delete for everybody who could reach the page. The API has always been
 * stricter — create and edit need Owner or Manager, delete needs Owner — so a
 * Receptionist's real browser journey was: open Add Room, fill the whole form,
 * submit, and receive a 403. Secure at the API, broken as a workflow.
 * (Room Management QA 2026-10-28, RM-005.)
 *
 * The permission itself is not restated here. `ROOM_CAPABILITIES` in
 * @resort-pro/types is what both sides read — the API passes it to
 * `requireRole`, and these screens ask it what to render — so the two cannot
 * drift apart into exactly the bug above.
 *
 * Written and run against the unmodified screens first: every "does not show"
 * test below failed, which is the finding reproduced.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserRole } from '@resort-pro/types';

const list  = vi.fn();
const stats = vi.fn();

vi.mock('@/lib/api', () => ({
  roomsApi: {
    list:   (...a: unknown[]) => list(...a),
    stats:  (...a: unknown[]) => stats(...a),
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), updateStatus: vi.fn(),
  },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

/** null stands for the tick before the persisted store has rehydrated. */
let role: UserRole | null = 'OWNER';
vi.mock('@/store/auth', () => ({
  useAuthStore: () => ({ user: role === null ? null : { role }, token: 'tok' }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
vi.mock('@/hooks/use-room-type-labels', () => ({
  useRoomTypeLabels: () => ({ getLabel: (t: string) => t }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

import RoomsPage from '@/app/(dashboard)/dashboard/rooms/page';
import { RoomDetailSheet } from '@/components/rooms/RoomDetailSheet';

const room = {
  id: 'r1', tenantId: 't1', number: '101', name: 'Garden View', type: 'STANDARD',
  status: 'AVAILABLE', floor: 1, maxOccupancy: 2, basePrice: 2500,
  description: null, amenities: [], images: [], videos: [], isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  currentBooking: null,
};

function mountPage(as: UserRole | null) {
  role = as;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}><RoomsPage /></QueryClientProvider>,
  );
}

function mountSheet(as: UserRole | null) {
  role = as;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoomDetailSheet
        room={room as never}
        onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
        onStatusChange={vi.fn()} statusLoading={false}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  list.mockReset(); stats.mockReset();
  list.mockResolvedValue({
    data: { data: [room], pagination: { total: 1, totalPages: 1, page: 1, limit: 20 } },
  });
  stats.mockResolvedValue({
    data: { data: { total: 1, available: 1, occupied: 0, cleaning: 0, maintenance: 0, reserved: 0 } },
  });
});
afterEach(() => { cleanup(); });

describe('Add Room', () => {
  it('is offered to an owner', async () => {
    mountPage('OWNER');
    expect(await screen.findByText('Add Room')).toBeTruthy();
  });

  it('is offered to a manager', async () => {
    mountPage('MANAGER');
    expect(await screen.findByText('Add Room')).toBeTruthy();
  });

  it('is not offered to a receptionist, who would get a 403', async () => {
    mountPage('RECEPTIONIST');
    await screen.findByText('Rooms & Villas');

    expect(screen.queryByText('Add Room')).toBeNull();
  });
});

describe('Edit Room and Delete in the detail sheet', () => {
  it('are both offered to an owner', () => {
    mountSheet('OWNER');

    expect(screen.getByText('Edit Room')).toBeTruthy();
    expect(screen.getByLabelText('Delete room')).toBeTruthy();
  });

  it('offers a manager Edit but not Delete, which is owner-only', () => {
    mountSheet('MANAGER');

    expect(screen.getByText('Edit Room')).toBeTruthy();
    expect(screen.queryByLabelText('Delete room')).toBeNull();
  });

  it('offers a receptionist neither', () => {
    mountSheet('RECEPTIONIST');

    expect(screen.queryByText('Edit Room')).toBeNull();
    expect(screen.queryByLabelText('Delete room')).toBeNull();
  });

  it('tells the receptionist why, rather than leaving a blank strip', () => {
    // An empty footer where two buttons used to be reads as a broken page.
    // The report asked for the explanation, not only the hiding.
    mountSheet('RECEPTIONIST');

    expect(screen.getByText(/only an owner or manager can edit rooms/i)).toBeTruthy();
  });
});

describe('a guest who has overstayed', () => {
  // The API counts the overstay (RM-008); this panel is where the desk reads
  // it. An overdue guest used to be missing from here altogether, so the room
  // said Occupied and named nobody.
  const checkedIn = (over: Record<string, unknown>) => ({
    ...room,
    status: 'OCCUPIED',
    currentBooking: {
      id: 'b1', confirmationNo: 'RP-1', status: 'CHECKED_IN',
      checkIn: '2026-10-28', checkOut: '2026-10-31', adults: 1, children: 0,
      overdueNights: 0, dueOutToday: false,
      guest: { id: 'g1', firstName: 'Shamim', lastName: 'Rahman', email: 's@x.com' },
      ...over,
    },
  });

  function mountWith(over: Record<string, unknown>) {
    role = 'OWNER';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <RoomDetailSheet
          room={checkedIn(over) as never}
          onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
          onStatusChange={vi.fn()} statusLoading={false}
        />
      </QueryClientProvider>,
    );
  }

  it('is named, and the overstay is spelled out', () => {
    mountWith({ overdueNights: 2 });

    expect(screen.getByText(/Shamim/)).toBeTruthy();
    expect(screen.getByText(/2 nights past checkout/i)).toBeTruthy();
  });

  it('says night, not nights, for a single one', () => {
    mountWith({ overdueNights: 1 });

    expect(screen.getByText(/1 night past checkout/i)).toBeTruthy();
  });

  it('says due out today for a guest leaving today, not overstaying', () => {
    mountWith({ overdueNights: 0, dueOutToday: true });

    expect(screen.getByText(/due out today/i)).toBeTruthy();
    expect(screen.queryByText(/past checkout/i)).toBeNull();
  });

  it('says neither for a stay still running', () => {
    mountWith({ overdueNights: 0, dueOutToday: false });

    expect(screen.getByText(/Currently Occupied/i)).toBeTruthy();
    expect(screen.queryByText(/past checkout/i)).toBeNull();
    expect(screen.queryByText(/due out today/i)).toBeNull();
  });
});

describe('before the role is known', () => {
  it('shows no mutation control while the store is still rehydrating', () => {
    // `useAuthStore` is persisted, so `user` is null for a tick on a cold
    // load. Treating "no role yet" as permission would put the buttons on
    // screen for a receptionist — the same bug, in a shorter window.
    mountSheet(null);

    expect(screen.queryByText('Edit Room')).toBeNull();
    expect(screen.queryByLabelText('Delete room')).toBeNull();
  });

  it('does not flash Add Room onto the rooms page either', async () => {
    mountPage(null);
    await screen.findByText('Rooms & Villas');

    expect(screen.queryByText('Add Room')).toBeNull();
  });
});

describe('what a receptionist keeps', () => {
  it('can still change the room status, which the API does allow', () => {
    mountSheet('RECEPTIONIST');

    expect(screen.getByText('Change Status')).toBeTruthy();
    expect(screen.getByText('Cleaning')).toBeTruthy();
  });

  it('still sees the room itself', () => {
    mountSheet('RECEPTIONIST');

    expect(screen.getByText('#101')).toBeTruthy();
  });
});
