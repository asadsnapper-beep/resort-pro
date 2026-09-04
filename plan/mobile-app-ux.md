# ResortPro Mobile — What the app should be

> The app currently gives every role the same three buttons. That is not a
> design decision; it is the API's shape showing through.

Status: 📋 Plan — no UX plan existed before this. The Kotlin app
(`apps/android`) has been built feature-first from the routes that happened to
be available.

---

## 1. The diagnosis

From the app's own README:

> *"Staff and Shareholder do not receive this entry point **because the backend
> rooms routes do not authorize those roles**."*

Navigation is being derived from API permissions. That is building from the
inside out. It produces an app that is a menu of modules — a small mirror of
the dashboard — when a phone in a resort is used for something completely
different from a desk.

What running it today actually looks like, on a real device, signed in as
Owner:

```
Coral Bay Resort · Demo User · Owner
[ Rooms & availability ]
[ Housekeeping        ]
[ New walk-in         ]
Today
  Arrivals today       1
  Departures today     1
  Available rooms      1
  Occupied rooms       8
  Occupancy        80.0%
  Pending housekeeping 6
```

Every role sees this same screen, minus whatever their token forbids. A
housekeeper opening the app is shown occupancy percentage and a walk-in button
before reaching the only thing she came for: her own rooms.

**The desktop is where you sit down and navigate. The phone is where you are
standing up, one-handed, with twenty seconds and one job.** Those need
different information architectures, and right now they have the same one.

---

## 2. Who is actually holding the phone

Ranked by how much of their work is genuinely mobile — which is the opposite of
how much authority they have.

| | Where they are | What the phone is for | Signal |
|---|---|---|---|
| **Housekeeping staff** | corridors, stairwells, inside rooms | my rooms today · mark done · report a problem | worst in the building |
| **Receptionist** | away from the desk — walking a guest up, checking a room | is this room ready · who is this guest · take a walk-in | patchy |
| **Manager** | anywhere, between other things | what needs me right now | fine |
| **Owner** | often not on site | a glance: how full, how much, anything wrong | fine |
| **Shareholder** | never on site | occasional read-only figures | fine |

**The primary user of this app is the housekeeper, not the owner.** She has the
most mobile job, the worst connectivity, the fewest free hands, and the least
patience for a menu. Every design decision below follows from that, and the
current app has it exactly inverted: the owner's dashboard is the home screen.

Note who is *not* on this list: the guest. This is a staff app.

---

## 3. Principles

**One screen, one job.** The home screen should answer the question that role
opens the app to ask — not offer a menu of places where the answer might be.

**Optimised for the worst conditions, not the demo.** One hand, moving, dim
corridor, no signal, a cracked mid-range phone. If it works there it works
everywhere; the reverse is not true.

**Offline is normal, not an error.** Resort basements, garden villas and
stairwells have no signal. An action taken offline must feel finished, and the
app must be honest about what has actually reached the server.

**Never make someone read a number they cannot act on.** Occupancy percentage
belongs on the owner's screen and nowhere else.

**Bangla first for the people who need it.** Housekeeping and maintenance staff
are overwhelmingly Bangla-speaking; owners and managers often prefer English.
The app has no `values-bn` at all today. This is not a nice-to-have — an app
the primary user cannot read is not usable by the primary user.
Follows the same rule as the web product: Bangla is offered, never forced, and
English stays the default outside Bangladesh.

---

## 4. Home, per role

The single largest change: **there is no shared home screen.** The role decides
what the app *is*.

### Housekeeper

```
My rooms · 6 left today
───────────────────────
 202  Ocean Deluxe        Daily
      Guest in house
      [ Start ]

 108  Garden View         Checkout clean
      Guest left 11:40
      [ Start ]

 ⋯
Done today: 3          [ Report a problem ]
```

No menu, no stats, no navigation. The list *is* the app. One tap to start, one
to finish. "Report a problem" raises a maintenance ticket with the room already
filled in — today that requires the web dashboard, so it never happens from the
floor where the problem is.

### Receptionist

```
Arrivals · 4 expected
  14:00  Karim Hossain    Room 201 · ready
  16:30  Nadia Chowdhury  Room C1 · cleaning ⚠
Departures · 1 due
  Room 102 · balance ৳1,700 ⚠
──────────────────────────
[ Walk-in ]   [ Find a guest ]
```

Ordered by what goes wrong: a room not ready for an arrival, a balance not
collected on a departure. "Find a guest" reuses the phone search that already
exists on the web.

### Manager

```
Needs you now
  ⚠ Room C1 not ready — arrival 16:30
  ⚠ 2 maintenance issues open > 24h
  ⚠ ৳1,700 uncollected at checkout
Today  80% occupancy · 6 tasks left
```

Exceptions first, figures second. A manager's phone should tell them what is
wrong, not what is normal.

### Owner / Shareholder

The current dashboard is right for these two, and only these two.

---

## 5. Offline — the contract

`HousekeepingSyncWorker` already exists, and the API side was hardened for it
(idempotent retry, and refusing a stale queued change with a 409 —
`plan/checkout-billing-completeness.md` sibling work). The UX side is missing.

Three states, always visible, never a spinner that lies:

| State | What the user sees |
|---|---|
| Saved on the server | plain, no marker |
| Waiting to sync | a quiet "will send when you're back online" on that row |
| Rejected | the row returns to its old state with one line saying why |

The 409 case has a real design need: the task changed while the phone was
offline. The honest resolution is to show both — *"You marked this done at
2:15. The desk marked it skipped at 2:20."* — and let the person choose. Silently
picking a winner is how staff stop trusting the app.

A global banner ("offline — 3 changes waiting") belongs at the top of the
housekeeper's list, because she is the one who will be offline.

---

## 6. Interaction and visual system

- **Touch targets ≥ 56dp** for anything a housekeeper taps while holding
  something. Material's 48dp minimum is for two-handed use.
- **Primary actions in the bottom third.** The top of a 6.7" phone cannot be
  reached one-handed. The current screens put actions inline in cards, mid-screen.
- **Confirm nothing that is trivially undoable; confirm everything that is not.**
  Marking a room clean needs no dialog — it needs an undo. Charging a guest does.
- **Colour carries no meaning alone.** "Ready" and "not ready" must differ in
  words or shape too — resort corridors are dim and some staff are colour-blind.
- **Dark mode is a real requirement, not polish.** Night-shift staff and 5am
  cleaning rounds. `Theme.kt` already defines a dark scheme; nothing verifies it,
  and `values-night/themes.xml` sets only window chrome.
- **Type large enough to read at arm's length while walking.** Room number is the
  single most important thing on the housekeeper's screen and should be the
  largest thing on it.

---

## 7. Build order

| | | Why here |
|---|---|---|
| **P0** | Role-specific home screens | The whole diagnosis. Everything else is decoration on the wrong shape. |
| **P0** | Bangla localisation (`values-bn`) | The primary user cannot read the app today. |
| **P1** | Offline state made visible + 409 resolution UI | The plumbing exists; the trust does not. |
| **P1** | Report a problem → maintenance ticket, from the room | The one workflow that is mobile-only by nature and currently missing. |
| **P2** | Receptionist arrivals/departures screen | High value, but the desk already has a working web version. |
| **P2** | Manager exceptions screen | |
| **P3** | Dark mode verification, touch target audit, one-handed pass | Do it once the shape is settled, not before. |

---

## 8. Deliberately out of scope

**A guest-facing app.** Guests will not install one for a three-night stay. The
public website and QR ordering are the right surface, and they exist.

**Feature parity with the dashboard.** Invoices, rate plans, the website
builder, reports — these are desk work. An app that tries to be the dashboard
will be worse than the dashboard at everything.

**Push notifications**, until there is something worth waking a phone for.
"Room 201 needs cleaning" at 6am is worth it; "occupancy is 80%" is not.

**iOS**, until the Android app is proven with real staff in a real resort.

---

## 9. How we will know it worked

Not "the screens look good". These:

- A housekeeper can go from opening the app to marking a room clean in **two
  taps**, with one hand, without reading anything but a room number.
- A task completed with the phone in aeroplane mode appears on the desk's
  dashboard within a minute of signal returning, and the person could tell —
  from the screen — that it had not yet sent.
- A receptionist can answer "is Room C1 ready?" without leaving the arrivals
  screen.
- Someone who reads only Bangla can complete a full shift's housekeeping work.
- A manager can name what is wrong in the resort within five seconds of opening
  the app.

---

## 10. Related

- `apps/android/README.md` — what is built (technical, role by role)
- `docs/android/ARCHITECTURE.md`, `BEST_PRACTICES.md`, `PLAY_STORE_COMPLIANCE.md`
- [mobile-electron-architecture.md](./mobile-electron-architecture.md) — the older
  Expo attempt, archived; its index entry still says mobile is archived and needs
  updating now that a Kotlin app exists
