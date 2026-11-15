# ResortPro — two-agent development plan

**Written for the agent that will build the Android app.** It assumes you have
not read this repository before.

This is not another UI plan. [`UI_UX_PLAN.md`](UI_UX_PLAN.md) already describes
every screen, its current state and the nine-step priority order, and
[`ARCHITECTURE.md`](ARCHITECTURE.md) holds the technical decisions. Read both
before you start. What is missing — and what this document adds — is how two
agents share one repository without ruining each other's work, and the standard
the code is held to.

---

## 1. Who does what

| | Owns |
|---|---|
| **Agent A** (Codex, reads `AGENTS.md`) | Planning, test design, and the **Android app** — `apps/android/**`, `docs/android/**` |
| **Agent B** (Claude Code, reads `CLAUDE.md`) | Backend and web development — `apps/api/**`, `apps/web/**`, `packages/**` |
| **The owner** | Product decisions, approvals, every push and merge |

The split is by **directory**, not by task, because that is the only line a
tool can check.

### Crossing the line

The Android app needs backend endpoints, and some of them do not exist yet.
Agent A does **not** write them. Instead, open an issue — or leave a note in
your PR — naming:

- the screen that needs it and why the existing API is not enough
- the exact data the screen needs, and the data it must **not** receive
- which roles may call it

Agent B builds it and says when it has merged. This is slower than writing it
yourself and it is the right trade: the API has tenant-isolation rules that are
enforced in CI and are not obvious from the outside. See §4.

A one-line exception: if a change is **only** registering your route in
`apps/api/src/app.ts`, do it and say so in the PR.

---

## 2. Sharing one repository

Four rules. Each exists because it was broken once and cost real time.

### 2.1 Work in your own branch, never in the main checkout

```bash
git fetch origin
git switch -c android/<short-description> origin/dev
```

Prefix your branches `android/`. Agent B uses `fix/`, `feat/`, `docs/`,
`chore/`. When the owner lists branches, the prefix says who to ask.

**Never commit on `dev` or `main`.** A hook refuses it. That working tree is
shared between every session, so files left in it are invisible to everyone —
which is how 183 files sat unnoticed for two weeks in October 2026.

### 2.2 Branch from `origin/dev`, not from `HEAD`

The main checkout can be months behind. The October work was written against a
base 69 days old; `dev` had moved **288 commits** and one screen had grown from
347 lines to 698 underneath it, so most of that work had to be discarded rather
than reviewed. **Nothing was wrong with the code. The base was wrong.**

Check before you start:

```bash
git log --oneline -1 origin/dev
```

### 2.3 Commit everything before you stop, and say what you pushed

Finished or not. An unfinished branch is ordinary; an uncommitted working tree
is work waiting for a disk failure. `git status --porcelain` must be empty when
you stop, and if you deliberately leave something untracked, name it.

"Committed on `android/x`, not pushed" is a complete answer. Silence is what
turns a branch into an archaeology problem.

### 2.4 One concern per pull request

Base on `dev`. Keep it to one thing. A PR that touches `apps/android` and
`apps/api/src/routes` is two PRs unless the API part is the one-line
registration above.

If you are about to write more than ~400 lines, stop and split it. The owner
reviews these, and a 500-line PR gets less attention than two 250-line ones,
not more.

### 2.5 Install the hooks, once

```bash
scripts/setup-hooks.sh
```

Git does not share `.git/hooks`, so a fresh clone has none. The hooks refuse a
commit on `dev`/`main`, a staged credential, generated files, and anything over
512 KB. Each refusal prints the environment variable that overrides it. They
cannot catch work you never commit — nothing runs when git does not run.

**Not on `dev` yet.** The hooks and that script are on branch
`chore/git-hooks`, unmerged at the time of writing. If `scripts/setup-hooks.sh`
is absent, rule 2.1 still applies — it is simply not enforced yet, so follow it
by hand.

---

## 3. The standard

This is the part that matters most, and the part a task list cannot carry.
Nine habits. They are not style preferences; each one caught a real defect in
this repository.

### 3.1 Measure, do not remember

Before you describe the state of anything, run the command that proves it. In
one session: a plan said a bug existed, the code showed it was *worse* than the
plan said; a file looked like unique work and turned out to be a stale copy
that would have reverted a newer version; `git cherry` reported merged commits
as missing and nearly caused real work to be deleted.

If you write a number — a line count, a test count, a commit count — you ran
something that printed it.

### 3.2 Break your own fix, and watch the test fail

A test that passes proves nothing until you have seen it fail for the right
reason. After every fix:

1. Revert the fix, keep the test.
2. Run it. Confirm it fails, and read the failure message.
3. Restore the fix.

Report which cases failed and how many. In one session this turned up a test
named "sends the invoice once" that was proving *once* on a code path where
*zero* were sent — it passed for the wrong reason for weeks.

### 3.3 A passing test can be testing nothing

Read what a mock returns. Three test files mocked an email sender as
`{ ok: true }` when the real function can only ever return `{ id, error }`.
Every one of them passed, and none of them could have caught the bug they
existed for.

### 3.4 Read the existing code's intent before you change it

Two pieces of code in this repository look like bugs and are deliberate
trade-offs, each with a comment saying so. Changing either without reading the
comment would have broken something on purpose-built behaviour.

When you find code that looks wrong, look for the comment first. If there is
none and you still think it is wrong, say what you think it was for.

### 3.5 "Different" is not "newer", and not "better"

When your copy of a file differs from `dev`'s, that does not make yours the
improvement. Check which is newer and what each contains. The October pile
contained a planning document whose local copy was *older* — committing it
would have silently reverted a status update.

### 3.6 When CI fails, prove whose fault it is before saying anything

Do not say "that is a flake". Show it: name the failing test, name the cause,
and show that your change cannot reach it. A documentation-only PR — three
markdown files, zero lines of code — failed the API integration suite in this
repository. That is a proof, not an opinion. Then re-run, and if it passes with
no code change, say that too.

### 3.7 Say what you did not do

Scope you dropped, a case you did not test, a device you did not try, a claim
you could not verify. Write it in the PR under its own heading. "Photo upload
not verified end-to-end against a deployed backend" is useful. Omitting it is
not a tidier PR; it is a PR that lies by omission.

Never claim a screen works on a device you did not run it on.

### 3.8 Small steps, verified, then the next one

Do not take on a nine-screen plan in one branch. One screen, or one flow,
verified, merged. The owner has said this repeatedly and it is the single most
reliable predictor of whether work lands.

### 3.9 Explain why in the code, not just what

This repository's comments say what went wrong and why the code is shaped the
way it is — they read like short incident notes, not labels. Match that. A
comment saying `// set the date` is noise; a comment saying which timezone bug
made the date explicit is what stops the next person reintroducing it.

---

## 4. The backend rules you must not break

These are enforced by CI and will fail your PR.

- **Every authenticated query goes through `request.db`**, never bare `prisma`.
  `request.db` is `tenantPrisma(tenantId)`, which injects the tenant filter
  into every read and write. Bare `prisma` in a tenant route is a cross-tenant
  leak, and `Tenant Isolation Guard` checks for it.
- **A new Prisma enum value or column needs a migration file** in the same
  commit. `Schema Drift Check` compares `schema.prisma` against the migrations
  and fails on a gap.
- **Role gates come from `ROOM_CAPABILITIES`-style tables in
  `packages/types`**, not inline role lists, so the API and the screens cannot
  drift apart.
- **No raw hex colours or arbitrary sizes in `apps/web`** — that is Agent B's
  area, but `Design system ratchet` fails the whole build, including your PR,
  if a count rises.
- **This repository is public.** No server addresses, tailnet names, owner
  e-mail addresses, keys or tokens in any file, commit message or PR
  description — including in planning documents and comments.

---

## 5. Start here: recover the parked work

Before building anything new, there is finished work to rescue.

Branch `park/agent-work-2026-10-30` holds 183 files left uncommitted in October.
Its commit message says exactly which files are genuinely missing from `dev`,
which are byte-identical to it, and which are duplicates. Read that message
first.

**These exist there and not on `dev`** (verified file by file):

| What | Files |
|---|---|
| Restricted mobile guest/booking API | `apps/api/src/routes/mobileGuestViews.ts`, `tests/unit/mobile-guest-views.test.ts`, `tests/integration/mobile-guest-privacy-isolated.test.ts` |
| Guest search and booking details | `feature/guests/*`, `ui/GuestsScreen.kt`, `ui/BookingDetailsScreen.kt` + their tests |
| Other screens | `ui/AnalyticsScreen.kt`, `ui/RoomDetailsScreen.kt`, `ui/RoomImage.kt`, `feature/rooms/RoomDetailsViewModel.kt` |
| Document handling | changes to `routes/guestDocuments.ts` and its tests |

### The order to take them in

1. **The mobile API first.** 74 lines, `request.db` throughout with zero bare
   `prisma`, gated to OWNER/MANAGER/RECEPTIONIST, and it comes with two tests.
   Nothing on `dev` conflicts with it. It is Agent B's directory, so Agent B
   ports it — but it unblocks two Android screens, so ask for it first.
2. **Guest search and booking details**, which depend on it.
3. **Analytics and room details screens**, independently.

**Do not port the walk-in and photo work wholesale.** `dev` has eight newer
Android commits covering document capture, multiple documents, gallery
selection and retry handling. The parked version predates all of them and would
replace newer files with older ones. Compare, take what is missing, leave the
rest.

Each of these is its own PR.

---

## 6. Then follow the existing priority list

[`UI_UX_PLAN.md` §8](UI_UX_PLAN.md) has the nine-step order and the exit
condition for each step. Work it top to bottom. Do not reorder it without
asking — step 1 is photo privacy, and it is first because unverified ID storage
is a legal problem, not a polish problem.

Its §5 table gives, per screen, what exists and what is left. Treat
"প্রাথমিক" (initial) as "code exists, nothing is verified".

### What blocks you

`UI_UX_PLAN.md` §9 lists seven product decisions that are **not yours to
make** — whether ID photos are mandatory, how long images are kept, what a
Manager may see financially, and so on. If a step needs one of those answers,
stop and ask the owner. Do not pick a default and build on it.

---

## 7. What "done" means for a step

A step is finished when all of these are true, and you have said so explicitly:

- The data contract is confirmed against the real API response, not assumed
  from a type.
- Automated tests exist and you have watched them fail without the change
  (§3.2).
- It has been run on a real device, and you say which device and Android
  version. If you have not run it on a device, the step is not finished — say
  that rather than implying it.
- Light mode, dark mode and large text all checked.
- Bengali and English both present. Bengali is never unconditional: gate every
  string on the locale, because English is the default for everyone outside
  Bangladesh.
- Offline and failure states behave: loading, retry, no results, access denied,
  stale cache, pending sync.
- The PR names what you did **not** verify.

---

## 8. Related documents

- [UI and UX plan](UI_UX_PLAN.md) — screens, flows, nine-step priority
- [Architecture and roadmap](ARCHITECTURE.md) — technical decisions, offline
  strategy
- [Engineering guide](BEST_PRACTICES.md)
- [Play release and privacy checklist](PLAY_STORE_COMPLIANCE.md)
- [Earlier code review](CODE_REVIEW_2026-08-29.md)
- [`AGENTS.md`](../../AGENTS.md) — the git rules in short form
