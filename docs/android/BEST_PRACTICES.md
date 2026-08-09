# ResortPro Android Engineering Guide

> Document type: How-to guide
>
> Status: Standards for the proposed `apps/android/` application
>
> Last repository review: 2026-08-09

Use this guide while implementing and reviewing the native Kotlin app. The API is
the source of truth for authorization, tenant isolation, availability, pricing,
and financial state.

## 1. Definition of done

A feature is complete only when it:

- Represents loading, success, empty, stale, and failure states.
- Preserves tenant and role restrictions returned by the API.
- Works with TalkBack, font scaling, and touch targets of at least 48 dp.
- Has unit tests for business behavior and UI tests for its critical path.
- Avoids secrets and personal data in logs, screenshots, and analytics.
- Handles process recreation and configuration changes.
- Documents whether it works offline, reads cached data, or requires a connection.

## 2. Compose state and performance

### Use immutable UI state

Expose one immutable screen state from each ViewModel. Keep navigation events and
one-time messages separate from durable screen state.

```kotlin
@Immutable
data class RoomsUiState(
    val rooms: List<RoomUiModel> = emptyList(),
    val isLoading: Boolean = false,
    val isStale: Boolean = false,
    val errorMessage: String? = null,
)
```

Do not mark a type `@Stable` or `@Immutable` unless its properties satisfy that
contract. Prefer immutable collections or replace lists rather than mutating them
in place.

### Key lazy-list items

```kotlin
LazyColumn {
    items(
        items = state.rooms,
        key = { room -> room.id },
        contentType = { "room" },
    ) { room ->
        RoomCard(room)
    }
}
```

### Remember expensive objects

Use `remember` for objects tied to composition. For date/time formatting, prefer
`java.time` formatters and keep timezone choice explicit.

```kotlin
val formatter = remember { DateTimeFormatter.ofPattern("dd MMM yyyy") }
Text(checkIn.format(formatter))
```

### Collect flows with lifecycle awareness

```kotlin
val state by viewModel.uiState.collectAsStateWithLifecycle()
```

Use `derivedStateOf` for frequently read derived Compose state. Move filtering,
sorting, and business calculations into the ViewModel or domain layer when they do
not depend on composition.

## 3. ViewModel and coroutine rules

- Launch screen work in `viewModelScope`.
- Let cancellation propagate; do not swallow `CancellationException`.
- Use structured concurrency for related parallel requests.
- Run independent dashboard calls concurrently only when partial failure behavior
  is defined.
- Debounce remote search and cancel superseded queries with `flatMapLatest`.
- Never use `GlobalScope`.
- Never block the main thread with network, database, crypto, image, or printer work.

```kotlin
viewModelScope.launch {
    val result = runCatching {
        coroutineScope {
            val dashboard = async { repository.getDashboard() }
            val rooms = async { repository.getRooms() }
            DashboardContent(dashboard.await(), rooms.await())
        }
    }
    updateState(result)
}
```

If one request may fail without invalidating the entire screen, model the results
separately instead of wrapping everything in one `runCatching` block.

## 4. Networking and API errors

### Centralize configuration

Provide one production `OkHttpClient` and one Retrofit instance through Hilt.
Configure finite connect, read, write, and call timeouts. Enable body logging only
in debug builds, with authentication and personal-data headers redacted.

### Map the API envelope once

Convert HTTP responses into a small domain error set such as:

- `Unauthenticated`
- `EmailVerificationRequired`
- `Forbidden`
- `FeatureUnavailable`
- `Validation`
- `Conflict`
- `RateLimited`
- `NetworkUnavailable`
- `ServerFailure`

Keep the server message for suitable UI detail, but drive behavior from HTTP status
and stable error codes when available.

### Refresh a session safely

- Attach the access token in the `Authorization: Bearer` header.
- Use an OkHttp `Authenticator` or equivalent synchronized coordinator so multiple
  `401` responses trigger only one refresh.
- Retry an original request at most once after successful refresh.
- Use a CookieJar for the current `rp_refresh` backend contract.
- Clear local session state if refresh fails.
- Avoid `runBlocking` reads from DataStore inside interceptors.

Do not automatically retry booking creation, payments, or other non-idempotent
mutations unless the backend supports an idempotency key.

## 5. Local data and offline behavior

### Cache reads explicitly

Room entities should include cache metadata such as `fetchedAt`. The repository can
emit cached data first, then replace it with fresh server data.

The UI must distinguish:

- Fresh server data.
- Cached data with its last update time.
- No cached data and no network.

### Treat availability and money as online decisions

Do not claim that a cached room is available. Do not calculate a final booking
price, refund, or invoice balance solely from local data. Request the current value
from the API before confirmation.

### Queue writes only with a sync contract

A queued write needs an idempotency key, retry policy, conflict policy, and visible
status. Until those exist, housekeeping and booking mutations should require a
connection and show a recoverable error.

Use WorkManager for durable work, not for immediate UI coroutines.

## 6. Security and privacy

- Store access tokens in memory when practical.
- Encrypt any persisted refresh credential with an Android Keystore-backed key.
- Store ordinary preferences in DataStore; DataStore alone is not encryption.
- Never hardcode production secrets, signing credentials, or private API keys.
- Keep local development endpoints in build variants, not user-editable production
  settings.
- Use Network Security Configuration to disable cleartext traffic in release.
- Evaluate certificate pinning only with a documented rotation and recovery plan;
  a stale pin can take the app offline.
- Redact `Authorization`, `Cookie`, `Set-Cookie`, passwords, guest identity fields,
  and payment references from logs.
- Minimize guest-document retention and define deletion behavior before adding
  scanning.
- Clear sensitive local data on logout and tenant change.

## 7. Images and device resources

- Request images at their rendered dimensions with Coil.
- Provide placeholders and failure content descriptions.
- Avoid decoding full-size camera images into memory.
- Close streams, cursors, scanners, and printer connections deterministically.
- Test long room and booking lists on a low-memory device.
- Profile before optimizing; use Macrobenchmark and Android Studio tools for
  measured startup or rendering problems.

## 8. Accessibility and design

- Use ResortPro semantic design tokens rather than scattered color literals.
- Support system dark mode and high text scaling.
- Do not communicate room or payment status using color alone.
- Give icons meaningful content descriptions, or mark decorative icons as such.
- Provide clear labels and error text for every form field.
- Keep focus order logical and announce async success/failure states.
- Test TalkBack on login, room status, housekeeping, and walk-in booking.

## 9. Testing strategy

| Layer | Required coverage |
| --- | --- |
| Domain | Validation, mappings, role-based presentation, state transitions. |
| Repository | Cache-first reads, refresh, stale data, API error mapping. |
| Network | Login, cookie refresh, `401`, `403`, `409`, `429`, malformed responses. |
| Database | DAO behavior and Room migrations. |
| Compose | Loading, empty, error, accessibility, and critical actions. |
| End-to-end | Login → dashboard; housekeeping completion; walk-in conflict. |

Use fake repositories for ViewModel tests and MockWebServer for HTTP behavior. Do
not make unit tests depend on production services.

## 10. Build and release hygiene

- Pin and update Gradle/dependency versions deliberately.
- Keep debug-only logging and inspection tools out of release builds.
- Enable R8 and resource shrinking for release, then test the minified artifact.
- Maintain keep rules only for code that actually needs reflection.
- Keep signing material outside the repository and CI logs.
- Generate an Android App Bundle for Play distribution.
- Upload mapping files when crash reporting needs de-obfuscation.
- Run lint, unit tests, Compose tests, and a release build in CI.

Example release configuration:

```kotlin
android {
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}
```

Do not promise a fixed APK-size reduction. Measure the actual App Bundle and
download size after each release.

## 11. Pull-request checklist

- [ ] API contract was checked against the current route implementation.
- [ ] Loading, empty, error, offline, and unauthorized states are handled.
- [ ] New local data has retention and deletion behavior.
- [ ] No sensitive value is logged or committed.
- [ ] Accessibility semantics and large text were tested.
- [ ] Automated tests cover the critical behavior.
- [ ] Release lint and minified build still pass.
- [ ] Documentation and compliance evidence were updated when scope changed.
