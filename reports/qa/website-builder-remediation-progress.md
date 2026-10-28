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

### WB-004, first half — the previewed theme is the theme that renders

`?preview=<key>` set the theme *key* and then threw the config away:

```ts
const configJson = isPreview ? null : data.themeConfig;
```

The reasoning was sound — a preview should show the previewed theme, not the
saved one — but nothing ever looked the previewed theme up. So an UPLOADED or
AI_GENERATED key fell through `getTheme()` to the luxe default. An owner who
had just paid ৳3,000 for a theme pressed Preview and saw a different theme,
with nothing on the page to say so.

Reproduced on the branch before the change, with two deliberately garish QA
themes. The decisive measurement is that the two URLs were not merely both
wrong, they were the same page:

| URL | rendered | bytes |
|---|---|---|
| `/palm-paradise-resort?preview=wb004-uploaded` | luxe | 95,734 |
| `/palm-paradise-resort?preview=wb004-template` | luxe | 95,734 |

After: `resolvePreviewConfig()` in `site-data.ts` resolves the key, and the
page passes the result to `PreviewPage`.

| URL | luxe-only markup | theme's own colour | bytes |
|---|---|---|---|
| `?preview=wb004-uploaded` | absent | `#fff200` present | 71,832 |
| `?preview=minimal` | absent | — | 70,491 |
| `?preview=wb004-template` | **present** | — | 95,734 |
| live site | present | — | 95,262 |

The third row is not a failure, it is the scope line: **TEMPLATE preview is
still the fallback.** Compiling a Tier 2 theme as the owner types needs
Handlebars on the client, which is a decision of its own and is not taken here.
`/theme-preview/[key]` still covers static preview for those.

A note on the evidence, because the first signal was weaker than it looked.
Grepping the response for the QA theme's marker text showed it present after
the change and absent before, which is true but proves only that the config
reached the client — the marker sits in the serialized RSC payload. What proves
the theme *renders* is the pair above: the theme's own `#fff200` in real
markup, and luxe's own classes gone from it.

**Requests per page view**, measured from the API log, because the fix adds a
lookup:

| | requests |
|---|---|
| live site | 1 — unchanged |
| preview of the theme already saved | 1 — answered from the payload in hand |
| preview of any other theme | 2 |

That middle row is not only an optimisation. It is the one branch that still
works for a theme unpublished *after* a tenant chose it: `/site/:slug` returns
their theme whatever its status, while `/site/theme/:key` now refuses one.
Without it an owner in that position would be dropped onto luxe inside their own
builder.

Two test files, 25 tests, and the second exists because of where the bug was.
`preview-theme.test.ts` covers the resolver; `preview-page-theme.test.tsx`
calls the server component the way Next does and reads what it passes down —
a test on the resolver alone passes with the original one-line bug still in
place.

Each mutation applied alone:

| mutation | result |
|---|---|
| page never looks the previewed theme up (the original bug) | 5 tests fail |
| page uses the saved config in preview mode | 4 fail |
| the tenant's own theme is re-fetched instead of used in hand | 3 fail |
| any key resolves to the saved config | 7 fail |
| the key is not escaped into the URL | 1 fails |
| no guard for a missing key | 1 fails |

### WB-004, second half — a previewed Tier 2 theme renders as itself

The first half taught the page to look the previewed theme up. It looked up a
*config*. A Tier 2 (TEMPLATE) theme has no config — it has Handlebars HTML in
a different column — so a TEMPLATE key still resolved to null and still fell
through `getTheme()` to luxe. Measured on the step-2 commit, with a Tier 2
theme whose own stylesheet paints the hero `#00e5ff` and whose markup carries
a unique marker:

| `/palm-paradise-resort…` | bytes | the Tier 2 marker | its own `#00e5ff` | luxe-only markup |
|---|---|---|---|---|
| **before**, `?preview=wb004-tier2` | 58,268 | absent | absent | **present** |
| **before**, `?preview=luxe` | 58,240 | absent | absent | present |
| **after**, `?preview=wb004-tier2` | **26,932** | **present** | **present** | absent |
| **after**, `?preview=luxe` | 58,258 | absent | absent | present |

The two "before" rows are the same page within 28 bytes. That is the same
symptom the first half had, surviving in the one tier the first half did not
reach.

All counts are of non-`<script>` markup. That distinction is not pedantry: in
the first half I briefly reported a theme as rendering because its marker text
was present, when the marker was only inside the serialized RSC payload and
never drawn. Here the browser confirms it independently — `#hero` computes to
`rgb(0, 229, 255)` with `letter-spacing: 5.28px`, both from the theme's own
stylesheet, the `<h1>` reads "Palm Paradise" where the template source says
`{{tenant.name}}`, and the booking widget the template declares with
`data-rp-widget` is mounted and interactive.

**The decision this was waiting on was a false choice.** It was posed as
Handlebars on the client (~80KB, true live editing) versus an honest notice.
Compiling on the *server* was the option not on the list, and it is strictly
better than either: `page.tsx` is already a Server Component, Handlebars is
already a server dependency there, and the owner's first paint is the real
theme rather than a flash of fallback. The ~80KB buys exactly one thing —
re-compiling as the owner types — and nothing else was blocked on it.

So the notice is still there, narrowed to what is actually true. A compiled
HTML string cannot show an edit that has not been saved, so the Tier 2 preview
reads "saved content — unsaved edits not shown" where the other tiers earn a
"● live" badge once an edit arrives. Showing "● live" there would be worse
than showing nothing: unchanged text would read as a lost edit.

`resolvePreviewConfig` became `resolvePreviewTheme`, returning a config *or* a
template from the request it was already making, and both halves of a Tier 2
theme are compiled by one `compileTier2` now shared with the live site — so a
previewed template cannot drift from the published one. Requests per page view
are therefore unchanged from the first half:

| | API requests |
|---|---|
| live site | 1 |
| preview of the theme already saved | 1 |
| preview of any other theme, config or template | 2 |

**The unreleased-theme gate still holds, and it had to be re-checked** — this
change is the first time the public slug page reads `templateHtml`, which is a
whole Tier 2 design, not just a colour palette. With the Tier 2 theme set to
DRAFT and asked for with no signature:

| | result |
|---|---|
| `/site/theme/wb004-tier2` | HTTP 404, "Theme not found" |
| `?preview=wb004-tier2` for a resort that does not own it | falls back to luxe; no marker, no `#00e5ff` |
| the same DRAFT theme, for the resort whose own theme it is | renders, live and in preview |
| the picker's own list, `/site/:slug/themes` | excludes it |

That last pair is the split the code is built around: `/site/:slug` carries a
resort's own theme whatever its status, so an owner is not dropped onto luxe
inside their own builder by an admin unpublishing a design — while a stranger
guessing the key still gets nothing.

Eight mutations, each applied alone, all killed:

| mutation | result |
|---|---|
| the TEMPLATE branch deleted (the step-3 bug itself) | 10 tests fail |
| page never hands the template down | 5 fail |
| the stylesheet is dropped | 3 fail |
| the missing-HTML guard removed | 2 fail |
| the resort's own Tier 2 theme not read from the payload | 2 fail |
| CSS passed through uncompiled | 2 fail |
| PreviewPage ignores the template | 2 fail |
| the Tier 2 banner claims to be live | 1 fails |

A third test file exists, `preview-page-render.test.tsx`, because the last two
of those mutations live in the client component that *chooses* a renderer, and
the first two test files stay green for both. This is the third time in this
work that the bug was in the choosing rather than in the value returned.

**Still not done:** live typing inside a Tier 2 template. That is the ~80KB,
and it is now the only thing it buys.

### WB-004, step 4 — what the theme picker shows

Both the picker's thumbnails and its preview modal build exactly
`/${slug}?preview=${theme.key}` — the URL measured above — and neither seeded
theme carries a `previewImage`, so both fall to the live-iframe path. On that
basis the thumbnails and the modal are fixed by the same change. Stated at the
level it was checked: the URL they construct was verified end to end, in the
browser and byte for byte; the picker itself was not driven through the
dashboard, which would need a login the throwaway database has no user for.

One cost worth recording rather than hiding. Every thumbnail without a
`previewImage` is a full page render of `?preview=<key>` in an iframe scaled to
0.2, so opening the picker costs one server render per theme — and, since the
preview now looks the theme up, about **2N API requests instead of N**. The
requests are two indexed reads of public data and the per-resort limiter is
generous, so nothing is at risk; but the long-term answer is generating
`previewImage` at upload rather than rendering N pages to show N thumbnails.
That predates this work and is not changed by it.

### Found while verifying the above — centred About layout drops its bullets

Not WB-004 and not fixed here. `ConfigAbout.tsx` builds a `TextBlock` that
renders `about.bullets`, but `layout === 'centered'` takes an early return that
re-implements the heading markup inline and never uses it, so a theme package
that specifies `centered` loses every bullet it ships, silently. Shown both
ways on the same theme:

| `about.layout` | bullet in rendered DOM |
|---|---|
| `image-right` | yes |
| `centered` | no |

Raised as its own task rather than folded in.

### WB-012, first item — removing your own domain now asks, and reports failure

Two problems in the same six lines of `settings/page.tsx`.

One click on a small trash icon removed the resort's custom domain outright.
The address they put on their cards stops leading to their site and the SSL
status is cleared with it, and the most likely reason an owner clicks there is
to correct a typo in the domain — which removed it instead. The admin panel
already called `confirm()` before doing the same thing to the same record; the
owner's own page did not.

The second was `catch { /* ignore */ }`. A removal that failed and one that
worked were indistinguishable from outside: no toast either way, no change on
screen, the domain still live, and reloading the page the only way to find
out.

`ConfirmDialog` already existed and already solves both — it is ModalShell-
based, awaits an async `onConfirm`, and shows a thrown error on the dialog
rather than closing. The fix is wiring the button to it and rethrowing instead
of swallowing, plus an accessible name on a button whose only content was an
icon. The dialog also says what *keeps* working (their free `resortpro`
address), not only what stops.

Five mutations, each applied alone, all killed:

| mutation | result |
|---|---|
| the trash button removes outright again (the bug itself) | 6 tests fail |
| no accessible name on the trash button | 6 fail |
| the failure is swallowed again | 2 fail |
| the dialog stops warning it cannot be undone | 1 fails |
| the dialog no longer names the domain | 1 fails |

The test mounts the settings page rather than `ConfirmDialog`, because neither
half of this lives in the dialog — both are in how the button is wired to it.
One note for whoever writes the next one: the react-query mock has to return
stable object identities. A fresh object per render sends the page's domain
effect into a setState loop that kills the vitest worker after 95 seconds,
which looks like a hang in the code under test and is not.

**Two items of WB-012 remain:** a full-page error and retry state for a failed
website/tenant query, and switch semantics on the section toggles.

### WB-012, third item — a catalogue outage stopped passing for the catalogue

The picker falls back to three static free themes when `/site/:slug/themes`
fails. That part is right and stays: a wall of locks during an outage is worse
than three usable themes. What was wrong is that the fallback was silent. An
owner who had bought a theme opened the panel during an outage, found three
free themes with no trace of the one they paid for, and had nothing on screen
to say the list was incomplete rather than the purchase gone.

Counting how many ways this could break without anyone noticing was the part
worth doing. Only two of five produced an error at all:

| what goes wrong | before | now |
|---|---|---|
| the request throws | caught, silent | notice |
| a non-2xx status | not checked | notice |
| the body is not JSON | caught, silent | notice |
| `success: false` | fell through the condition | notice |
| `data` is not a list | fell through the condition | notice |
| an empty catalogue | fell through — correctly | no notice, free themes kept |

Three of them never failed; they fell through `if (json.success && …)` and
left the fallback in place, so nothing was logged internally either. The last
row is the one that must *keep* falling through: nothing published yet is a
real answer, not an outage.

The notice is `role="alert"`, says a bought theme is missing rather than lost
and that the live website is unaffected, and carries a Retry that clears it on
success and keeps it on another failure.

Six mutations, each applied alone. Five died at once; **one survived**, and
that is worth recording rather than smoothing over: deleting the `res.ok`
check kept the suite green, because the 500 fixture carried a malformed body
that the next check caught anyway. The fixture now carries a well-formed
success envelope behind a 500 — a stale proxy response, the one shape only
`res.ok` catches — and deleting the check fails. The mutation was the only
thing that found that; the suite looked complete without it.

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
| WB-004 | live typing inside a Tier 2 template | needs Handlebars in the browser (~80KB on the preview path). Everything else about preview is closed; this is the only thing that bundle buys |
| WB-007 | Roles see actions they cannot use | needs capability flags from the API, then the UI |
| WB-008 | "Verified & live" from DNS alone | needs an HTTPS check and the production SSL path documented; part of it is infrastructure, not code |
| WB-012 | Error states and accessibility | two of four items done (domain removal, catalogue outage). Remaining: a full-page retry state for a failed website/tenant query, and switch semantics on the section toggles |
| — | Draft, publish and rollback | item 8 of the spec: a versioning model with migrations. A feature in its own right, not a gate that can be slipped in |

Phase 1 and Phase 2 of the brief — multi-page sites, media library, SEO suite,
analytics, lead inbox, multilingual, smart blocks — are untouched. Each is a
product of its own and none should start before the P0 list is closed.

---

## Handoff verdict

**NO-GO**, unchanged from the audit.

What changed is that six of its eight gates are closed with tests that fail
when the behaviour comes back, and the test suite can now carry the rest. The
two that mattered most to a first day are among them: publishing and seeing
nothing happen, and a preview that sometimes showed none of your edits.

WB-004 is closed for every theme kind: press Preview on a theme you bought —
config-driven or Tier 2 template — and that theme is what renders. What is not
closed is live *typing* inside a Tier 2 template, where the preview shows saved
content and says so on the page. That is a narrower gap than the gate was, and
it is stated to the owner rather than left to be discovered.

What remains is WB-007, WB-008 and the last two items of WB-012. WB-007 and
WB-012 are small. Part of WB-008 is infrastructure rather than code. Separately, UPLOADED and
AI_GENERATED themes are still offered every section control in the builder
rather than their own.
