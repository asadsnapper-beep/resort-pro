# ResortPro Global Search — Best-UX Implementation Plan

## 1. Goal

Turn the dashboard header search into a fast, trustworthy way for a resort team
to find the right operational record and start common work.

Today the field says “Search rooms, bookings, guests…”, but it is only a visual
input. Typing, the Cmd/Ctrl + K hint, and result navigation do nothing. This is
misleading, especially for a receptionist who needs a guest or booking quickly.

The new experience must feel simple:

1. Press Cmd + K on Mac or Ctrl + K on Windows.
2. Type a guest name, phone number, booking confirmation, room number, or
   invoice number.
3. See a small, clearly grouped result list.
4. Open the correct record with Enter.

This is not a replacement for detailed page filters. It is an always-available
“find something quickly” tool.

## 2. Product decisions

### Keep both layers of search

| Need | Correct search surface |
| --- | --- |
| Find a known guest, room, booking, or invoice from anywhere | Global search |
| Narrow a bookings table by date, status, payment, or source | Bookings page filters |
| Find stock, restaurant items, staff, or CRM records while working on that page | That page’s local search |
| Perform an action without searching | Quick actions in the empty global-search state |

Global search should launch on every authenticated dashboard page. It should not
search public website pages or cross into another tenant.

### Phase 1 searchable records

1. Bookings: confirmation number, guest name, email, phone, room number.
2. Guests: name, email, phone.
3. Rooms: room number and room name.
4. Invoices: invoice number and guest name, for roles permitted to view billing.

Do not add every dashboard module immediately. A small, reliable search is much
better than a large search that returns weak or unauthorized results.

## 3. UX specification

### Desktop entry point

- Keep the header search visually obvious, but make it a button-like trigger,
  not a fake editable input.
- Copy: “Search guests, bookings, rooms…”
- Show a Cmd + K badge on macOS and Ctrl + K on Windows.
- Clicking anywhere on the trigger opens the palette.
- Keyboard shortcut: Cmd + K on macOS, Ctrl + K on Windows.
- Do not hijack the shortcut when focus is in a text field, textarea, select,
  contenteditable element, or another dialog.
- Escape closes the palette and returns focus to the original trigger.

### Mobile entry point

- Show a labelled search icon in the dashboard top bar with at least a 44 by 44
  pixel tap target.
- Open a near-full-height search sheet with the input focused.
- Keep the close button visible and the input pinned at the top while results
  scroll.
- The same endpoint and ranking rules must be used on mobile and desktop.

### Palette states

| State | What the user sees |
| --- | --- |
| Empty | Short help text and role-allowed quick actions |
| One character | “Keep typing to search” — no server request |
| Loading | A subtle spinner or skeleton; never leave stale results unexplained |
| Results | Grouped, keyboard-navigable records |
| No results | “No matches for …” plus useful suggestions |
| Error | “Search is temporarily unavailable. Try again.” with a retry action |

Empty-state quick actions must be role-aware. Examples for an owner or manager:
New booking, Walk-in guest, Add guest, Add room. A receptionist must not see
Add room, and a shareholder must not see operational actions.

### Result design

Use one compact, repeatable row pattern:

| Result type | Primary line | Secondary line | Trailing information |
| --- | --- | --- | --- |
| Booking | Confirmation number or guest name | Room and stay dates | Status badge |
| Guest | Full name | Masked phone/email as appropriate | Last stay or visit |
| Room | Room number and name | Room type and current status | Availability badge |
| Invoice | Invoice number | Guest name | Balance/status |

Requirements:

- Group results as Quick actions, Bookings, Guests, Rooms, and Invoices.
- Show a maximum of 3 matches per record type and 12 total results.
- Highlight the matched part of a result safely; never inject raw HTML.
- Never expose ID document numbers, payment card data, full internal notes,
  payment tokens, or other sensitive fields in a result preview.
- The active item has a light, high-contrast brand-tinted surface — not a dark
  full-row hover overlay.
- Use existing ResortPro tokens and components. Do not introduce raw dashboard
  colours or arbitrary typography values.

### Keyboard and accessibility

- Up/Down changes the active result.
- Enter opens the active result.
- Escape closes the palette.
- Tab should reach the input and then the normal interactive controls without
  trapping users unexpectedly.
- Use dialog, combobox/listbox, and option semantics with an accessible active
  descendant relationship.
- Visible focus must meet contrast requirements.
- Announce loading and result count to screen readers with a polite live region.
- Opening the palette must not cause background page scroll.

Any new search dialog must use ModalShell from
apps/web/src/components/ui/modal-shell.tsx. It provides the portal, body-scroll
handling, and dashboard modal behaviour already required by this project.

## 4. Permissions and privacy

Search is a data-access feature, not only a UI feature. The API must enforce
the same permissions as the destination page.

| Role | Bookings | Guests | Rooms | Invoices | Empty-state actions |
| --- | --- | --- | --- | --- | --- |
| Owner / Manager | Yes | Yes | Yes | Yes | New booking, Walk-in, Add guest, Add room |
| Receptionist | Yes | Yes | Yes | Only if billing permission exists | New booking, Walk-in, Add guest |
| Marketer | Only explicitly assigned CRM/guest data | Yes when CRM access exists | No | No | CRM-specific actions only |
| Operations staff | No in phase 1 | No in phase 1 | No in phase 1 | No | No global operational actions |
| Chef | No in phase 1 | No in phase 1 | No in phase 1 | No | No global operational actions |
| Shareholder | No | No | No | No | No global operational actions |

Before implementation, map these checks to the project’s existing RBAC helpers.
Do not copy the table into frontend-only conditionals and assume that is secure.

Every query must:

1. Use request.db, the tenant-scoped Prisma client.
2. Use the authenticated user and tenant from the request context.
3. Never accept a tenant ID or user-controlled tenant scope in the URL.
4. Apply permission checks before each record-type query.
5. Return only fields shown by the palette.
6. Return the same not-found style response for inaccessible data; do not leak
   whether another tenant has a booking or guest.

## 5. Search relevance rules

Resort staff generally search for one known record. Exact identifiers must beat
general text matches.

Rank results in this order:

1. Exact booking confirmation number or invoice number.
2. Exact normalized phone number.
3. Exact room number.
4. Exact email.
5. Starts-with guest name, room name, or confirmation number.
6. Contains match, ordered by recent or upcoming operational relevance.

Additional rules:

- Normalize phone numbers before matching: remove spaces, hyphens, parentheses,
  and common country-code formatting.
- Normalize text with trimming and case-insensitive matching.
- Favor upcoming and currently in-house bookings over historical bookings when
  textual relevance is otherwise equal.
- Search at least first and last guest-name combinations; do not rely on one
  concatenated display field.
- A query must have at least 2 non-space characters before calling the API.

## 6. API contract and data design

Create a tenant-scoped endpoint:

GET /api/search?q=query

Optional future parameters may include cursor and category filters. Do not
expose a client-controlled unlimited limit. The server owns the caps.

### Response shape

The response should contain a small set of result cards:

| Field | Purpose |
| --- | --- |
| id | Record ID used for the permitted destination route |
| type | booking, guest, room, or invoice |
| title | Safe primary result text |
| subtitle | Safe context such as room/stay dates |
| status | Optional approved status label |
| href | Internal permitted destination |
| score | Server-side ranking value; do not display |

Use a fixed cap of 3 results per type and 12 results total. For a query below
2 characters, return an empty successful result set instead of querying broad
tables.

### API safety and performance

- Add apps/api/src/routes/search.ts.
- Register it in apps/api/src/app.ts, where the app’s other routes are
  registered. Do not register it only in index.ts.
- Use request.db rather than a bare Prisma client.
- Use narrow select projections; no full booking, guest, or invoice records.
- Validate and trim q with the project’s existing request-validation pattern.
- Apply an authenticated dashboard rate limit, initially 60 requests per minute
  per user, then tune based on real traffic.
- Log unexpected errors with request/user context but never log raw query text
  if it may contain personal data.
- Do not add an external search provider in phase 1.

For early data sizes, indexed database contains/starts-with queries are enough.
Before broad rollout, benchmark with at least 10,000 guests and 50,000 bookings.
If latency is not consistently acceptable, add PostgreSQL pg_trgm indexes for
the approved searchable text columns through a reviewed migration. Do not add
indexes blindly.

Success target: p95 API response under 300 ms at the benchmark data size, and
the palette should feel responsive within 500 ms including UI rendering.

## 7. Frontend architecture

### Files to add or update

| Area | File | Change |
| --- | --- | --- |
| API route | apps/api/src/routes/search.ts | Validation, RBAC, ranking, tenant-scoped queries |
| API registration | apps/api/src/app.ts | Mount the search route |
| API client | apps/web/src/lib/api.ts | Typed global-search request/response helper |
| Search UI | apps/web/src/components/dashboard/GlobalSearch.tsx | ModalShell palette, states, keyboard and a11y |
| Header | apps/web/src/components/dashboard/top-nav.tsx | Replace static input with the trigger |
| Dashboard shell | Relevant dashboard layout/provider | Mount one palette per authenticated dashboard |
| Database | apps/api/prisma/schema.prisma and migration if benchmark requires it | Approved search indexes only |

### Client behaviour

- Debounce requests by about 250 ms after the two-character threshold.
- Cancel or ignore stale requests when the query changes.
- Use a cache key that includes the tenant and the query.
- Cache individual query results briefly, around 30 seconds; never persist them
  to local storage.
- Clear in-memory search cache on logout, tenant switch, and permission change.
- Keep the input responsive even while a request is loading.
- On selecting a result, close the palette then navigate to its href.

Use the project’s existing data-fetching conventions. The component must not
create a second API abstraction or bypass the authenticated client.

## 8. Delivery phases

### Phase A — foundation and safe API — DONE (18 Aug 2026)

Built in `apps/api/src/routes/search.ts`, registered in `app.ts`, covered by
`apps/api/tests/integration/global-search.test.ts` (16 tests).

Two things worth recording because they were not obvious from this plan:

- **Phone matching needed SQL.** Numbers are stored as typed — `+880
  1711-002200` — so `contains` for `01711002200` matches nothing. The
  punctuation has to come out of the *stored* value, which Prisma's string
  filters cannot express, so that one comparison uses `regexp_replace` in a raw
  query with `tenantId` bound explicitly. Normalising only for ranking, as §5
  reads, silently does nothing: the rows never come back to rank.
- **Full-name matching is per-term AND, not one `contains`.** §5 says "search at
  least first and last guest-name combinations"; concretely, the query is split
  on whitespace and every term must match some field. This is also the fix for
  the same bug in the per-page searches, which are still one-`contains`.

Still open from this phase: the §6 benchmark at 10,000 guests / 50,000 bookings.
On demo data the endpoint answers in 23–35 ms, which says nothing about scale.
No indexes added, per "do not add indexes blindly".



1. Trace existing RBAC helpers and the destination routes for bookings, guests,
   rooms, and invoices.
2. Define response types and result projections.
3. Build the tenant-scoped route and exact relevance rules.
4. Write API tests for validation, tenant isolation, permissions, caps, and
   identifier precedence.
5. Benchmark realistic seed data before adding indexes.

Exit criteria: API returns only permitted, tenant-scoped, minimal result cards.

### Phase B — desktop search experience — DONE (18 Aug 2026)

`GlobalSearch.tsx` (palette) and the `top-nav.tsx` trigger, with `searchApi` in
`lib/api.ts`. Three things this plan did not foresee:

- **ModalShell does not handle Escape.** It registers no keydown listener at
  all, so §3's "Escape closes the palette" had to be implemented in the palette
  itself. Every other modal in the app is therefore also not Escape-closable —
  worth deciding separately whether that belongs in ModalShell.
- **A result href is not enough on its own.** Guests and Rooms have no detail
  route, so results link to the list with `?search=`, and those pages ignored
  the parameter — the palette navigated correctly and showed an unfiltered
  list. Both pages now seed their search state from the URL.
- **Which then exposed the real blocker:** the per-page search could not match
  the full name the palette hands it, so a correct hand-off landed on an empty
  list. `utils/search-terms.ts` now backs guests and rooms with the same
  per-term AND used by `/api/search`. The other twelve modules still use the old
  single-`contains`.



1. Replace the static header input with a truthful trigger.
2. Build GlobalSearch using ModalShell and ResortPro design tokens.
3. Add Cmd/Ctrl + K, focus return, Escape, arrow navigation, Enter, and
   screen-reader announcements.
4. Build empty, loading, no-result, and error states.
5. Add role-aware quick actions.

Exit criteria: a receptionist can find and open a booking, guest, and room by
keyboard without a mouse.

### Phase C — mobile and visual polish — DONE (18 Aug 2026)

Verified by driving the browser at 375 and 320 px, in both themes.

What actually needed fixing:

- **Trigger was a 34 px tap target.** Now `min-h-[44px] sm:min-h-0`, so phones
  get the 44 px §3 asks for while the desktop header keeps its compact bar.
- **Subtitles truncated to uselessness at 320 px** — "CBR-2026-014 · Roo…",
  losing the room and both dates. Two lines on phones, one on wider screens.
  The first attempt did not work: a `block` class in the same string overrode
  the `display: -webkit-box` that `line-clamp` needs, so the clamp was set and
  had no effect.
- **List raised to 62vh on phones** (52vh above `sm`), since a 52vh box on a
  720 px screen wastes most of it.

What did **not** need fixing, contrary to a first measurement: dark mode. An
early probe showed near-black text on a near-white active row, but that was an
artifact of toggling `.dark` from the console after mount. Through the app's own
theme switch the palette is correct — active row `rgba(255,255,255,0.1)`, white
title, tinted highlight. The §3 rule about no dark full-row hover holds.

Bangla renders correctly, including highlight inside Bangla text and a long
mixed name at 320 px with no overflow.

Not done from this phase: the plan's separate mobile *sheet* layout. The
centred ModalShell dialog is legible and fully usable at 320 px, and a bespoke
sheet is a bigger change than the problem justifies right now.



1. Add the mobile sheet layout and 44-pixel controls.
2. Verify long guest names, Bangla/English mixed text, phone searches, and
   narrow screens.
3. Match hover, focus, spacing, font, and colour tokens to the dashboard design
   system.
4. Verify light and dark mode if the dashboard supports both.

Exit criteria: the experience is clear and usable at 320-pixel width and has
no dark hover treatment inconsistent with the product.

### Phase D — rollout and scale — flag + signals DONE (29 Aug 2026)

One judgement call worth recording: this plan says "release behind a tenant or
internal feature flag", but search had already shipped to production unflagged
by the time Phase D started. Gating it off would have taken away something
every tenant already has. So `global_search` is granted on all four plans and
exists as a **kill switch** — the value now is being able to turn it off for one
resort without a deploy, not staging a rollout that already happened.

Signals, in `utils/search-metrics.ts` and surfaced on the admin metrics
endpoint alongside the existing request metrics:

- **API p95 came free** — every request already goes through the metrics ring
  buffer, so `/api/search` latency was being measured before Phase D began.
- **No-result rate and results-per-query** are server-side only; the route
  knows both. Queries below the 2-character threshold are deliberately *not*
  counted, or search would look worse the more someone types.
- **Selection rate** needed a beacon: a query returning three bookings and a
  query returning the *right* booking are indistinguishable from the server.
  `POST /api/search/selected` takes the result type and nothing else — no query
  text, no record id. Knowing guests get opened more than invoices is enough to
  act on; storing who searched for whom is not.

Still open from this phase: no pilot has run, so none of these numbers exist
yet, and "fix weak matches before general release" has nothing to act on. The
counters are in-process and reset on restart, which is fine for a pilot read and
useless as history.



1. Release behind a tenant or internal feature flag.
2. Pilot with internal/demo resorts and track anonymous operational metrics:
   open rate, successful selection rate, no-result rate, time to first result,
   and API p95.
3. Fix weak matches and permission issues before general release.
4. Enable for all tenants after the acceptance criteria below are met.

## 9. Acceptance tests

### Automated API tests

- Unauthenticated request is rejected.
- A user cannot receive data from another tenant.
- A receptionist sees only the categories and fields they are allowed to see.
- A shareholder receives no operational results.
- q with fewer than 2 characters does not perform broad matching.
- Exact confirmation, invoice, room, email, and phone matches rank first.
- Result cap is never more than 3 per category or 12 total.
- Every result uses a destination route the caller can access.

### Browser tests

- Clicking the header trigger opens the search UI.
- Cmd + K and Ctrl + K work on their respective platforms.
- The shortcut does not open the palette while typing in a form field.
- Escape closes it and restores focus.
- Arrow keys and Enter work without a mouse.
- Loading, no-results, and retry states are visible.
- Mobile search opens, focuses correctly, scrolls safely, and closes safely.
- A screen reader receives a result-count announcement.

### Manual regression script

Test with an owner, receptionist, and shareholder account. Search:

1. A full guest name.
2. A partial guest name.
3. A local-format and country-code phone number.
4. A confirmation number.
5. A room number.
6. An invoice number.
7. A nonexistent value.
8. A record belonging to another tenant.

For every result, open it and confirm that it lands on the correct permitted
record page.

## 10. Non-goals for this release

- Searching document uploads, internal notes, email bodies, or guest ID files.
- Cross-tenant support/admin search.
- Search history stored in a database.
- Typo tolerance, AI answers, semantic search, or an external search engine.
- Adding every dashboard module before the core flow is proven.

These can be considered only after the core Booking, Guest, Room, and Invoice
experience is accurate, fast, and permission-safe.

## 11. Launch checklist

- [ ] The header no longer pretends to accept text when global search is absent.
- [ ] The API route is registered in app.ts and protected by authentication,
      tenant scope, and RBAC.
- [ ] The UI uses ModalShell and dashboard design tokens.
- [ ] Keyboard, touch, and screen-reader flows pass.
- [ ] API and browser test suites pass.
- [ ] Tenant-isolation tests pass.
- [ ] Benchmark meets the p95 target or approved indexes are added.
- [ ] Pilot metrics show a high successful-selection rate and no privacy issue.
- [ ] Product/help documentation explains Cmd/Ctrl + K in one simple sentence.

