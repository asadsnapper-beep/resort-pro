/**
 * Whether the detail sheet offers status changes the API will refuse.
 *
 * Change Status rendered every status but the current one, filtered on nothing
 * else. The API has been stricter since RM-001 and RM-004: while a guest is
 * checked into the room the only status it accepts is Occupied, and while a
 * maintenance ticket is open, a between-stay clean is running, or a booking
 * holds the room today, it refuses Available. So a receptionist looking at an
 * occupied room was offered Cleaning, Maintenance, Reserved and Available, and
 * every one of them came back 409 — RM-005's shape again, decided by the
 * room's state rather than the user's role.
 *
 * The rule itself is not restated here, and is not restated in the component.
 * `GET /api/rooms/:id` reports the room's blocker from the same `roomBlocker`
 * the write consults, and `blockerRefuses` in @resort-pro/types is the one
 * predicate both the endpoint and this sheet ask. These tests describe only
 * what the receptionist should see.
 *
 * Written and run against the unmodified sheet first: every "does not offer"
 * test below failed — all four buttons were on screen — and the three
 * explanation tests failed too, which is the finding reproduced.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserRole } from '@resort-pro/types';

vi.mock('@/lib/api', () => ({
  roomsApi: {
    list: vi.fn(), get: vi.fn(), stats: vi.fn(),
    create: vi.fn(), update: vi.fn(), remove: vi.fn(), updateStatus: vi.fn(),
  },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

let role: UserRole | null = 'RECEPTIONIST';
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

import { RoomDetailSheet } from '@/components/rooms/RoomDetailSheet';

const baseRoom = {
  id: 'r1', tenantId: 't1', number: '101', name: 'Garden View', type: 'STANDARD',
  status: 'AVAILABLE', floor: 1, maxOccupancy: 2, basePrice: 2500,
  description: null, amenities: [], images: [], videos: [], isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  currentBooking: null,
};

/** The four buttons Change Status can show. */
const ALL = ['Cleaning', 'Maintenance', 'Reserved', 'Available'] as const;

const offered = () =>
  ALL.filter(label => screen.queryByRole('button', { name: label }) !== null);

type Blocker = { code: string; status: string; error: string };

function mountSheet(room: Partial<typeof baseRoom> & { blocker?: Blocker | null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoomDetailSheet
        room={{ ...baseRoom, ...room } as never}
        onClose={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()}
        onStatusChange={vi.fn()} statusLoading={false}
      />
    </QueryClientProvider>,
  );
}

const guestBlocker: Blocker = {
  code: 'ROOM_HAS_CHECKED_IN_GUEST',
  status: 'OCCUPIED',
  error: 'Room 101 has a guest checked in (Rahim Uddin, booking BK-0007). Check them out before changing the room’s status.',
};

const maintenanceBlocker: Blocker = {
  code: 'ROOM_HAS_OPEN_MAINTENANCE',
  status: 'MAINTENANCE',
  error: 'Room 101 has maintenance still open (Air conditioner is dead). Resolve the ticket to put the room back on sale.',
};

const cleaningBlocker: Blocker = {
  code: 'ROOM_IS_BEING_CLEANED',
  status: 'CLEANING',
  error: 'Room 101 is still being cleaned. Complete the housekeeping task to put the room back on sale.',
};

const heldBlocker: Blocker = {
  code: 'ROOM_IS_HELD_TODAY',
  status: 'RESERVED',
  error: 'Room 101 is held for booking BK-0009 today. Cancel or move that booking to free the room.',
};

afterEach(() => { cleanup(); role = 'RECEPTIONIST'; });

describe('a room with a guest checked into it', () => {
  it('offers no status change at all, because the API accepts only Occupied', () => {
    // Before: Cleaning, Maintenance, Reserved and Available were all on
    // screen, and clicking any of them was a 409.
    mountSheet({ status: 'OCCUPIED', blocker: guestBlocker });

    expect(offered()).toEqual([]);
  });

  it('says who is in the room instead of leaving an empty section', () => {
    // An empty Change Status heading reads as a broken page. The server's own
    // sentence names the guest, the booking, and the one action that helps.
    mountSheet({ status: 'OCCUPIED', blocker: guestBlocker });

    expect(screen.getByText('Change Status')).toBeTruthy();
    expect(screen.getByText(guestBlocker.error)).toBeTruthy();
  });

  it('still offers nothing when the stored status has drifted off Occupied', () => {
    // RM-001's repair case: the room row says Available while somebody is
    // asleep in it. Occupied is the only status the API takes, and it is not
    // a change the front desk should have to make by hand here.
    mountSheet({ status: 'AVAILABLE', blocker: guestBlocker });

    expect(offered()).toEqual([]);
  });
});

describe('a room that is blocked but empty', () => {
  it('drops Available while a maintenance ticket is open', () => {
    mountSheet({ status: 'MAINTENANCE', blocker: maintenanceBlocker });

    expect(screen.queryByRole('button', { name: 'Available' })).toBeNull();
  });

  it('keeps the statuses the API still accepts', () => {
    // Marking a blocked room as Cleaning is honest work and must not be in
    // anybody's way — only the claim that the room is ready is refused.
    mountSheet({ status: 'MAINTENANCE', blocker: maintenanceBlocker });

    expect(offered()).toEqual(['Cleaning', 'Reserved']);
  });

  it('explains which ticket is holding the room', () => {
    mountSheet({ status: 'MAINTENANCE', blocker: maintenanceBlocker });

    expect(screen.getByText(maintenanceBlocker.error)).toBeTruthy();
  });

  it('drops Available while a between-stay clean is in progress', () => {
    mountSheet({ status: 'CLEANING', blocker: cleaningBlocker });

    expect(offered()).toEqual(['Maintenance', 'Reserved']);
    expect(screen.getByText(cleaningBlocker.error)).toBeTruthy();
  });

  it('drops Available while a booking holds the room today', () => {
    mountSheet({ status: 'RESERVED', blocker: heldBlocker });

    expect(offered()).toEqual(['Cleaning', 'Maintenance']);
    expect(screen.getByText(heldBlocker.error)).toBeTruthy();
  });
});

describe('a room nothing is blocking', () => {
  it('offers every status but the one it already has', () => {
    mountSheet({ status: 'AVAILABLE', blocker: null });

    expect(offered()).toEqual(['Cleaning', 'Maintenance', 'Reserved']);
  });

  it('shows no explanation, because there is nothing to explain', () => {
    mountSheet({ status: 'AVAILABLE', blocker: null });

    expect(screen.queryByText(/room 101 (has|is)/i)).toBeNull();
  });

  it('behaves as it always did when the API did not report a blocker', () => {
    // A newer bundle can be served against an API that has not been deployed
    // yet. With no blocker to read, the sheet offers what it always offered
    // and the 409 toast is the fallback, rather than hiding every button.
    mountSheet({ status: 'OCCUPIED' });

    expect(offered()).toEqual(['Cleaning', 'Maintenance', 'Reserved', 'Available']);
  });
});

describe('what the role gate and the state gate each decide', () => {
  it('hides Edit from a receptionist and the refused statuses from everyone', () => {
    // The two gates are separate questions. RM-005 asks who you are; this one
    // asks what is standing in the room.
    mountSheet({ status: 'OCCUPIED', blocker: guestBlocker });

    expect(screen.queryByText('Edit Room')).toBeNull();
    expect(offered()).toEqual([]);
  });

  it('refuses an owner the same statuses, because the room decides this one', () => {
    role = 'OWNER';
    mountSheet({ status: 'MAINTENANCE', blocker: maintenanceBlocker });

    expect(screen.getByText('Edit Room')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Available' })).toBeNull();
  });
});
