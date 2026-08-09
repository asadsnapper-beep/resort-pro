# ResortPro Android Play Release Checklist

> Status: Planning checklist — no Android release has been built or verified
>
> Target application: proposed `apps/android/`
>
> Last repository review: 2026-08-09
>
> External policy verification: not performed for this revision

This document tracks implementation evidence for a future Google Play release. It
is not a substitute for the current Play Console policy pages. Target SDK rules,
Data Safety questions, permission declarations, and review requirements change;
the release owner must verify them against official sources immediately before
each production submission.

## 1. Status model

Use only these values in the evidence tables:

| Status | Meaning |
| --- | --- |
| Not started | No implementation or evidence exists. |
| In progress | Work exists but has not passed the required verification. |
| Verified | Tested evidence is linked and the release owner recorded the date. |
| Not applicable | A written reason explains why the requirement does not apply. |

Do not mark an item Verified because a plan says it will exist.

## 2. Current repository evidence

| Item | Current status | Evidence / gap |
| --- | --- | --- |
| Android application | Not started | `apps/android/` does not exist. |
| Privacy page source | In progress | Web route exists at `apps/web/src/app/privacy/page.tsx`; production availability and mobile link are unverified. |
| In-app privacy link | Not started | Requires Android Settings UI. |
| Account deletion in app | Not started | No Android UI exists. |
| Public account-deletion flow | Not started | No confirmed public deletion form or `#account-deletion` flow was found. |
| Data Safety declaration | Not started | Must be based on the final app, SDKs, and backend behavior. |
| Runtime permissions | Not started | No Android manifest exists. |
| Signed App Bundle | Not started | No Android build or signing configuration exists. |
| Device testing | Not started | Record device/OS evidence after implementation. |
| Store listing assets | Not started | No verified release assets are linked here. |

## 3. Policy-verification record

Before release, record the authoritative URL, date checked, reviewer, and decision
for each time-sensitive policy.

| Topic | Official source | Checked on | Reviewer | Decision/evidence |
| --- | --- | --- | --- | --- |
| Target API level | — | — | — | Not verified |
| Data Safety | — | — | — | Not verified |
| Account deletion | — | — | — | Not verified |
| Permissions | — | — | — | Not verified |
| Payments | — | — | — | Not verified |
| App access/reviewer credentials | — | — | — | Not verified |

Do not hardcode an old target API level in this checklist. Set `compileSdk` and
`targetSdk` during Phase 0 of Android development after completing this review.
The proposed `minSdk` is a product/device-support decision, not a Play policy fact.

## 4. Privacy policy and Data Safety

### Required work

- [ ] Confirm the production privacy-policy URL loads without authentication.
- [ ] Link the same policy from Android Settings and the store listing.
- [ ] Identify the legal entity and privacy contact responsible for ResortPro.
- [ ] Inventory every data element collected, generated, shared, retained, and
  deleted by the app and included SDKs.
- [ ] Reconcile that inventory with the final Data Safety answers.
- [ ] Document transport encryption, retention, deletion, and optional/required use.
- [ ] Repeat the inventory whenever analytics, crash reporting, scanning, push,
  payment, or advertising SDKs change.

### Provisional data inventory

This is a discovery list, not a completed declaration:

| Category | Possible ResortPro use | Confirm before release |
| --- | --- | --- |
| Account data | Staff name, email, phone, user ID, tenant ID, role | Required fields, retention, deletion |
| Guest data | Guest contact and stay details | Mobile screens, cache, sharing, retention |
| Financial data | Payment status and transaction references | Exact fields; do not collect full card data unless required |
| Photos/documents | QR, ID/NID, room or maintenance images | Whether collected, uploaded, retained, or processed locally |
| Diagnostics | Crash logs, performance traces | Provider, identifiers, opt-out, retention |
| Device identifiers | Push token or installation identifier | SDK behavior and declared purpose |
| Location | No planned MVP use | Ensure Bluetooth configuration does not imply location collection |

## 5. Account and data deletion

If the released app permits account creation or manages user accounts, verify the
current account-deletion policy and provide every required deletion path.

### Product decisions required

- Define whether a staff user deletes only their profile or requests deletion of
  the entire tenant and its operational records.
- Prevent staff without authority from deleting a resort account.
- Explain legal/financial retention exceptions and what is anonymized.
- Re-authenticate before destructive account actions.
- Provide confirmation, request status, cancellation/grace behavior, and support
  escalation.

### Evidence checklist

- [ ] In-app deletion entry point implemented and tested.
- [ ] Public web deletion request works without installing the app.
- [ ] Store listing links to the required deletion URL.
- [ ] Backend request is authenticated, authorized, rate-limited, and audited.
- [ ] `anonymizeTenant` or a user-level equivalent matches the product decision.
- [ ] Cached Android data and persisted credentials are cleared appropriately.
- [ ] Test evidence covers owner, staff, unauthorized user, and repeated request.

Do not point to `https://resortpro.site/privacy#account-deletion` until that anchor
and its actual request flow exist and are verified in production.

## 6. Permissions and sensitive capabilities

Request a permission only at the moment its related feature is invoked. Explain the
benefit before the system prompt when the user may not understand the context, and
keep the rest of the app usable when permission is denied.

| Capability | MVP status | Implementation rule |
| --- | --- | --- |
| Camera | Deferred | Request only when the user starts scanning; define document handling first. |
| Notifications | Deferred | Request only after an in-app explanation and user action. |
| Bluetooth scan/connect | Deferred | Declare only if the supported printer workflow ships; validate version-specific behavior. |
| Location | Not planned | Do not request unless a separately approved feature requires it. |
| Photos/media | Not planned | Prefer system pickers and least-privilege access if later required. |

Illustrative manifest entries are intentionally omitted until the feature and
supported Android versions are decided. Copying a stale permission block can add
unnecessary declarations and trigger avoidable review questions.

## 7. Payments and subscriptions

The intended app use includes physical hospitality services such as room stays and
food orders. Owner-facing ResortPro subscription upgrades are digital software
services and require a separate policy decision.

- [ ] Verify current Play payment rules with the final user flows and distribution
  countries.
- [ ] Document which flows sell physical services and which sell ResortPro access.
- [ ] Keep owner subscription purchase UI out of the Android MVP unless the approved
  billing approach is implemented.
- [ ] If redirecting to a web billing portal, verify that the exact wording, link,
  and flow are allowed by the current policy and program terms.
- [ ] Ensure payment SDK collection and sharing are reflected in Data Safety.

Do not claim that a web redirect is automatically compliant without current policy
review.

## 8. App quality, security, and access

- [ ] Release build disables cleartext traffic and debug logging.
- [ ] Access and refresh credentials use the design in `ARCHITECTURE.md`.
- [ ] Secrets and signing keys are absent from the repository and logs.
- [ ] ANR, crash, startup, and rendering performance are measured in testing.
- [ ] Crash/analytics SDK behavior is included in the privacy inventory.
- [ ] App works with large text, TalkBack, and denied permissions.
- [ ] Reviewer can access gated features using documented, safe test credentials.
- [ ] Demo data contains no real guest or payment information.
- [ ] Backend production environment and support contact are ready for review.

Avoid embedding policy thresholds that may become stale. Record observed Android
Vitals and respond to the current thresholds displayed in Play Console.

## 9. Store listing and intellectual property

- [ ] App name, short description, full description, and category approved.
- [ ] 512 × 512 app icon prepared to current asset requirements.
- [ ] Feature graphic prepared to current asset requirements.
- [ ] Required phone/tablet screenshots show the released build and real behavior.
- [ ] Screenshots contain no personal guest or staff data.
- [ ] Claims are supportable and do not misuse third-party trademarks.
- [ ] Support email, website, and privacy URL work publicly.
- [ ] Content rating and target audience questionnaires completed accurately.
- [ ] Ads declaration matches the application and included SDKs.

## 10. Build, signing, and staged release

- [ ] Unique application ID and package ownership confirmed.
- [ ] Version code and version name follow the release process.
- [ ] Upload/signing key ownership, backup, and access are documented.
- [ ] Release App Bundle builds reproducibly in CI.
- [ ] R8-minified release passes smoke and instrumentation tests.
- [ ] Native symbols and mapping files are retained/uploaded where applicable.
- [ ] Internal test completed on representative low-end and current devices.
- [ ] Closed test requirements, if any, are verified and completed.
- [ ] Pre-launch report findings are triaged.
- [ ] Rollout, monitoring, rollback, and support ownership are documented.

## 11. Final release sign-off

Complete this table for every production submission:

| Sign-off | Owner | Status | Evidence link | Date |
| --- | --- | --- | --- | --- |
| Product scope | — | Not started | — | — |
| Privacy/Data Safety | — | Not started | — | — |
| Account deletion | — | Not started | — | — |
| Security | — | Not started | — | — |
| Accessibility | — | Not started | — | — |
| QA/device coverage | — | Not started | — | — |
| Store assets | — | Not started | — | — |
| Release engineering | — | Not started | — | — |

Release approval requires every applicable row to be Verified with evidence. A
document-only checkbox is not release evidence.
