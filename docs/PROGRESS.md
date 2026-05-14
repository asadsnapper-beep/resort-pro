# ResortPro — Master Progress Tracker

> **নতুন session শুরু করার আগে এই file পড়ো।**
> তারপর Current Task-এর link follow করো।

---

## 🔴 Current Task

**T-09 — Admin Panel Theme Management Page**
Branch: `feature/admin-themes`
Task file: [task-09](./tasks/task-09-admin-themes.md)

---

## ✅ Completed

| Task | Branch | Completed |
|------|--------|-----------|
| Project foundation (monorepo, API, web setup) | main | ✅ |
| Auth system (register, login, JWT, refresh, reset, invite) | main | ✅ |
| Resort owner dashboard (rooms, bookings, guests, staff, housekeeping, restaurant, inventory, support, website, notifications) | main | ✅ |
| Public resort website — LuxeTemplate (basic) | main | ✅ |
| Stripe payment integration (subscription billing + guest payment links + webhooks) | main | ✅ |
| Super admin dashboard (login, stats, tenants, users, billing, impersonation, export) | main | ✅ |
| Business control system (trial enforcement, upgrade wall, suspended page, trial emails, win-back) | main | ✅ |
| Admin platform settings (plan editor, trial duration, dynamic config) | main | ✅ |
| Documentation (docs/plan/, docs/workflow/) | main | ✅ |

---

## 📋 Backlog (Priority Order)

### 🟡 High Priority

| # | Task | Plan | Task File |
|---|------|------|-----------|
| T-01 | Availability Calendar — API endpoint | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-01](./tasks/task-01-availability-calendar-api.md) |
| T-02 | Availability Calendar — Frontend widget | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-02](./tasks/task-02-availability-calendar-widget.md) |
| T-03 | Theme system — registry + types refactor | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-03](./tasks/task-03-theme-system-foundation.md) |
| T-04 | Theme system — extract widgets (BookingForm, MenuWidget, ContactForm) | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-04](./tasks/task-04-extract-widgets.md) |
| T-05 | LuxeTemplate refactor → themes/luxe/ structure | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-05](./tasks/task-05-luxe-theme-refactor.md) |

### 🟠 Medium Priority

| # | Task | Plan | Task File |
|---|------|------|-----------|
| T-06 | Minimal theme build | [WF-02](./workflow/wf-02-theme-development.md) | [task-06](./tasks/task-06-minimal-theme.md) |
| T-07 | Coastal theme build | [WF-02](./workflow/wf-02-theme-development.md) | [task-07](./tasks/task-07-coastal-theme.md) |
| T-08 | Owner dashboard — theme picker UI | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-08](./tasks/task-08-theme-picker.md) |
| T-09 | Admin panel — theme management page | [Part 04B](./plan/part-04b-public-website-advanced.md) | [task-09](./tasks/task-09-admin-themes.md) |

### 🔵 Low Priority / Future

| # | Task | Notes |
|---|------|-------|
| T-10 | Mobile app (Expo) | পুরো নতুন app |
| T-11 | Analytics dashboard (owner) | Charts, revenue trends |
| T-12 | Multi-language support | i18n |
| T-13 | Custom domain per resort | DNS setup |

---

## 📌 How to Start Next Task

1. Backlog থেকে সবচেয়ে উপরের task নাও
2. Task file খোলো (link above)
3. Branch তৈরি করো (task file-এ branch name আছে)
4. কাজ শুরু করো — task file-এর steps follow করো
5. এই file-এ "Current Task" section update করো

---

## 📝 Session Log

| Date | Task | কী হয়েছে |
|------|------|----------|
| 2026-05-14 | Setup + Auth + Dashboard + Stripe + Admin + Business Control + Docs | Initial build complete |
| 2026-05-14 | Task files T-01 to T-09 | docs/tasks/ folder-এ সব task files তৈরি। T-01 to T-09 ready for implementation. |
| 2026-05-14 | T-01 | Availability Calendar API endpoint সম্পূর্ণ। GET /site/:slug/availability/calendar implemented + tested. |
| 2026-05-14 | T-02 | AvailabilityCalendar widget তৈরি + LuxeTemplate-এ inject। Calendar → Booking pre-fill কাজ করছে। main-এ merge। |
| 2026-05-14 | T-03 | Theme system foundation। types.ts, registry.ts, luxe/index.tsx, page.tsx update, Theme DB model + seed। |
| 2026-05-14 | T-04 | BookingForm, MenuWidget, ContactForm extracted। LuxeTemplate 756 lines reduced। Widget-based architecture। |
| 2026-05-14 | T-05 | LuxeTemplate refactored → themes/luxe/ (sections/ + components/ + utils.tsx + config.ts). LuxeTheme fully assembled. feature/theme-system → main merged। |
| 2026-05-14 | T-06 | Minimal Clean theme built। 7 sections, horizontal room cards, blue-600 palette, registered in THEME_REGISTRY। main-এ merge। |
| 2026-05-14 | T-07 | Coastal Breeze theme built। 10 sections, wave SVG dividers, AmenitiesSection, split booking panel, dark cyan footer। main-এ merge। |
| 2026-05-14 | T-08 | Theme picker UI। GET /site/:slug/themes API + ThemePicker component (DB-driven, fallback list, color hints, active ring)। website/page.tsx updated। |
