# Web UI Component Inventory (initial)

Scanned: `apps/web/src/components`

- admin/
- booking/
- bookings/
  - BookingDetailSheet.tsx
  - NewBookingModal.tsx
  - WalkInModal.tsx
- dashboard/
  - DemoBanner.tsx
  - PlatformBanner.tsx
  - sidebar.tsx
  - top-nav.tsx
  - website/ (subfolder)
- guests/
- rooms/
  - RoomDetailSheet.tsx
  - RoomModal.tsx
- staff/
- templates/
- themes/
- ui/
  - ImageUpload.tsx
  - badge.tsx
  - button.tsx
  - card.tsx
  - input.tsx
  - modal.tsx
  - toast.tsx
  - toaster.tsx
- providers.tsx

Notes:
- `packages/ui/src` is currently empty — design system not implemented yet.
- `apps/mobile/src/components` is empty; mobile components likely in `screens/`.

Next steps:
1. Scan `apps/web/src/app`, `hooks`, and `store` for pages and layout components.
2. Scan `apps/mobile/src/screens` for mobile UI screens.
3. Begin creating a migration plan for shared components into `packages/ui/src`.
