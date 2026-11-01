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

import type { UserRole } from './index';

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
