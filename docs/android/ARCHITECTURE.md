# ResortPro Android Architecture

> Status: Phase 0 foundation complete; Phase 1 device verification in progress
>
> Target path: `apps/android/`
>
> Last repository review: 2026-08-29
>
> Audience: Android engineers and backend engineers building the ResortPro staff app

## 1. Purpose

ResortPro Android is a native operational and investor companion for resort
owners, managers, receptionists, operational staff, and shareholders. It will
reuse the existing Fastify API in `apps/api` and focus on workflows that users
need while away from the desktop dashboard.

The first release is not a mobile copy of the entire web dashboard. It should make
the following tasks fast and reliable:

- Sign in to an existing ResortPro tenant.
- See today's operational summary.
- View room state and availability.
- Complete housekeeping tasks.
- Create a walk-in booking.
- Let shareholders review their own investment and payout information.
- Continue read-only work during short network interruptions.

## 2. Scope

### MVP scope

- Email, password, and resort-slug authentication.
- Email-verification and expired-session handling.
- Role-aware navigation and API error states.
- Dashboard summary, rooms, housekeeping, and walk-in booking.
- A read-only shareholder experience for personal ownership, estimated share,
  and payout history.
- Local caching for operational lists.
- Dark and light themes, accessibility, crash reporting, and release builds.

### Deferred until after the MVP

- Full offline booking creation and multi-device conflict resolution.
- QR/NID scanning and document retention.
- Bluetooth receipt printing.
- Push notifications.
- Owner subscription upgrades inside the app.
- iOS or Kotlin Multiplatform support.

These items require separate product, privacy, hardware, or backend decisions and
must not be treated as implicit MVP requirements.

## 3. Confirmed technical decisions

| Area | Decision | Notes |
| --- | --- | --- |
| Language | Kotlin | Use the stable version supported by the selected Android Gradle Plugin. |
| UI | Jetpack Compose + Material 3 | Single-activity application with Compose Navigation. |
| Architecture | Feature-oriented MVVM with domain boundaries | Add use cases where business rules justify them; avoid empty layers. |
| Dependency injection | Manual `AppContainer` | Keeps the current app small; feature ViewModels are created at their Navigation destination. Revisit Hilt only when boilerplate becomes measurable. |
| Networking | Retrofit + OkHttp | Kotlinx Serialization converter and centralized error mapping. |
| Local data | Room | Cache operational data and queued work only when a sync contract exists. |
| Preferences | DataStore | Store non-sensitive preferences such as theme and last tenant slug. |
| Secrets | Android Keystore-backed storage | Do not describe plain DataStore or SharedPreferences as encrypted. |
| Async state | Coroutines, Flow, and StateFlow | Collect lifecycle-aware in Compose. |
| Images | Coil | Size requests to their rendered bounds. |
| Background work | WorkManager | Only for durable, deferrable sync and upload work. |

## 4. System context

```text
Android UI
    ↓ intents / UI state
ViewModel
    ↓
Repository
    ├── Retrofit/OkHttp → ResortPro Fastify API → PostgreSQL
    └── Room database  → cached reads / explicitly queued writes
```

The API remains the source of truth. Tenant isolation, role authorization, plan
entitlements, booking conflicts, and financial rules stay server-side. The Android
client may improve presentation, but it must not recreate or bypass those rules.

## 5. Authentication contract

### Current backend behavior

- `POST /api/auth/login` requires `email`, `password`, and `slug`.
- A successful response returns an access token plus user and tenant data.
- The refresh token is issued as the `rp_refresh` HttpOnly cookie, scoped to
  `/api/auth`.
- `POST /api/auth/refresh` rotates the refresh token and returns a new access token.
- `POST /api/auth/logout` invalidates the refresh token.
- Unverified accounts receive `403` with code
  `EMAIL_VERIFICATION_REQUIRED`.

Example login body:

```json
{
  "email": "reception@example.com",
  "password": "example-only",
  "slug": "sample-resort"
}
```

### Android session design

1. Keep the short-lived access token in memory where possible.
2. Configure an OkHttp `CookieJar` that accepts and returns `rp_refresh` for the
   API origin.
3. If refresh-cookie persistence across process death is required, encrypt the
   persisted cookie with an Android Keystore-backed key.
4. On an authenticated `401`, perform one synchronized refresh attempt, retry the
   original request once, then clear the session if refresh fails.
5. Never use `runBlocking` inside an OkHttp interceptor to read DataStore.
6. Never log tokens, cookies, passwords, guest documents, or full payment data.

The first implementation persists only `rp_refresh`, encrypts it with an Android
Keystore-backed AES/GCM key, and uses one synchronized refresh coordinator for
concurrent `401` responses. It clears the session on terminal auth failures while
preserving the cookie for retry after network and server failures. Prove this flow
against the real API on an emulator and physical device before treating Phase 1 as
complete. If OkHttp cookie persistence cannot satisfy the contract safely, design
an explicit native-client refresh contract with the backend rather than adding an
insecure client workaround.

## 6. Initial API inventory

These routes exist in the current API and are the starting point, not a frozen
mobile contract:

| Workflow | Route | Notes |
| --- | --- | --- |
| Session | `POST /api/auth/login` | Requires tenant slug. |
| Refresh | `POST /api/auth/refresh` | Uses rotating refresh cookie. |
| Current user | `GET /api/auth/me` | Bearer access token required. |
| Dashboard | `GET /api/dashboard` | Summary stats and recent activity. |
| Rooms | `GET /api/rooms` | Paginated and role-protected. |
| Availability | `GET /api/rooms/availability` | Requires `checkIn` and `checkOut`. |
| Room status | `PATCH /api/rooms/:id/status` | Role-protected mutation. |
| Housekeeping | `GET /api/housekeeping` | Feature-flag and role protected. |
| Task status | `PATCH /api/housekeeping/:id/status` | Supports staff workflow. |
| Bookings | `/api/bookings/*` | Confirm request/response DTOs before building walk-in UI. |
| My investment | `GET /api/shareholders/me` | `SHAREHOLDER` only; returns the signed-in user's profile. |
| My payouts | `GET /api/shareholders/me/payouts` | `SHAREHOLDER` only and scoped to the signed-in user. |

Generate or hand-maintain Android DTOs only after checking the live route schema.
Do not import TypeScript types directly into the Android build.

## 7. Project structure

Prefer feature ownership over a large global `data/domain/ui` tree:

```text
apps/android/
├── app/
│   └── src/main/java/site/resortpro/android/
│       ├── ResortProApplication.kt
│       ├── MainActivity.kt
│       ├── core/
│       │   ├── designsystem/
│       │   ├── network/
│       │   ├── database/
│       │   ├── security/
│       │   └── model/
│       ├── feature/
│       │   ├── auth/
│       │   ├── dashboard/
│       │   ├── rooms/
│       │   ├── housekeeping/
│       │   ├── walkin/
│       │   ├── shareholder/
│       │   └── settings/
│       └── navigation/
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

Start with a single application module. Split Gradle modules only after build time,
ownership, or dependency boundaries provide a measured reason.

## 8. Offline strategy

The MVP is offline-tolerant, not fully offline-first:

- Cache dashboard, room, and housekeeping reads with `fetchedAt` metadata.
- Display cached content with a visible “Last updated” state.
- Never present cached availability as guaranteed availability.
- Queue housekeeping status mutations only. Each queued request includes the
  status originally observed; the API treats same-target retries as idempotent
  and rejects stale changes with `HOUSEKEEPING_STATUS_CONFLICT`.
- Do not queue booking creation in the MVP; booking conflicts require an online
  server decision.
- WorkManager flushes the housekeeping outbox when connectivity returns. A
  terminal conflict is removed from retry and the next server read reconciles it.

Full offline writes require version fields, conflict rules, idempotency keys,
retry limits, and an operator-visible conflict screen. That is a separate design.

## 9. Delivery roadmap and exit criteria

### Phase 0 — Contract and project foundation (complete)

- [x] Create the initial `apps/android/` single-module Compose scaffold and Gradle
  wrapper.
- [x] Record `minSdk 24`, `compileSdk 37`, and `targetSdk 36` after checking
  current Play requirements and selected stable dependencies.
- [x] Verify the foundation with `lintDebug`, `testDebugUnitTest`, and
  `assembleDebug` (2026-08-28).
- [x] Add Retrofit, OkHttp, Kotlinx Serialization, coroutines, and unit-test
  tooling.
- [x] Build and statically verify debug and R8-minified release variants
  (2026-08-29).
- [x] Add Room for dashboard, room, and housekeeping cache entries plus the
  housekeeping status outbox.
- [ ] Add DataStore when non-sensitive persisted preferences first require it.
- [ ] Prove login, refresh-cookie rotation, process-death restore, logout, and a
  bearer-authenticated request against the real API on a device.

Exit: CI builds debug and release variants; auth integration tests pass.

### Phase 1 — Authentication and app shell (implementation complete; device verification in progress)

- [x] Build login, email-verification-required, loading, retry, error, and
  signed-out states.
- [x] Add role-aware landing states and ResortPro design tokens.
- [x] Restrict financial dashboard data to Owner/Manager, omit it for
  Receptionist, give Staff a limited state, and use only `/api/shareholders/me`
  for the Shareholder landing state.
- [x] Add Compose UI coverage for login-to-home and the critical walk-in submit
  controls; add a real OkHttp 401 refresh-and-retry integration test.
- [ ] Add screenshot tests and complete an accessibility pass for core states.
- [ ] Complete live API and process-death device verification.

Exit: a verified test user can sign in, restart the app, refresh safely, and log out.

### Phase 2 — Role-aware dashboard, rooms, and shareholder view (in progress)

- [x] Integrate `GET /api/dashboard`, paginated room list, and date-range
  availability with loading, empty, error, and retry states.
- [ ] Add room details.
- [x] Add visible cache-age/offline states for dashboard and room reads.
- [x] For `SHAREHOLDER`, expose only the approved read-only dashboard/analytics and
  personal investment experience.
- [ ] Integrate shareholder payout history from
  `/api/shareholders/me/payouts`; never use
  owner-only shareholder-management endpoints from the shareholder experience.
- [x] Add cached read states and explicit staleness.
- [ ] Add pull-to-refresh.

Exit: operational users can understand dashboard and room data during a network
interruption, while shareholders can see only their own cached investment data.

### Phase 3 — Housekeeping (implementation complete; integration hardening pending)

- [x] List/filter tasks and update task status.
- [x] Apply optimistic UI with rollback and a visible failure state.
- [x] Respect server role and feature-entitlement errors in Android error states.
- [x] Limit the Staff UI to tasks whose assignee `userId` matches the signed-in
  user.
- [x] Enforce the same Staff assignment scope in API list, stats, and status-update
  queries. Integration coverage verifies own, other-user, and unassigned tasks.
- [x] Cache scoped tasks and queue offline status changes through a WorkManager
  outbox protected by the server expected-status contract.
- [ ] Verify between-stay room status transitions and rollback behavior against the
  real API on a physical device.

Exit: authorized staff can complete the daily task flow on a physical device.

### Phase 4 — Walk-in booking (implementation complete; device verification pending)

- [x] Confirm booking DTOs, live availability, rate-plan quote, payment method,
  advance, and conflict behavior against the current API.
- [x] Build guest/stay validation, capacity checks, room selection, server quote,
  submission, success, and conflict states.
- [x] Prevent double taps and never cache or automatically retry a booking
  mutation.
- [x] Treat lost connections, response parsing failures, and server failures after
  submission as uncertain; require staff to check Front Desk before manually
  enabling retry.
- [x] Accept Prisma Decimal values represented as either JSON strings or numbers in
  Android room/booking monetary DTOs.
- [x] Add Compose UI coverage for double-submit blocking and the manual
  acknowledgement required after an uncertain outcome.
- [ ] Add repository-level MockWebServer coverage for successful booking and
  `409` conflict responses.
- [ ] Verify the full flow against a test tenant on a physical device.

Exit: exactly one booking is created, conflicts are clear, and interrupted submits
can be reconciled safely.

### Phase 5 — Optional hardware and store release

- Evaluate CameraX scanning and Bluetooth printing as separate vertical slices.
- Complete the evidence-based release checklist in
  `PLAY_STORE_COMPLIANCE.md`.

Exit: signed App Bundle passes internal testing and all compliance evidence links
are recorded.

## 10. Required testing

- Unit tests for mappers, validators, reducers, and use cases.
- Repository tests with fake local and remote data sources.
- MockWebServer tests for auth refresh, error envelopes, and retries.
- Room migration tests from the first shipped schema onward.
- Compose UI tests for login, navigation, offline state, and core mutations.
- API integration tests for tenant isolation and role restrictions.
- Physical-device checks on at least one low-memory device and one current device.

## 11. Open decisions

- Final package/application ID ownership and signing authority.
- Minimum supported Android version based on pilot devices.
- Whether the MVP needs persistent refresh-cookie storage across process death.
- Crash/analytics provider and exact Data Safety declarations.
- Whether QR/NID scans are processed locally, uploaded, or retained.
- Printer models supported during the pilot.

Resolve each decision in a short ADR before its dependent feature begins.
