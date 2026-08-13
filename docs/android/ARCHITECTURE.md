# ResortPro Android Architecture

> Status: Proposed architecture — implementation has not started
>
> Target path: `apps/android/`
>
> Last repository review: 2026-08-09
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
| Dependency injection | Hilt | One DI framework for the application. |
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

Before implementation, prove the cookie flow with an integration test against the
real API. If OkHttp cookie persistence cannot satisfy the contract safely, design
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
- Queue only idempotent mutations with an agreed server idempotency contract.
- Do not queue booking creation in the MVP; booking conflicts require an online
  server decision.
- When reconnecting, refresh from the server before applying new operational
  actions.

Full offline writes require version fields, conflict rules, idempotency keys,
retry limits, and an operator-visible conflict screen. That is a separate design.

## 9. Delivery roadmap and exit criteria

### Phase 0 — Contract and project foundation

- Create `apps/android/` and a reproducible Gradle build.
- Record supported `minSdk`, `compileSdk`, and `targetSdk` after checking current
  Play requirements and the chosen dependency versions.
- Add Hilt, Retrofit, Kotlinx Serialization, Room, DataStore, and test tooling.
- Prove login, refresh-cookie rotation, logout, and a bearer-authenticated request.

Exit: CI builds debug and release variants; auth integration tests pass.

### Phase 1 — Authentication and app shell

- Build login, email-verification-required, loading, error, and signed-out states.
- Add role-aware navigation and ResortPro design tokens.
- Add accessibility semantics and screenshot tests for core states.

Exit: a verified test user can sign in, restart the app, refresh safely, and log out.

### Phase 2 — Role-aware dashboard, rooms, and shareholder view

- Integrate `GET /api/dashboard`, room list, room details, and availability.
- For `SHAREHOLDER`, expose only the approved read-only dashboard/analytics and
  personal investment experience.
- Integrate `/api/shareholders/me` and `/api/shareholders/me/payouts`; never use
  owner-only shareholder-management endpoints from the shareholder experience.
- Add cached read states, explicit staleness, pull-to-refresh, and retry.

Exit: operational users can understand dashboard and room data during a network
interruption, while shareholders can see only their own cached investment data.

### Phase 3 — Housekeeping

- List/filter tasks and update task status.
- Apply optimistic UI only with rollback and a visible failure state.
- Respect server role and feature-entitlement errors.

Exit: authorized staff can complete the daily task flow on a physical device.

### Phase 4 — Walk-in booking

- Confirm booking DTOs and availability behavior against the current API.
- Build form validation, quote/summary, submission, and conflict handling.
- Do not cache or silently retry a submitted booking mutation.

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
