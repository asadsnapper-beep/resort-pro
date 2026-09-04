# ResortPro Android

Native Kotlin Android client for ResortPro operational and shareholder workflows.

## Current status

The project foundation, authentication, read-only Rooms/Availability,
Housekeeping, and Walk-in Booking vertical slices are implemented.
The app now includes the Compose login and signed-in states, Retrofit/OkHttp API
integration, an in-memory bearer token, an Android Keystore-encrypted rotating
refresh cookie, synchronized `401` refresh/retry, logout, and role-aware landing
states for Owner, Manager, Receptionist, Staff, and Shareholder.

Owner, Manager, and Receptionist can open a paginated room list and check live
availability for a validated date range. Staff and Shareholder do not receive this
entry point because the backend rooms routes do not authorize those roles.

Owner, Manager, Receptionist, and Staff can open Housekeeping, filter tasks, and
move pending work through supported status transitions. Status updates are
optimistic and roll back visibly if the server rejects or cannot complete them.
Staff sees only tasks assigned to their user in the app.
The API independently enforces the same assignment scope for Staff task lists,
status counts, and status mutations.

Owner, Manager, and Receptionist can create an immediate walk-in check-in using
live availability and server-resolved rate-plan pricing. The form validates room
capacity and payment advances, surfaces booking conflicts, prevents double taps,
never retries a booking automatically, and pauses manual retry when the outcome of
a submission is uncertain.

Static verification passed on 2026-08-29. Real API login, process-death session
restore, and logout still need emulator/physical-device verification.

## Toolchain

- Android Studio with JDK 17 or newer (verified with bundled JDK 21)
- Android SDK Platform 37
- Android SDK Build Tools 36.0.0 or newer compatible version
- Android Gradle Plugin 9.2.1
- Gradle 9.4.1

This workstation uses Android Studio's bundled JDK and the Android SDK under the
standard macOS user SDK location.

## Open and run

1. Open `apps/android` as a project in Android Studio.
2. Let Android Studio use its bundled JDK 17 runtime.
3. Install SDK Platform 37 when prompted.
4. Create an Android 16/API 36 emulator or connect a device.
5. Run the `app` debug configuration.

For an emulator, the debug API base URL is `http://10.0.2.2:4000/`. Release builds
use `https://api.resortpro.site/`. A debug-only network security configuration
allows cleartext traffic only to `10.0.2.2` and localhost; release cleartext
traffic remains disabled.

## Command-line checks

From `apps/android`, when a terminal-visible JDK is configured:

```bash
./gradlew lintDebug testDebugUnitTest assembleDebug assembleRelease
```

On this macOS workstation, a command-line build can use Android Studio's runtime:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
./gradlew lintDebug testDebugUnitTest assembleDebug assembleRelease
```

Last verified result: twenty-two unit tests passed, lint reported zero errors, a 12 MB
debug APK was generated at `app/build/outputs/apk/debug/app-debug.apk`, and R8
generated a 1.4 MB unsigned release APK at
`app/build/outputs/apk/release/app-release-unsigned.apk`.

The warnings retain `targetSdk 36` and the currently verified AGP/Kotlin pairing.
Upgrade them as a tested toolchain change rather than accepting version prompts
individually during feature work.

## Next milestone

1. Run the API and verify login, cookie rotation, process-death restore, and logout
   on an emulator and a physical device.
2. Add MockWebServer coverage for refresh concurrency, pagination, status rollback,
   and backend error envelopes.
3. Add Compose UI tests, Room caching with visible cache age, and accessibility
   semantics.
4. Verify login, process-death restore, Rooms, Housekeeping, and Walk-in Booking on
   a real device and against a non-production test tenant.

Architecture and engineering standards live in `docs/android/`.
