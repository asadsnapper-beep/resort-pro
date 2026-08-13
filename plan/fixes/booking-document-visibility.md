# Booking and Walk-in Document Visibility Fix

## Goal

Staff should be able to add a guest ID document while creating a booking or
checking in a walk-in guest. Afterward, the same document must be visible from
the booking detail and the guest profile.

This removes the current uncertainty about whether an ID was collected for a
specific stay.

## What exists today

| Flow | Add document | Stored on guest | Linked to booking | Visible from booking detail |
| --- | --- | --- | --- | --- |
| New Booking | Yes, in the final confirmation step | Yes | Yes | No |
| Front Desk walk-in | Yes, via **+ Add Document** | Yes | Yes | No |
| Bookings page walk-in | No | No | No | No |

The two walk-in entry points are not equivalent. The Front Desk flow already
uploads a document after it creates the guest and booking. The **Walk-in**
button on `/dashboard/bookings` uses an older modal and does not offer the same
control.

## Current code paths

- New Booking UI: `apps/web/src/components/bookings/NewBookingModal.tsx`
- Bookings page mutation and document upload: `apps/web/src/app/(dashboard)/dashboard/bookings/page.tsx`
- Bookings page Walk-in modal: `apps/web/src/components/bookings/WalkInModal.tsx`
- Front Desk Walk-in modal: `apps/web/src/app/(dashboard)/dashboard/front-desk/page.tsx`
- Booking detail sheet: `apps/web/src/components/bookings/BookingDetailSheet.tsx`
- Reusable document renderer: `apps/web/src/components/guests/GuestDocumentList.tsx`
- Document upload API: `guestsApi.uploadDocument(guestId, formData)`

## Required behaviour

1. A staff member can add an optional ID document in every booking-creation
   flow.
2. The booking is created first. The document upload then includes both
   `guestId` and `bookingId`.
3. A document-upload failure never cancels a successful booking or check-in.
   The user sees a clear retry message instead.
4. Opening a booking shows its guest documents without requiring the user to
   navigate away first.
5. The booking detail links to the complete guest profile for older documents
   that belong to other stays.
6. Existing documents and existing bookings keep working without data changes.

## Implementation plan

### 1. Make both walk-in entry points use the same document behaviour

Add `AddDocumentInline` and `PendingDocument` handling to
`apps/web/src/components/bookings/WalkInModal.tsx`.

After `bookingsApi.create(...)` returns:

1. Read the created booking ID and guest ID from the response.
2. Build `FormData` with `file`, `docType`, and `bookingId`.
3. Call `guestsApi.uploadDocument(guestId, formData)`.
4. If upload fails, keep the booking successful and show: 
   **“Walk-in checked in, but document upload failed. Add it from the guest profile.”**

Keep the same behaviour already used in the Front Desk walk-in flow. Do not
create a second document API or store document files on the `Booking` model.

### 2. Reuse document upload logic

Extract the post-create document upload into a small shared helper or hook.
It should accept:

```ts
{
  guestId: string;
  bookingId: string;
  pendingDocument: PendingDocument | null;
}
```

This avoids the New Booking, Front Desk Walk-in, and Bookings-page Walk-in
flows drifting apart again.

### 3. Show documents in Booking Detail

Add a **Guest Documents** section to
`apps/web/src/components/bookings/BookingDetailSheet.tsx` below the guest
summary.

- Reuse `GuestDocumentList` instead of making another viewer.
- Load documents for `booking.guest.id`.
- Clearly show the document type, thumbnail, upload date, and document status.
- Show an empty state: **“No documents added for this guest yet.”**
- Keep the existing **View guest profile** link for full guest history.

If the API already returns `bookingId` on each document, visually mark
documents captured for the current booking. Otherwise, extend the documents
list endpoint and renderer to expose it.

### 4. Keep booking-specific context

Review the guest-document list API and ensure it returns `bookingId` for each
document. This lets the UI distinguish:

- **This booking** — document was collected for the stay being viewed.
- **Guest history** — document belongs to the same guest but another stay.

No document should be duplicated merely to make it visible in both places.

### 5. Permissions and safety

- Restrict document viewing to the same roles that can view guest and booking
  details.
- Keep tenant scoping on every document query and upload.
- Do not expose document download URLs to another tenant.
- Preserve the current best-effort upload behaviour: booking/check-in succeeds
  even if file storage is unavailable.

## Acceptance checklist

### New Booking

- Create a booking with an ID document.
- Open the created booking detail; the document is visible.
- Open the guest profile; the same document is visible once.
- Force document upload to fail; booking remains created and a clear warning
  appears.

### Front Desk Walk-in

- Check in a walk-in with **+ Add Document**.
- Open the booking detail; the document is visible.
- Confirm the document has the new booking ID.

### Bookings page Walk-in

- Open `/dashboard/bookings` → **Walk-in**.
- Confirm the document picker matches the Front Desk flow.
- Create a walk-in with a document and confirm it is visible in both places.

### Regression checks

- Existing bookings still open correctly.
- Existing guest documents remain visible.
- A user from another tenant cannot list, view, or download the document.
- Mobile modal remains scrollable and the document picker remains reachable.

## Out of scope

- OCR extraction or ID scanning improvements.
- Changes to document retention policy.
- Replacing file storage or adding a new document type.

Those can be planned separately after this visibility and consistency fix is
complete.
