# Android app — code review, 29 August 2026

Reviewed at 29 Kotlin sources / 3,533 lines in `apps/android`, covering the
foundation, auth, Rooms/Availability, Housekeeping and Walk-in slices.

**Scope of this review, stated up front:** this is a reading of the source. The
app was **not built or run** — no emulator, no device, no build. Anything about
runtime behaviour, UI polish, jank or crashes is outside what this can tell you.
Everything below is traceable to a file and line.

---

## What is already right

These are load-bearing decisions that would be expensive to get back if someone
"simplified" them later.

**Walk-in submission does not auto-retry an uncertain outcome.**
[`WalkInViewModel.kt:256`](../../apps/android/app/src/main/java/site/resortpro/android/feature/walkin/WalkInViewModel.kt#L256)
distinguishes a 409 conflict, a definite client error, and *"the connection
ended and I do not know whether the booking was created"* — and for the third
it stops, sets `submissionUncertain`, and tells the operator to check Front Desk
before retrying. A naive implementation retries here and creates a double
booking against a real room on a real night. Keep this.

**Refresh token storage.** AES/GCM through the Android Keystore, a fresh IV per
record, and the store wipes itself if decryption fails rather than limping on
with a corrupt value
([`SecureRefreshCookieJar.kt:81`](../../apps/android/app/src/main/java/site/resortpro/android/core/security/SecureRefreshCookieJar.kt#L81)).
`allowBackup="false"` in the manifest, so it does not ride out in a cloud
backup. Access token is memory-only and never persisted
([`SessionStore.kt`](../../apps/android/app/src/main/java/site/resortpro/android/core/security/SessionStore.kt)).

**Cleartext HTTP is debug-only.** `http://10.0.2.2:4000` is in the debug
buildType with its own `network_security_config.xml`; release points at
`https://api.resortpro.site`. Release also has R8 and resource shrinking on.

**The 401 refresh is serialised.** `SessionAuthenticator` bails after two
attempts and takes a lock before refreshing, so a burst of parallel 401s
produces one refresh rather than a stampede
([`AuthNetworking.kt:39-42`](../../apps/android/app/src/main/java/site/resortpro/android/core/network/AuthNetworking.kt#L39)).

**Role checks are not decoration.** `RolePolicy` gates entry points, and the API
independently enforces the same scope — Staff sees only their own housekeeping
tasks on both sides. Hiding a button is not authorisation, and this does not
pretend otherwise.

---

## What to fix, in priority order

### 1. There is no offline story at all — this is the biggest gap

No Room database, no DataStore, no OkHttp cache. Every screen is a live network
read. When the network drops, the app shows an error card and nothing else.

Why this matters more here than in a generic app: a receptionist is standing in
a lobby on flaky WiFi, and housekeeping staff walk floors and outbuildings where
there is no signal at all. Those are the two roles this app is for.

It is also the argument for the app existing. Without offline, a mobile browser
pointed at the dashboard does the same job.

**Do:**
- Cache the read paths — room list, housekeeping tasks, dashboard stats — in
  Room, and show a visible "last synced" time rather than pretending the data is
  live.
- Give housekeeping status updates an outbox: queue the change locally, apply it
  optimistically, flush when connectivity returns. The optimistic rollback logic
  already exists; it needs somewhere to wait.
- Decide explicitly what must *not* work offline. Walk-in booking should stay
  online-only — it needs live availability and server-side pricing, and a queued
  booking is a double-booking waiting to happen.

**Cost of delaying:** every repository and ViewModel gets rewritten when this
lands. It is much cheaper at four features than at twelve.

### 2. Navigation is hand-rolled string state

[`ResortProApp.kt:77`](../../apps/android/app/src/main/java/site/resortpro/android/ui/ResortProApp.kt#L77)
holds `var destination by rememberSaveable { mutableStateOf("home") }` and a
`when` block. No navigation library is present anywhere in the project.

Consequences today:

- **System back does not work.** From Rooms, back exits the app instead of
  returning home. On Android that is not a rough edge; it is the app being
  wrong.
- No deep links, so a notification cannot open a specific task or booking.
- The `when` grows by one branch per screen, in the file that is already the
  largest.

**Do:** adopt Navigation Compose while there are four destinations.

### 3. `ResortProApp.kt` is 527 lines and holds five unrelated things

Login, Home, `StatCard`, `ErrorCard`, `LoadingCard` all live in one file. It is
the largest file in the app and grows with every feature.

**Do:** split `LoginScreen` and `HomeScreen` into their own files and move the
shared cards into `ui/components/`. Mechanical, and best done together with the
navigation change since both touch the same file.

### 4. Every ViewModel is Activity-scoped and hand-wired

[`MainActivity.kt`](../../apps/android/app/src/main/java/site/resortpro/android/MainActivity.kt)
constructs four ViewModels with four hand-written factories, all held for the
Activity's lifetime. At twelve features that is twelve ViewModels alive at once
and a constructor list to match.

**Do:** scope ViewModels to their destination when navigation lands. Hilt would
also remove the factory boilerplate, but it is not required — `AppContainer` is
a reasonable manual container and works fine.

### 5. `loadRooms()` pages without a ceiling

[`RoomsRepository.kt:27`](../../apps/android/app/src/main/java/site/resortpro/android/feature/rooms/RoomsRepository.kt#L27)
loops `do … while (page <= totalPages)` at 100 per page, with no cap and no
cancellation between pages. Fine for a ten-room resort. A multi-property tenant
with 500 rooms is five sequential round trips on mobile data before anything
renders.

**Do:** cap the page count, or page lazily in the list rather than fetching
everything up front.

### 6. No instrumented or UI tests

Seven test files, 22 tests, all pure unit tests of validators and policies —
which is a good base. But `app/src/androidTest/` is empty, so nothing covers
login, the 401 refresh-and-retry, or walk-in submission.

**Do:** three tests, in this order — walk-in double-tap and uncertain-outcome
handling first, because that one is about money; then 401 refresh and retry;
then login to home.

---

## Recommended order

1. **Offline** (Room cache for reads, outbox for housekeeping writes)
2. **Navigation Compose**, and split `ResortProApp.kt` in the same change
3. Screen-scoped ViewModels
4. Page cap in `loadRooms()`
5. The three instrumented tests

The first two are ordered by what gets more expensive with delay, not by size.
The rest can be picked up whenever.

---

## Not assessed

- Runtime behaviour, performance, jank, crashes — the app was not built or run.
- Visual design and layout on real devices.
- Accessibility (TalkBack, touch target sizes, font scaling).
- Play Store readiness — see `PLAY_STORE_COMPLIANCE.md`, not re-checked here.
- The generated `build/` output, 160 MB of the directory's 172 MB. It is covered
  by `apps/android/.gitignore`; confirm with `git add -n apps/android/ | wc -l`
  before committing, and expect tens of files, not hundreds.

---

## Resolution status — 29 August 2026

All six findings above are implemented:

1. Room now caches dashboard, room, and role-scoped housekeeping reads with a
   visible last-synced state. Housekeeping status writes use a WorkManager outbox;
   walk-in booking remains deliberately online-only.
2. Navigation Compose owns the home, rooms, housekeeping, and walk-in back stack,
   so system Back returns from a feature to Home.
3. The former 527-line `ResortProApp.kt` is now a small router; Login, Home, and
   shared state cards live in separate files.
4. Feature ViewModels are scoped to their navigation destination. Only the auth
   session ViewModel remains Activity-scoped intentionally.
5. Room preload is capped at three 100-item pages and the UI explicitly marks a
   truncated result. Live availability remains the complete query path.
6. Instrumented coverage now includes walk-in double-submit/uncertain handling,
   an actual OkHttp 401 refresh-and-retry flow, and login-to-role-aware-home.

During the fix, walk-in submission reservation was also moved before coroutine
launch to close a double-tap race. The API status route now accepts
`expectedStatus`, returns idempotent success for an already-applied target, and
returns `409 HOUSEKEEPING_STATUS_CONFLICT` for a stale queued update.

Repository verification recorded for this resolution: API typecheck passed;
31 targeted API tests passed; Android Kotlin and instrumented-test sources
compiled. Physical-device execution is still pending until test hardware is
available.
