# Guest Document Scanner — Plan

## Overview

Check-in এর সময় staff camera দিয়ে guest এর ID card / passport / visa scan করতে পারবে।
Webcam (desktop/Electron) এবং tablet এর rear camera — দুটোই support করবে।

---

## Problem

Guest check-in এ staff manually ID নম্বর, নাম, nationality টাইপ করে → ধীর + ভুল হয়।
Document image record থাকে না — compliance এর জন্য সমস্যা।

## Solution

Camera দিয়ে document capture → image store + optional OCR auto-fill

---

## Platform Support

| Platform | Camera Source |
|----------|--------------|
| Desktop (Electron app) | Webcam — `getUserMedia({ facingMode: 'user' })` |
| Tablet (iPad / Android) | Rear camera — `getUserMedia({ facingMode: 'environment' })` |
| Browser (web app) | যেকোনো connected / built-in camera |

Browser MediaDevices API সব platform এ কাজ করে — আলাদা native code দরকার নেই।

---

## Document Types

- `PASSPORT`
- `NATIONAL_ID`
- `DRIVERS_LICENSE`
- `VISA`
- `OTHER`

---

## UI Flow

```
[Scan Document] button (guest profile / check-in modal)
    ↓
DocumentScannerModal opens
    ↓
Camera live preview (rear camera on tablet, webcam on desktop)
    ↓
[Switch Camera] button — front/rear toggle
    ↓
Staff aims at document → [Capture 📷] button
    ↓
Shutter flash animation → image preview shown
    ↓
[Retake] ← → [Use This Photo →]
    ↓
Image uploaded → stored in guest profile
    ↓
Thumbnail shown in guest profile under "Documents"
```

---

## Build Phases

### Phase 1 — Camera Capture UI (Frontend)

**File:** `apps/web/src/components/guests/DocumentScannerModal.tsx`

Features:
- `getUserMedia` with `facingMode: 'environment'` (tablet rear) → fallback `'user'` (webcam)
- Live `<video>` preview
- Camera switch button (front ↔ rear)
- Capture button → draws frame to `<canvas>` → converts to blob
- Preview captured image before confirm
- Retake option
- Upload on confirm

### Phase 2 — Database

**Prisma model addition:**

```prisma
model GuestDocument {
  id         String   @id @default(uuid())
  guestId    String
  tenantId   String
  docType    String   // PASSPORT | NATIONAL_ID | DRIVERS_LICENSE | VISA | OTHER
  imageUrl   String
  notes      String?
  uploadedAt DateTime @default(now())
  uploadedBy String?  // staff user ID

  guest  Guest  @relation(fields: [guestId], references: [id], onDelete: Cascade)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([guestId])
  @@index([tenantId])
  @@map("guest_documents")
}
```

Migration: `pnpm --filter database db:migrate`

### Phase 3 — API Endpoints

**File:** `apps/api/src/routes/guests.ts` (new sub-routes) or separate `guestDocuments.ts`

```
POST   /api/guests/:id/documents        — upload document image (multipart)
GET    /api/guests/:id/documents        — list all documents for a guest
DELETE /api/guests/:id/documents/:docId — delete a document
```

Upload flow:
- Receive multipart image
- Validate: max 10MB, image/* only
- Save to `/uploads/guest-docs/{tenantId}/{guestId}/`
- Create `GuestDocument` record
- Return `{ id, imageUrl, docType, uploadedAt }`

### Phase 4 — UI Integration

**Where scanner appears:**

1. **Guest Profile page** (`/dashboard/guests/[id]`)
   - "Documents" section with thumbnail grid
   - "+ Scan Document" button

2. **Check-in Modal** (`/dashboard/front-desk`)
   - Quick scan option during check-in flow
   - "Scan ID" button next to guest name field

3. **New Guest Form** (guest creation)
   - Optional scan at creation time

### Phase 5 — OCR Auto-fill (Optional, Later)

**Library:** `tesseract.js` (v5) — runs in browser, no external API

Flow:
1. Capture image
2. Run `Tesseract.recognize(imageBlob, 'eng')` in a Web Worker
3. Parse extracted text:
   - Name (regex patterns for MRZ lines)
   - ID/Passport number
   - Nationality
   - Date of birth / expiry
4. Pre-fill guest form fields → staff confirms / corrects

Note: MRZ (Machine Readable Zone) parsing gives best results for passports.
Library for MRZ: `mrz` npm package.

---

## File Structure

```
apps/web/src/
  components/
    guests/
      DocumentScannerModal.tsx   ← camera capture UI
      GuestDocumentList.tsx      ← thumbnail grid display
  app/(dashboard)/dashboard/
    guests/[id]/page.tsx         ← add Documents section

apps/api/src/
  routes/
    guestDocuments.ts            ← upload / list / delete endpoints

packages/database/prisma/
  schema.prisma                  ← GuestDocument model
  migrations/                    ← new migration
```

---

## Technical Notes

### Camera Access (getUserMedia)

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { ideal: 'environment' }, // rear camera preferred
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  }
});
```

### Capture Frame

```typescript
const canvas = document.createElement('canvas');
canvas.width = videoEl.videoWidth;
canvas.height = videoEl.videoHeight;
canvas.getContext('2d')!.drawImage(videoEl, 0, 0);
canvas.toBlob(blob => { /* upload blob */ }, 'image/jpeg', 0.92);
```

### Camera Cleanup

```typescript
// Always stop tracks when modal closes
stream.getTracks().forEach(track => track.stop());
```

### Electron / Desktop

No special handling needed — Electron uses Chromium's `getUserMedia`.
Permission: set in `ses.setPermissionRequestHandler` (already done in `main.ts` for notifications — add `'media'` permission).

---

## Privacy / Compliance

- Guest documents are sensitive PII — store with care
- Access restricted to authenticated staff of the same tenant
- Option to delete documents after X days (configurable)
- Never expose document URLs publicly — serve through authenticated API
- Consider adding watermark to stored images

---

## Status

- [x] Phase 1 — Camera capture UI (`DocumentScannerModal.tsx`)
- [x] Phase 2 — Prisma migration (GuestDocument model + migration applied)
- [x] Phase 3 — API endpoints (`guestDocuments.ts` — upload / list / delete)
- [x] Phase 4 — UI integration (`GuestDocumentList.tsx` + `GuestDetailSheet.tsx`)
- [ ] Phase 5 — OCR auto-fill (optional)
