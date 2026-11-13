# ResortPro Website Builder — Deep Functional QA

**Date:** 2026-10-28  
**Perspective:** resort owner, manager, marketer, developer, guest, QA engineer, security reviewer, and SaaS product reviewer  
**Scope:** dashboard builder, themes, live preview, publishing, persistence, public website, responsive behavior, roles, image security, custom domain, SEO/GA, and customer-facing forms  
**Verdict:** **NO-GO for marketing this as a complete, dependable website builder.** The core editor and persistence path work, but several visible controls have no effect in some themes, “Publish immediately” is not true, dynamic/custom theme preview is incomplete, and role/domain behavior is inconsistent.

## Executive summary

This is not merely a decorative UI. The core path is real:

- authenticated owners can load and edit website content;
- valid changes persist in the database;
- the public API receives the published content;
- saved edits survive a dashboard refresh;
- theme search and fullscreen preview open;
- testimonial add/remove, section reorder/hide, SEO, social, WhatsApp and publish confirmation operate;
- the public site rendered with one H1, no broken images in the sample, and no mobile horizontal overflow;
- upload authentication and real-file signature validation are present;
- all 221 API tests, API TypeScript, web TypeScript and the design-system ratchet passed.

However, the product currently over-promises in places. The most important examples are:

1. **Minimal theme ignores Gallery and Testimonials**, although the builder lets users edit and publish both.
2. **Amenities only exists in Coastal**, but the control remains visible for every theme. Conversely, Offers exists in Coastal/Tea Garden but is absent from the section controller.
3. **Published content can remain stale for up to 60 seconds**, while the UI says it is live immediately. A changed GA ID can remain stale for up to one hour.
4. **Live preview is timing-dependent**; the same test passed once and missed the update once.
5. **Uploaded/AI/TEMPLATE theme live-edit preview is not fully wired**, so the differentiating custom-theme story is weakest exactly where it matters most.
6. **Marketer/Developer can open the builder but cannot load domain/design-service data; Manager can see domain controls but cannot change them.** The UI does not explain or hide these unavailable operations.
7. The API accepts unknown theme keys and duplicate/unknown section IDs, which can produce fallback themes, repeated sections and inconsistent editor state.

## Test coverage and results

### Browser journey

Headless Chromium ran the owner journey against local web and API servers.

| Area | Result | Evidence |
|---|---|---|
| Builder load | Pass | Heading and editor rendered |
| Eight editor areas | Pass | 8/8 tabs reachable |
| Theme search | Pass | Luxe found by search |
| Fullscreen theme preview | Pass | Preview controls opened |
| Dirty-state warning | Pass | “Unsaved changes” appeared |
| Unsaved live preview | **Intermittent fail** | Passed once, missed the marker once |
| Testimonial add/remove | Pass | Count increased then temporary item removed |
| Section reorder | Pass | Move action changed dirty state |
| Section visibility | Pass | About toggle accepted |
| SEO/social/WhatsApp input | Pass | Valid values accepted |
| Publish confirmation | Pass | Confirmation modal opened |
| API persistence | Pass | Published hero matched marker |
| Refresh persistence | Pass | Marker survived dashboard reload |
| Immediate live site | **Fail** | Public page showed cached content |
| Public heading | Pass | Exactly one H1 in tested site |
| Public images | Pass | Zero broken rendered images |
| Public mobile layout | Pass | 0 px horizontal overflow |
| Builder mobile reachability | Pass | 8/8 tabs visible |
| Builder mobile layout | Pass | 0 px horizontal overflow |
| Console/page errors | Pass | Zero errors |
| Data restoration | Pass | Original demo website restored |

Playwright observed aborted iframe/RSC/pageview requests during deliberate navigation and iframe replacement. All were `ERR_ABORTED`; they were navigation cancellations, not server failures, and are not counted as product defects.

### API behavior

| Check | Result |
|---|---|
| Authenticated website read | Pass (200) |
| Unauthenticated website read blocked | Pass (401) |
| Public resort data | Pass (200) |
| Missing resort | Pass (404) |
| Theme catalogue | Pass; four active themes returned |
| Invalid color | Pass; rejected (400) |
| Invalid social URL | Pass; rejected (400) |
| Invalid GA4 ID | Pass; rejected (400) |
| Unknown/duplicate section IDs | **Fail; accepted (200)** |
| Unknown theme ID | **Fail; accepted (200)** |
| Valid content persistence | Pass |
| Public API sees published content | Pass |
| Invalid availability range | Pass; rejected (400) |
| Invalid booking payload | Pass; rejected (400) |
| Staff builder access | Pass; blocked (403) |
| Disguised HTML-as-PNG upload | Pass; rejected (400) |
| Unauthenticated upload | Pass; blocked (401) |

### Role matrix

| Role | Website content API | Tenant/domain read | Effective experience |
|---|---:|---:|---|
| Owner | 200 | 200 | Full builder/domain access |
| Manager | 200 | 200 | Builder loads; domain writes are Owner-only |
| Marketer | 200 | 403 | Builder loads, but Domain and Custom Design data/actions fail |
| Developer | 200 | 403 | Builder loads, but Domain and Custom Design data/actions fail |
| Staff | 403 | 403 | Correctly blocked |

## Findings

### WB-001 — Critical — Visible controls have no effect in some themes

The builder presents one universal set of sections, but theme capabilities differ without being disclosed.

- Minimal does not render Gallery or Testimonials at all.
- Amenities is rendered only by Coastal.
- Luxe and Tea Garden do not render Amenities even though it is editable/toggleable.
- Coastal and Tea Garden render Offers, but `SITE_SECTIONS` does not contain Offers, so owners cannot reorder or hide it from the builder.
- Minimal's order list excludes Gallery, Testimonials, Amenities and Offers.

This is the clearest “UI exists but does not work” issue. A user can invest time adding photos/reviews, publish successfully, and see nothing.

**Required fix:** define per-theme capabilities in the theme contract. Hide unsupported controls or display “Not supported by this theme.” The section controller and renderer must use the same capability source. Add an Offers control where supported.

### WB-002 — Major — “Live immediately” is false because public content is cached

The builder says changes are live immediately. The public page fetch uses `revalidate: 60`, and the GA layout uses `revalidate: 3600`. Browser QA confirmed persistence immediately but the public page still displayed stale content.

**Impact:** owners can publish, open the site, believe publishing failed, retry, or contact support. GA changes can appear broken for an hour.

**Required fix:** use tag-based cache invalidation from the publish route, or make website content no-store/dynamically revalidated. Invalidate both page/metadata and GA layout data.

### WB-003 — Major — Live preview has a startup race

The parent writes session storage and sends `postMessage` after a debounce. The preview frame installs its listener after mount. If the update is sent while the frame is loading, the message can be missed; the repeated browser run produced one pass and one miss.

**Required fix:** implement a preview-ready handshake. The iframe should post `rp-preview-ready`; the parent should send the latest complete form after readiness and on every subsequent change. Validate `origin` and `source` on both sides.

### WB-004 — Critical — Dynamic/custom theme preview is incomplete

In preview mode the public page deliberately sets config JSON to null and resolves the preview key through the hardcoded registry. TEMPLATE live editing is explicitly marked “not wired up yet.” Uploaded/AI/TEMPLATE themes therefore cannot reliably show the selected real theme with unsaved owner edits inside the main builder.

This weakens the SaaS differentiator: paid/custom themes are exactly where users most need accurate preview-before-publish.

**Required fix:** fetch preview theme data by the requested key, enforce preview access, render Config/TEMPLATE themes through their actual renderer, and apply unsaved data through a shared preview contract.

### WB-005 — Major — Unknown theme IDs are accepted

`PUT /api/website` deliberately allows an unknown `templateId`. QA sent a nonexistent key and received 200. The public renderer then falls back to a default hardcoded theme while the dashboard can still display the unknown key.

**Required fix:** reject unknown keys for new writes. For legacy stale keys, migrate/repair on read or provide an explicit fallback response rather than accepting new invalid state.

### WB-006 — Major — Section arrays accept unknown and duplicate IDs

The API accepts arbitrary `hiddenSections` and `sectionOrder`. `orderSections` filters unknown IDs but does not deduplicate known IDs. A duplicated known section can be rendered twice and creates duplicate React keys.

**Required fix:** server-side allowlist, deduplication and canonical ordering; also deduplicate defensively in `orderSections`.

### WB-007 — Major — Builder roles and available actions disagree

Sidebar and website content API allow Owner, Manager, Marketer and Developer. Tenant/domain APIs allow only Owner/Manager reads, and domain writes are Owner-only. Custom Design list/create allows only Owner/Manager. The page still shows Domain and Custom Design to Marketer/Developer and writable domain UI to Manager.

**Required fix:** return capability flags or derive them from role; hide or make controls read-only with an explicit explanation. Query errors must have visible states rather than silently producing empty/default UI.

### WB-008 — Major — Domain “verified & live” does not prove HTTPS readiness

The builder marks a DNS-verified domain as “Verified & live.” SSL provisioning is a separate settings action. The API provisioning endpoint only changes status to `provisioning`; code contains no automatic certificate completion worker/webhook, while admin can manually mark it active.

**Required fix:** show DNS and HTTPS as separate states, expose SSL status in the builder, and only say “live” after an actual HTTPS health check succeeds. Complete the production certificate automation or document the infrastructure mechanism and test it on staging.

### WB-009 — Major — Required and quality constraints are mostly presentation-only

- Hero Title displays `*` but can be empty; API makes it optional.
- Testimonials can be published with blank guest name and blank review text.
- WhatsApp accepts arbitrary text; non-digits can produce an invalid `wa.me/` link.
- Gallery's 20-image limit exists only in the client; API accepts an unbounded array.

**Required fix:** share frontend/backend validation; enforce non-empty title, complete testimonials, plausible E.164 WhatsApp number and bounded arrays/string lengths.

### WB-010 — Major — Public conversion forms need abuse and end-to-end protection evidence

Booking, feedback, venue enquiry, vehicle enquiry and food order are public write endpoints. Payload validation exists, and booking conflict protection is strong, but these routes have no visible CAPTCHA/honeypot and no route-specific anti-spam evidence in this audit. Real successful submissions were not fired against the demo tenant to avoid emails and operational records.

**Required fix:** add route-specific rate limits, bot mitigation/honeypot, idempotency where relevant, operational alerts, and maintained E2E tests on an isolated test tenant.

### WB-011 — Major — No maintained website-builder regression suite

No existing API integration test specifically covered WebsiteContent, theme capability contracts, publish cache invalidation, role matrix or builder browser behavior. The temporary QA automation was removed after use.

**Required fix:** commit API integration tests and Playwright tests for every builder tab, every supported theme, publish/refresh/live behavior, role capabilities, uploads, domain state and public forms.

### WB-012 — Minor — Destructive and failure UX needs tightening

- Removing a custom domain has no confirmation.
- Website/tenant query failures lack a full-page visible error/retry state.
- Theme catalogue failure silently falls back to three static themes, which can hide backend outages and omit purchased/custom themes.
- Image remove buttons and section switches need stronger accessible names/states (`aria-label`, `aria-pressed`/switch semantics).

## Theme capability matrix

| Builder capability | Luxe | Minimal | Coastal | Tea Garden |
|---|---:|---:|---:|---:|
| Hero/About | Yes | Yes | Yes | Yes |
| Rooms/Booking | Yes | Yes | Yes | Yes |
| Gallery | Yes | **No** | Yes | Yes |
| Testimonials | Yes | **No** | Yes | Yes |
| Amenities | No | No | Yes | No |
| Menu/Venues/Vehicles | Yes | Yes | Yes | Yes |
| Availability | Yes | Yes | Yes | Yes |
| Contact | Yes | Yes | Yes | Yes |
| Social links | Yes | Yes | Yes | Yes |
| WhatsApp | Yes | Yes | Yes | Yes |
| Offers | No | No | Yes, not controllable | Yes, not controllable |

## What passed strongly

- Authentication and basic role blocking work.
- Tenant-scoped content read/write persisted correctly.
- Invalid color, social URL and GA IDs are rejected.
- Uploads require authentication and sniff real image signatures.
- Paid-theme server-side access checks exist for known themes.
- Public booking uses a serializable transaction and protects against overlapping bookings.
- Public mobile layout had no horizontal overflow in the tested theme.
- The tested site had one H1, no broken images and no browser console/page errors.
- Full API suite: **221/221 passed**.
- API TypeScript: pass.
- Web TypeScript: pass.
- Design-system ratchet: pass; no regression.

## Release recommendation

Do not sell this yet as “every option works across every theme.” The core builder can be demonstrated using a known-compatible hardcoded theme, but a customer handoff should not claim full builder reliability until WB-001 through WB-008 are closed.

### Minimum handoff gate

1. Add a canonical theme capability contract and make controls capability-aware.
2. Fix publish cache invalidation, including GA/metadata.
3. Add preview readiness handshake.
4. Make Config/TEMPLATE/custom theme preview accurate.
5. Reject unknown theme/section IDs and deduplicate section order.
6. Make tabs/actions role-aware with visible permission errors.
7. Separate DNS verified, SSL active and live health status.
8. Enforce shared content validation.
9. Commit website API + Playwright regression tests.

After those fixes, rerun all four hardcoded themes plus at least one Config and one TEMPLATE theme, then test a real staging custom domain with HTTPS and a complete public booking/contact journey.

## Safety and cleanup

- No paid theme purchase was initiated.
- No custom design request was submitted.
- No real domain/DNS/SSL state was changed.
- No valid public booking, enquiry, food order or email was created.
- All temporary website-content mutations were restored and verified.
- Temporary QA test files/scripts were not intended to remain in the repository.

