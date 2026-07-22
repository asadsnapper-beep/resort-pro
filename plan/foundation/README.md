# ResortPro — Project Plan Index

এই folder-এ ResortPro project-এর সব part document করা আছে।

---

## Parts

| File | Part | Description |
|------|------|-------------|
| [part-01-project-foundation.md](./part-01-project-foundation.md) | Part 01 | Tech stack, monorepo structure, architecture |
| [part-02-auth-and-onboarding.md](./part-02-auth-and-onboarding.md) | Part 02 | Registration, login, JWT, refresh tokens, staff invite |
| [part-03-resort-owner-dashboard.md](./part-03-resort-owner-dashboard.md) | Part 03 | সব dashboard modules (rooms, bookings, guests, staff, etc.) |
| [part-04-public-website.md](./part-04-public-website.md) | Part 04 | Resort-এর public website + guest booking |
| [part-04b-public-website-advanced.md](./part-04b-public-website-advanced.md) | Part 04B | Availability calendar, theme system, dynamic widgets — advanced plan |
| [part-05-stripe-payment-integration.md](./part-05-stripe-payment-integration.md) | Part 05 | SaaS subscription billing + guest payment links |
| [part-06-super-admin-dashboard.md](./part-06-super-admin-dashboard.md) | Part 06 | Admin panel, tenant control, impersonation, data export |
| [part-07-business-control-system.md](./part-07-business-control-system.md) | Part 07 | Trial enforcement, upgrade wall, suspended page, win-back emails |
| [part-08-email-and-automation.md](./part-08-email-and-automation.md) | Part 08 | Email service, automation engine, drip campaigns |
| [part-09-database-schema.md](./part-09-database-schema.md) | Part 09 | সব Prisma models + enums |
| [part-10-deployment-and-infrastructure.md](./part-10-deployment-and-infrastructure.md) | Part 10 | Docker, Coolify, env vars, local setup |

---

## Quick Reference

### Local URLs
- **Web:** http://localhost:3000
- **API:** http://localhost:4000
- **API Docs (Swagger):** http://localhost:4000/docs
- **Admin Panel:** http://localhost:3000/admin/login

### Key Concepts
- **Tenant** = একটি resort (SaaS customer)
- **planStatus** = trialing / active / past_due / canceled
- **Super Admin** = আমি (ResortPro owner) — `SUPER_ADMIN_EMAILS` env var
- **Impersonation** = Admin tenant-এর account-এ login করতে পারেন (2h session)
- **Trial** = Registration-এ auto-start, duration Platform Settings থেকে configurable

### Business Logic Summary
```
New signup → 14-day trial (configurable) → Warning emails at 7/3/1 days
Trial expired → Upgrade wall → Stripe checkout
Paid → Full access
Payment failed → past_due → Upgrade wall
Admin suspend → Suspended page
Win-back emails: day 3, 7, 30 after expiry
Data preserved indefinitely (90-day deletion policy communicated)
```
