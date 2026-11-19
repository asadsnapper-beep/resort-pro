# Google Play: what the owner has to do

The code side of a Play release is tracked as slices against
`apps/android` and is being done by the app agent. This file is the other half
— the things only the account holder can do, in the order they block on each
other.

Everything here was written on 2026-11-15 against the app as it stands on
`dev`. Play Console requirements change; the items marked **(confirm)** are the
ones that have moved before and should be read off the Console rather than
trusted from this file.

---

## 1. The developer account, and the one rule that can cost two weeks

A Play Console account costs a one-time **$25** registration fee and requires
identity verification before anything can be published.

The part that decides the timeline: **(confirm)** a *personal* developer
account registered after 13 November 2023 must run a **closed test with at
least 12 testers who stay opted in for 14 continuous days** before it can even
apply for production access. An *organisation* account is not subject to that,
but it has to verify the legal entity instead, which has its own lead time.

This is the single biggest scheduling item on the list. Decide the account type
first, because it determines whether a production listing is two weeks away or
much longer.

## 2. Decide the distribution model before writing any listing copy

ResortPro Android is a **staff tool**. Every screen is behind a login, and the
roles are Owner, Manager, Receptionist, Staff and Shareholder. There is no
sign-up flow — accounts are created for staff by the resort. That makes a
public production listing an awkward fit, and it changes what is required:

| Model | What it means | What it costs you |
|---|---|---|
| **Public production listing** | Anyone can install it; it just will not log in | Full review, Data Safety, content rating, reviewer credentials, and reviewers who may question an app nobody outside the business can use |
| **Closed testing only** | Named testers by e-mail or a Google Group | Much lighter review; satisfies the 12-tester rule as a side effect; no public listing |
| **Managed Google Play private app** | Published only to your own organisation | Needs Google Workspace / an enterprise setup; no public review; the natural fit for an internal tool |

Recommendation: **start with closed testing.** It is the only track that both
gets the app onto real staff phones quickly and satisfies the tester
requirement in item 1. Promote to production later if there is a reason to be
publicly listed at all.

## 3. The signing keystore — and why losing it is unrecoverable

The release build currently has no signing config; adding one that reads its
values from outside the repository is the app agent's slice 2. The keystore
itself has to be created by you, because it must never pass through an agent.

```bash
keytool -genkeypair -v \
  -keystore resortpro-upload.jks \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -alias resortpro-upload
```

Then, in order:

1. Keep the `.jks` file **outside this repository.** `*.jks` and `*.keystore`
   are already in `apps/android/.gitignore` and nothing of that kind is tracked
   today.
2. Back it up somewhere you will still have in five years, with the password.
   Store the password in a password manager, not in a file in the project.
3. Enrol in **Play App Signing** when you create the app in the Console. Google
   then holds the *app signing key* and your `.jks` is only the *upload key* —
   which means a lost upload key can be reset by Google, whereas a lost app
   signing key without Play App Signing ends the app's update path permanently.

Do not send the keystore, its password or the alias to any agent, and do not
paste them into a chat. The build is being written to read them from
`local.properties` or the environment for exactly this reason.

## 4. Reviewer credentials — the most common rejection for an app like this

Play's "App access" section exists for apps whose content is behind a login.
A reviewer who opens ResortPro sees a login screen and nothing else, and an app
that cannot be exercised gets rejected.

Create a **dedicated demo account** on a tenant that holds only fake data, and
enter its credentials under **App content → App access → All or some
functionality is restricted**. Points worth getting right:

- Give it a role that can actually see things — Receptionist or Manager, not
  Staff, so Rooms and Housekeeping both open.
- Put it on a demo tenant. Real guest records must not be reachable from it.
- Add a one-line note on how to reach the main screens after login.
- The automated **pre-launch report** runs the app on real devices and will hit
  the same wall, so these credentials improve that report too.

## 5. Privacy policy URL — required, not optional

The app transmits personal data, so a privacy policy URL is mandatory in the
Console and should also be reachable from the app's own site.

What it has to cover, based on what the app actually sends (verified against
the code, not assumed):

- **Staff credentials** — e-mail and password to `POST api/auth/login`.
- **Guest identity data** — name, phone and e-mail on `POST api/bookings/walk-in`.
- **Guest identity documents** — photographs of a national ID or passport,
  uploaded to `POST api/guests/{id}/documents` via the device camera.

Note the awkward part honestly: most of this is personal data about **guests,
who are not the app's user.** A staff member enters it on their behalf. Play
still counts it as collected by the app, and the policy has to describe it,
say how long it is kept, and say how a guest can have it deleted. This is worth
a lawyer's eye before it is published — it is the same conversation as the
web-side legal items.

## 6. Data Safety declaration

The form is mandatory and a wrong answer is treated as a policy violation, so
fill it from this table rather than from memory. Verified against the app on
`dev`: there is **no analytics or crash-reporting SDK** of any kind in the
dependency list, and the release build is **HTTPS-only** — cleartext is
permitted only for the emulator host and `localhost`, and only in debug builds.

| Data type | Collected | Shared | Why |
|---|---|---|---|
| Name | Yes | No | Guest name on walk-in booking |
| E-mail address | Yes | No | Staff login, and guest e-mail on booking |
| Phone number | Yes | No | Guest phone on booking |
| Photos | Yes | No | ID document capture |
| Other personal info (government ID) | Yes | No | National ID / passport images |
| Location | No | — | No location permission is declared |
| Analytics / crash logs | No | — | No SDK present |
| Advertising ID | No | — | No ads, no ad SDK |

For each of these, also state: **encrypted in transit** (yes), **not shared
with third parties** (it goes only to the ResortPro API), and whether a user
can request deletion — which depends on what the web side provides, so settle
that before submitting the form.

**(confirm)** If the app ever gains an in-app sign-up, Play's account-deletion
requirement kicks in and you must offer both in-app and web-based deletion.
There is no registration flow today, so it does not apply yet.

## 7. The remaining Console sections

- **Content rating** — complete the IARC questionnaire. A business tool with no
  user-generated content, no ads and no gambling rates very low.
- **Target audience** — not directed at children. Do not tick anything that
  pulls the app into the Families programme.
- **Ads** — declare none. True: no ad SDK is present.
- **App category** — Business.
- **Countries and pricing** — free. Decide whether to list beyond Bangladesh.
- **Permissions** — the app declares only `INTERNET` and
  `ACCESS_NETWORK_STATE`. It deliberately does **not** declare `CAMERA`: it
  hands the system camera app a file URI instead. That is worth knowing because
  it means no sensitive-permission declaration form is triggered, which is a
  real simplification. Do not let anyone "fix" it by adding the permission.

## 8. Store listing text

| Field | Limit | Status |
|---|---|---|
| App name | 30 chars | `ResortPro` fits |
| Short description | 80 chars | To write |
| Full description | 4000 chars | To write |

Write these for **hotel staff**, not for guests — the person reading the
listing is a receptionist or an owner, and the app's value is that it works on
the floor without a desktop. What exists today and can honestly be described:
login with role-aware landing screens, room list and live availability,
housekeeping task filtering and status changes that roll back if the server
rejects them, walk-in check-in with server-resolved pricing, guest ID document
capture, and an app lock.

Do not describe anything on the unmerged guest branch as shipped.

## 9. Graphics and screenshots

Assets Play requires:

| Asset | Spec | Notes |
|---|---|---|
| App icon | 512 × 512 PNG, 32-bit | Separate from the in-app launcher icon |
| Feature graphic | 1024 × 500 PNG or JPEG, **no alpha** | Shown at the top of the listing |
| Phone screenshots | 2 to 8, 16:9 or 9:16, min 320 px on a side | From the real app |
| Tablet screenshots | Optional | Only if you claim tablet support |

**Keep every one of these out of the repository.** The project rules forbid
committing marketing images — this repository is public and git keeps binaries
forever. Put them in `content/play-store/`. Be aware that `content/` is
currently **untracked but not actually gitignored**, which is how 26 MB of
marketing media nearly went in once before; adding `content/` to `.gitignore`
is worth doing at the same time.

Screenshots have to come from the running app, not from a mock-up, and Play
expects them to show the real UI. The honest sequence is: wait until the app
agent's slice 1 produces a working release build, run it on an emulator with
the demo tenant, and capture Login, Rooms/Availability, Housekeeping and the
walk-in flow. That is four screenshots from four screens that already exist.

The two graphics below are design assets and need to be generated. The prompts
are in the last section.

## 10. Release order

1. **Internal testing** — up to 100 testers, available almost immediately. Use
   this to confirm the signed bundle installs and the real API works from a
   phone on mobile data.
2. **Closed testing** — the track that satisfies the 12-tester / 14-day rule if
   it applies. Put real staff on it.
3. **Production or private app** — only after item 2 of this document has been
   decided for a reason, not by default.

Bump `versionCode` on every single upload. Play rejects a duplicate, and the
current value is `1` with `versionName` `0.1.0`.

## 11. Still blocked in code

These are the app agent's, listed so you can see what is not ready:

- The release variant has never been compiled. R8 shrinking is enabled with an
  empty keep-rule file against kotlinx.serialization, Retrofit and Room.
- Nothing produces an `.aab`, which is the format Play takes.
- No signing config exists, so a release build today would be unsigned.
- The launcher icon is a single vector with no adaptive-icon variant, so most
  Android 8+ launchers will not mask it correctly.
- `app_name` is missing from `res/values-bn/strings.xml`.
- Real-device verification of login, process-death session restore and logout
  has never been done; the README still records static verification only, from
  2026-08-29.

---

## Image generation prompts

Claude cannot generate images, so these are prompts to run in an image tool.
Save the results to these exact paths, and do not commit them.

### Store icon — `content/play-store/icon-512.png`

> A flat vector app icon, 512×512, square with no rounded corners and no
> transparency. A single simple mark centred on a deep resort-green background
> (#1a6b5e): a minimal geometric palm frond and roof-line combined into one
> shape, rendered in warm gold (#d4a853). No text, no letters, no gradients, no
> drop shadows, no photographic elements. Generous even margin around the mark.
> Crisp edges suitable for display at 48 px.

### Feature graphic — `content/play-store/feature-1024x500.png`

> A 1024×500 landscape banner for a hotel staff management app, fully opaque
> with no transparency. Deep resort-green (#1a6b5e) background with a subtle
> darker green geometric pattern suggesting roof lines and palm shapes at low
> contrast. Left third holds clean negative space for a logo; nothing important
> in the outer 5% on any edge. Warm gold (#d4a853) accent as a thin horizontal
> rule. Flat vector style, no photographs, no device mock-ups, no text or
> lettering of any kind.

Both prompts deliberately exclude text: Play shows the feature graphic at
several sizes and crops it, and baked-in lettering is the usual way these end
up unreadable.
