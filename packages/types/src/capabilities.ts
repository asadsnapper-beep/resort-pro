// ─── Who may do what — single source of truth ─────────────────────────────────
// The API and the screens read the same table, so a control can never be
// offered to somebody the API will refuse.
//
// They used to disagree. The rooms page and the room detail sheet rendered Add
// Room, Edit Room and Delete for everybody who could reach the page, while the
// API required Owner or Manager to create or edit and Owner to delete. A
// Receptionist's real journey was to open Add Room, fill the form, submit, and
// be handed a 403 — secure at the API, and broken as a workflow.
// (Room Management QA 2026-10-28, RM-005.)
//
// Restating the rule on the client would only have moved the bug: two copies
// drift, and the one that drifts wide is the one that offers a dead control.
// So the API passes these arrays straight to `requireRole`, and the screens ask
// `can()`. Widening or narrowing a permission is one edit, in one place.

import type { RoomStatus, UserRole } from './index';

/** `rooms.ts`'s own policy. Reading is deliberately absent — every role that
 *  can reach the page may look; these are the four things it can *do*. */
export const ROOM_CAPABILITIES = {
  create:       ['OWNER', 'MANAGER'],
  update:       ['OWNER', 'MANAGER'],
  delete:       ['OWNER'],
  changeStatus: ['OWNER', 'MANAGER', 'RECEPTIONIST'],
} as const satisfies Record<string, readonly UserRole[]>;

export type RoomCapability = keyof typeof ROOM_CAPABILITIES;

/**
 * Whether `role` holds `capability`.
 *
 * A missing role is refused rather than waved through: on the client the user
 * can be null for a tick while the store rehydrates, and a control that
 * flickers into existence before the role is known is the same bug in a
 * shorter window.
 */
export function canRoom(
  role: UserRole | null | undefined,
  capability: RoomCapability,
): boolean {
  if (!role) return false;
  return (ROOM_CAPABILITIES[capability] as readonly UserRole[]).includes(role);
}

// ─── What the room's own state refuses ───────────────────────────────────────
// The table above answers "who are you". This answers "what is standing in
// this room", which the API has refused on since RM-001 and RM-004 and the
// screens could not see.
//
// Change Status in the detail sheet rendered every status but the current one.
// So a receptionist looking at an occupied room was offered Cleaning,
// Maintenance, Reserved and Available, and all four came back 409 — RM-005's
// defect again, decided by the room instead of the role.
//
// `GET /api/rooms/:id` now reports the room's blocker, and the predicate below
// is asked by both sides: `PATCH /:id/status` to decide what to refuse, and
// the sheet to decide what to offer. The wording and the order of the blockers
// stay in apps/api/src/utils/room-state.ts, which is the only place that can
// ask the database; what travels to the client is the code, which is all the
// client needs to know to stop offering a dead control.

/** Why a room cannot be declared ready, as `roomBlocker` reports it. */
export type RoomBlockerCode =
  | 'ROOM_HAS_CHECKED_IN_GUEST'
  | 'ROOM_HAS_OPEN_MAINTENANCE'
  | 'ROOM_IS_BEING_CLEANED'
  | 'ROOM_IS_HELD_TODAY';

/** A blocker as `GET /api/rooms/:id` reports it. */
export interface RoomBlockerReport {
  code: RoomBlockerCode;
  /** The status the room must have while this blocker holds. */
  status: RoomStatus;
  /** Said to whoever tried to contradict it, naming what to do instead. */
  error: string;
}

/**
 * Whether a room with this blocker refuses `status`.
 *
 * A guest is the widest veto: they are physically in the room, so Occupied is
 * the only thing the room may say. The others are narrower and all say the
 * same thing — **Available is a claim, and it cannot be made while the room is
 * still blocked.** Marking a room that is held for tonight as Cleaning is
 * honest work and must not be in anybody's way.
 */
export function blockerRefuses(code: RoomBlockerCode, status: RoomStatus): boolean {
  return code === 'ROOM_HAS_CHECKED_IN_GUEST'
    ? status !== 'OCCUPIED'
    : status === 'AVAILABLE';
}
