# Website Builder Remediation — Progress

**Started:** 2026-10-28
**Parent audit:** [2026-10-28 Website Builder deep functional QA](./2026-10-28-website-builder-deep-functional-qa.md)
**Branches:** `fix/e2e-rate-limit` (#6, merged), `fix/website-publish-freshness` (#7, merged), `fix/preview-handshake` (WB-003)
**Status:** five P0 gates closed, one dependency closed first. **Customer handoff remains NO-GO.**

The audit's own minimum handoff gate lists eight items. Five are done. This file
records what was actually changed and verified, and is updated as the rest land.

---

## Done

### 0 — The E2E suite stopped throttling itself (dependency, not an audit finding)

**Status:** fixed · `61923c6`

Not in the audit, but everything the audit asks for is more browser tests, and
the suite could not carry them. It was being refused by the API's own rate
limiter: 972 responses with status 429 in one local run, 139 even at CI's
single worker. They mostly landed on dashboard widgets no test asserted on, so
the suite stayed green by luck — until a CRM test asserted on data whose
request was the one refused and CI failed on its first attempt, which CI's two
retries then turned back into a green.

| | |
|---|---|
| Files | `apps/web/tests/e2e/helpers.ts`, `roles.spec.ts`, `crm.spec.ts`, `apps/api/src/app.ts`, `.github/workflows/ci.yml`, `apps/api/tests/unit/rate-limit-max.test.ts` |
| Migration | none |
| API behaviour | the global ceiling reads `RATE_LIMIT_MAX`, default unchanged at 300; an unset, unparseable, zero or negative value is 300 |
| Browser behaviour | unchanged |
| Tests added | 10 unit tests on the ceiling |
| Verified | three consecutive full runs at four local workers, retries disabled: 58/58 each, **zero 429s**, wall clock 2.0 → 1.0 min. Mutating the guard to accept zero fails three tests |
| Remaining risk | none known |
| Rollback | revert the commit; the default was never changed |

`useRole` gives a describe block one login instead of one per test. That alone
took 972 throttled responses to 272; the rest are the dashboard shell reloading
on every navigation, which is what the configurable ceiling covers.

### WB-001 — Visible controls that the theme ignores

**Status:** fixed · `b26da27`

The builder offered one universal set of section controls and the themes
disagreed without saying so. On Minimal an owner could add photos and reviews,
reorder them, publish, open the site and find neither. Amenities was offered
everywhere and drawn only by Coastal. Offers was drawn by Coastal and Tea
Garden and offered by nobody, so it could not be hidden or moved at all.

| | |
|---|---|
| Files | `apps/web/src/components/themes/capabilities.ts` (new), the four theme `index.tsx`, `_utils/sections.ts`, `apps/web/src/app/(dashboard)/dashboard/website/page.tsx` |
| Migration | none |
| API behaviour | unchanged in this commit |
| Browser behaviour | the section list is the chosen theme's own order; Offers is controllable; what a theme cannot draw is **named**, not hidden; the Gallery and Testimonials tabs say so above the fields |
| Tests added | 22 unit (`theme-capabilities.test.ts`), 5 browser × 2 projects (`website-builder.spec.ts`, listed in CI) |
| Verified | see below |
| Remaining risk | config and template themes are given the full set, because their capability is not known here — accurate for them is part of WB-004 |
| Rollback | revert; nothing persisted changes shape |

One list per theme, living in that theme's own file beside the sections it
renders. `capabilities.ts` only collects them — a second hand-written list
there would have been free to drift, which is the bug rather than its fix.

The test that matters reads each renderer's source and compares the keys of its
section map against the list the theme exports. Adding a section to a theme
without declaring it fails there; a mutation confirms it does.

**Truth table, as the code now states it:**

| | luxe | minimal | coastal | tea-garden |
|---|---|---|---|---|
| gallery | yes | **no** | yes | yes |
| testimonials | yes | **no** | yes | yes |
| amenities | no | no | **yes** | no |
| offers | no | no | **yes** | **yes** |

### WB-005 and the storage half of WB-006

**Status:** fixed · `4ce08d7`

| | |
|---|---|
| Files | `apps/api/src/routes/website.ts`, `packages/types/src/website-sections.ts` (new), `packages/types/src/index.ts`, `apps/web/src/components/themes/capabilities.ts` |
| Migration | none |
| API behaviour | an unknown `templateId` is refused with `UNKNOWN_TEMPLATE` (400) **when it is a change**; `sectionOrder` and `hiddenSections` are cleaned — unknown ids dropped, repeats kept once, the owner's order preserved |
| Browser behaviour | unchanged |
| Tests added | 10 integration (`website-section-validation.test.ts`) |
| Verified | each guard mutation-tested alone: removing the template refusal fails two tests, storing section ids unchecked fails two more. Full API suite 966/966 across 85 files |
| Remaining risk | a tenant already on a stale key keeps it until they choose a real one. Deliberate, and pinned open by a test — refusing every save would lock them in behind their own bad state |
| Rollback | revert; cleaned values already stored stay valid |

The section vocabulary moved to `@resort-pro/types` so the editor and the API
validate against one list rather than two that could drift.

### WB-009 — Required and quality constraints were presentation-only

**Status:** fixed · `bde4e2d`

| | |
|---|---|
| Files | `apps/api/src/routes/website.ts` |
| Migration | none |
| API behaviour | Hero Title must not be blank; a testimonial needs a name and words; the gallery is capped at 20 server-side; WhatsApp must be a plausible E.164 number, with typed punctuation normalised rather than refused; generous length caps on the free-text and SEO fields |
| Browser behaviour | unchanged — the form already showed these rules, which was the problem |
| Tests added | 15 more integration tests (25 in that file) |
| Verified | full API suite **981/981** across 85 files; mutating the hero-title guard to accept empty fails the test that covers it |
| Remaining risk | a tenant whose stored hero title is already blank must type one before their next save. Deliberate: the field is marked required and a website with no headline is broken |
| Rollback | revert; no stored value becomes invalid |

`+880 1712-345678` and `008801712345678` both become `+8801712345678`. A resort
owner typing their own number the way they say it is not an error; text that
could not be a phone number is.

### WB-002 — "Live immediately" was false

**Status:** fixed · owner chose to stop caching website content

`(public)/[slug]/page.tsx` fetched with `revalidate: 60` and `layout.tsx` —
which carries the metadata and the GA id — with `revalidate: 3600`. Publishing
writes to the database at once, so the dashboard was right and the website was
wrong for up to a minute, or an hour for analytics. This is the one a pilot
resort owner meets on their first day: they publish, open the site, see no
change, and conclude it did not work.

Two ways out were put to the owner — tag the fetches and invalidate them from
the publish route, which needs a shared secret in both deployments, or stop
caching the content. They chose the second: correct immediately, no secret, no
deployment change.

| | |
|---|---|
| Files | `apps/web/src/app/(public)/[slug]/site-data.ts` (new), `[slug]/page.tsx`, `[slug]/layout.tsx`, `apps/api/src/routes/website.ts` |
| Migration | none |
| API behaviour | `GET /site/:slug` is counted per resort instead of per caller — see below |
| Browser behaviour | a publish is on the website on the next page view; turning on Google Analytics takes effect at once instead of within the hour |
| Tests added | 8 web unit (`site-data.test.ts`), 5 API integration (`public-site-rate-limit.test.ts`) |
| Verified | measured against a seeded throwaway resort, below |
| Remaining risk | one API call per page view instead of one per minute. Two indexed reads of public data, and the ceiling below is what keeps that bounded |
| Rollback | revert; nothing persisted changes shape |

The builder's own wording — *"Your changes will be live for guests
immediately"* — needed no edit. It is now true, which was the point; weakening
the promise would have been the other kind of fix.

**The rate limiter had to move with it.** The global ceiling keys on the IP
address, which is right for an authenticated API. But this route is read by the
Next server rendering a resort's website, so from the API's side every visitor
of every tenant site arrives as one address: the web container's. 300/min would
have been 5 page views per second for the entire fleet. The minute cache was
hiding it; removing the cache would have turned it into 429s on resort
websites. The route now counts per slug, so each resort has its own ceiling and
one resort's traffic cannot throttle another's. Bounding abuse per source
address for an unauthenticated public read belongs at the edge, not in this
process, and that is said in the code rather than left to be discovered.

**Measured, not assumed.** Against a throwaway database seeded with the demo
resort:

| | |
|---|---|
| API calls per page view | **1** — the layout, `generateMetadata` and the page share one request, where the route used to make three against two different cache policies |
| A publish, then an immediate reload | the new hero title is there; the old one is gone |
| Analytics switched on, then an immediate reload | the `gtag` tag is in the HTML — this also proves the layout is reading from that shared call |
| The same, with `revalidate: 60` put back | the publish is **invisible**. The bug reproduces exactly, which is what makes the fix a fix |

`sitemap.ts` still reads with `revalidate: 3600`, deliberately. Its URLs are
static and the fetch is only an existence check; a crawler does not need the
answer to be a second old, and making it uncached would add load for no
freshness anyone experiences.

### WB-003 — The live preview had a startup race

**Status:** fixed

The editor posted the unsaved form into the preview frame on a 600ms debounce;
the frame installed its listener after mount. `postMessage` has no queue, so an
update sent while the frame was still loading reached a window that was not
listening and was dropped. The audit's repeated browser run produced one pass
and one miss.

| | |
|---|---|
| Files | `apps/web/src/lib/preview-channel.ts` (new), `(public)/[slug]/PreviewPage.tsx`, `(dashboard)/dashboard/website/page.tsx` |
| Migration | none |
| API behaviour | unchanged |
| Browser behaviour | the frame announces itself with `rp-preview-ready` and the editor answers with the form as it stands; the frame applies an update only from the editor window on its own origin |
| Tests added | 6 unit on the trust check, 13 unit on the frame (`preview-page-handshake.test.tsx`), 2 browser |
| Verified | every guard mutation-tested alone; see below |
| Remaining risk | none known for same-origin, which is what the frame is. A cross-origin preview frame would be refused by design, and the browser test is what would catch it |
| Rollback | revert; nothing persisted changes shape |

No amount of waiting on the sending side fixes a dropped message, so the frame
had to be the one to speak first. Once the editor answers a `ready`, the order
the two sides load in stops mattering, which is the only way a race like this
actually closes rather than narrows.

**The frame also trusted anyone.** It applied `rp-preview-update` from any
sender at all, and the preview URL needs no login — so any page could embed a
resort's site and post content into what it renders. Nothing is persisted and
the victim has to be looking at the attacker's page, so this is small, but a
page that renders whatever it is told is not worth keeping. Both sides now pin
the origin and the specific window.

**What the tests can and cannot show.** The frame's half is unit-tested,
including that it refuses a foreign origin and a sibling frame on the right
one. The editor's half lives inside the builder page, so it is covered by two
browser tests. Those cannot reproduce the original race — it is a window of
milliseconds and sessionStorage covered most of it, which is exactly why the
audit saw one pass and one miss rather than a consistent failure. The second
browser test empties sessionStorage before reloading the frame, which leaves
the handshake as the only route and makes the case deterministic.

Each mutation was checked alone, and they fail different tests, which is the
point of running them separately:

| Mutation | Fails |
|---|---|
| The frame stops announcing itself | the storage-emptied browser test, and 2 unit tests |
| The frame trusts any sender | 2 unit tests |
| A trust check that can never pass — how this would break if the frame were ever cross-origin | the first browser test, and 2 unit tests |
| Origin no longer checked | 2 unit tests |
| Source no longer pinned | 3 unit tests |

### Found while reproducing WB-004 — an unreleased theme was public

**Status:** fixed

Not in the audit. `GET /site/theme/:key` had no filter on `themeStatus` or
`isActive` at all, so the full `configJson` of an unreleased design — or a Tier
2 theme's whole HTML and CSS — came back to anyone who knew the key, with no
login. Confirmed against a row left exactly as the admin upload path leaves
one: `PREVIEW`, `isActive: false`, 200, config and all.

The schema had said so all along: `DRAFT` is "saved, not visible to tenants",
`PREVIEW` is "previewable by admin only".

| | |
|---|---|
| Files | `apps/api/src/utils/signed-theme-preview.ts` (new), `routes/website.ts`, `routes/admin.ts`, `apps/web/src/app/theme-preview/[key]/page.tsx`, `admin/(panel)/themes/page.tsx` |
| Migration | none |
| API behaviour | an unpublished theme is served only with a short-lived signature the API minted; the owner's theme list filters on status; selecting an unpublished theme is refused, unless the tenant is already on it |
| Browser behaviour | the admin's Preview link carries the signature and still works; nothing changes for a published theme |
| Tests added | 18 integration (`theme-preview-access.test.ts`) |
| Verified | five mutations, each alone; end-to-end in a browser, below |
| Remaining risk | a signed link forwarded to someone else works until it expires. That is what a signed link is; two hours bounds it |
| Rollback | revert; nothing persisted changes shape |

**Refusing outright would have been one line, and it would have been worse.**
The admin themes page offers a Preview link straight after an upload or an AI
generation, and those are exactly the themes sitting at `PREVIEW`. That link is
how an admin finds out whether an upload rendered at all. So the link is signed
instead — the same shape, and for the same stated reason, as the existing
`signed-upload-url.ts`: *"Unguessable filenames are not access control."* It is
keyed on `JWT_SECRET`, which both deployments already have, so unlike WB-002's
first option there is nothing new for anyone to set.

**A correction to this file's earlier draft.** The first pass recorded that the
owner's theme picker listed `DRAFT` themes. It does not. That came from a QA row
written by hand with `isActive: true`, a combination the application never
produces — the admin paths keep `isActive` in lockstep with `PUBLISHED`. Checked
again against a faithful row: the picker excluded it. The status filter added to
that query is therefore documentation of an invariant, not a hole being closed,
and the test that covers it has to construct the drifted row deliberately.

Mutations, each applied alone:

| Mutation | Fails |
|---|---|
| No signature check on the public route | 8 tests |
| A tenant may select an unreleased theme | 2 tests |
| Expiry no longer checked | 1 test |
| The picker's status filter removed | 1 test (the deliberately drifted row) |
| Domain separation dropped from the signature | 1 test (an upload-style signature replayed) |

The last two survived the first round, which is what a surviving mutation is
for: no test covered what those two lines are *for*, so two were added.

End to end, against a throwaway database and a disposable local secret:

| | |
|---|---|
| The admin's signed link | **200**, and the unreleased theme actually renders — its marker text and its colours |
| The same page with no signature | **404** |
| A stranger calling the API with the key | **404**, byte-identical to the response for a key that does not exist |

---

## Verification run for the work above

| Check | Result |
|---|---|
| API TypeScript | pass |
| Web TypeScript | pass |
| Full API suite | **1004/1004**, 87 files |
| Full web unit suite | **246/246**, 26 files |
| The four specs CI runs, both projects, four workers, retries off | **70 passed, 2 skipped** |
| `website-builder.spec.ts` on both projects | 12 passed, 2 skipped — the preview pane is `hidden lg:flex`, so the two preview tests do not apply on the phone project |
| Design-system ratchet | no regressions; no baseline moved |
| `git diff --check` | clean |
| 429s during that e2e run | **0** |

The 2 skipped are the preview tests on the phone project, for the reason
above.

Separately, a run of *every* spec — including the four CI does not run — gave
83/84 earlier in this work. The one failure is `auth.spec.ts` "slug
auto-generates from resort name" on Mobile Safari under four local workers. It
passes alone, twice; CI does not run that spec; nothing here touches auth or
the register page. Recorded rather than hidden — a flake that predates this.

Databases: all of the above ran against throwaway databases created and dropped
for the purpose. No demo, staging or production data was touched, nothing was
published, and no email, payment, DNS or SSL action was taken.

---

## Open, in the order they are worth doing

### Remaining P0 gates from the audit

| | Finding | Why it is not done |
|---|---|---|
| WB-004 | Config/TEMPLATE theme preview is incomplete | the differentiator, and the largest of the P0s |
| WB-007 | Roles see actions they cannot use | needs capability flags from the API, then the UI |
| WB-008 | "Verified & live" from DNS alone | needs an HTTPS check and the production SSL path documented; part of it is infrastructure, not code |
| WB-012 | Error states and accessibility | smallest of these |
| — | Draft, publish and rollback | item 8 of the spec: a versioning model with migrations. A feature in its own right, not a gate that can be slipped in |

Phase 1 and Phase 2 of the brief — multi-page sites, media library, SEO suite,
analytics, lead inbox, multilingual, smart blocks — are untouched. Each is a
product of its own and none should start before the P0 list is closed.

---

## Handoff verdict

**NO-GO**, unchanged from the audit.

What changed is that five of its eight gates are closed with tests that fail
when the behaviour comes back, and the test suite can now carry the rest. The
two that mattered most to a first day are among them: publishing and seeing
nothing happen, and a preview that sometimes showed none of your edits.

What remains is WB-004, WB-007, WB-008 and WB-012. WB-004 is the large one:
config and TEMPLATE theme preview is the differentiator, and it is also the
reason those two theme kinds are still offered every section control in the
builder rather than their own. WB-007 and WB-012 are small. Part of WB-008 is
infrastructure rather than code.
