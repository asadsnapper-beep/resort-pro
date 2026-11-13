# ResortPro — WebCoronet Case Study Package

> **Evidence note (prepared 8 October 2026):** This document is based on the
> ResortPro repository, its Git history, architecture/configuration files, and
> documented product decisions. It deliberately does **not** claim commercial
> outcomes, customer numbers, client names, launch metrics, or live-service
> status that were not independently confirmed.

---

## 1. Project Identity

| Field | Confirmed information |
|---|---|
| **Project name** | ResortPro |
| **Suggested portfolio title** | ResortPro — A Multi-Tenant Operating Platform for Independent Resorts |
| **Suggested URL slug** | `resortpro-resort-management-platform` |
| **Project type** | Multi-tenant B2B SaaS product |
| **Industry** | Hospitality technology / property operations |
| **Client type** | Resort owners and operators; named client **not confirmed** |
| **Country / market** | Bangladesh-first: BDT, Bangladesh payment options, Bengali product work and `Asia/Dhaka` defaults are present. The architecture also models multi-country payment options. |
| **Project status** | Active product codebase with production and staging deployment configuration. Current public availability **not verified** for this document. |
| **Website / product URL** | Production configuration references `https://resortpro.site`; product dashboard URL **not independently verified** at publication time. |
| **Development period** | Git history begins **22 April 2026**. The latest inspected commit is dated **5 September 2026**. Work after that date: **not confirmed** from this evidence pass. |

**One-sentence description:** ResortPro is a multi-tenant resort-management platform that brings reservations, front-desk workflows, property operations, guest management, direct booking, payments, and reporting into one product.

---

## 2. Executive Summary

ResortPro is a custom SaaS platform designed for independent resort operators who need to manage daily hospitality operations without stitching together separate tools for bookings, rooms, guests, staff, food service, websites, and payments. The product combines a web dashboard, a public direct-booking experience, an embeddable booking layer, a native Android client, and a desktop companion. Its architecture is tenant-aware from the database through to authenticated API access, allowing multiple properties to operate within a shared platform while keeping business data separated. The project is notable for treating hospitality as a connected operational workflow: a booking affects room status, front desk activity, guest records, housekeeping, communications, payments, and management reporting. Rather than presenting a generic dashboard, it models the day-to-day work of a resort team.

---

## 3. The Business Problem

### Confirmed product problems addressed

- Small resort operations need bookings, rooms, guests, food orders, staff work, maintenance, payments, and a public website to work together rather than as isolated records.
- A staff member needs fast operational views for arrivals, departures, walk-ins, room readiness, housekeeping, and guest history.
- Resorts need a direct booking channel alongside property-specific public websites and embeddable booking components.
- Hospitality teams need role-specific access rather than giving every employee full business and billing access.
- Multi-property SaaS needs strong tenant separation so one resort cannot access another resort's operational data.
- Bangladesh-focused operators need local payment paths in addition to card payments and manual settlement.

### Reasonable interpretation, not a verified pre-project fact

The product appears intended to reduce reliance on disconnected spreadsheets, manual guest records, phone/WhatsApp-only booking handling, and separate operational tools. The exact previous workflow of a named resort is **not confirmed** and should not be published as fact without project-owner input.

---

## 4. Project Goals

Goals supported by the product and repository include:

1. Centralise core resort operations in one tenant-aware platform.
2. Support a guest journey from availability and direct booking through check-in, stay operations, payment, and post-stay communication.
3. Give owners, managers, reception, hospitality staff, kitchen staff, marketers, and shareholders role-appropriate views.
4. Give each resort a branded public presence with direct booking capability.
5. Support local and international payment gateway options through a gateway registry.
6. Create a foundation for growth across properties, custom domains, branded themes, mobile use, and embedded booking surfaces.
7. Improve operational visibility through dashboards, daily reporting, notifications, and task-oriented modules.

---

## 5. What We Built

### Guest and booking experience

- Public resort pages with configurable website content and branded themes.
- Room discovery, availability, booking, offers, packages, and payment flows.
- An embeddable widget SDK for booking, rooms, availability calendar, menu, and call-to-action widgets.
- A WordPress plugin with blocks and shortcodes for embedding ResortPro widgets.
- Guest-facing booking records, communication templates, support/ticket capability, and loyalty data structures.

### Front desk and property operations

- Booking lifecycle management, calendar views, walk-in handling, guest lookup, room assignment, check-in and checkout workflows.
- Rooms, room types, properties, rate plans, packages, offers, group bookings, and external calendar synchronisation.
- Housekeeping tasks, room status, lost and found, minibar consumption, laundry, maintenance tickets, and asset maintenance.
- Restaurant menu, tables, food orders, inventory, vendors, purchase orders, and operational assets.
- Venue booking, vehicle rental, and corporate-account modules.

### Management, revenue and communication

- Owner/manager dashboard, reports, expenses, invoices, payments, and billing controls.
- Guest CRM, tags, scores, activity, consent, loyalty, campaigns, templates, and automated communication sequences.
- Notifications, support tickets, chat, daily report dispatch, pre-arrival reminders, trial lifecycle messaging, and public booking-hold expiry jobs.
- Platform administration for tenants, plans, themes, design requests, audit records, and product settings.

### Product surfaces

- Next.js web application for public pages, dashboard, administration, onboarding, and documentation.
- Fastify REST API with Swagger/OpenAPI support outside production.
- Native Android application using Kotlin and Jetpack Compose.
- Electron desktop application package for desktop distribution.
- Standalone embeddable JavaScript SDK and WordPress integration.

---

## 6. Key Features

| Feature | What it does | Why it matters to the business |
|---|---|---|
| **Reservation and front-desk workflows** | Manages reservations, walk-ins, arrivals, departures, room assignment, check-in, and checkout. | Gives staff one operational flow for the most time-sensitive work of the day. |
| **Tenant-aware resort operations** | Associates operational data with a resort tenant and scopes authenticated database access to that tenant. | Supports a SaaS model without mixing one property's data with another's. |
| **Direct booking and branded websites** | Lets properties publish a public presence and connect room availability, booking and payment to it. | Creates an owned booking channel rather than relying only on third parties. |
| **Room readiness and housekeeping** | Tracks room status alongside cleaning tasks and related operational work. | Helps front desk avoid assigning a room before it is ready. |
| **Guest CRM and loyalty foundation** | Stores guest profiles, documents, history, tags, activity, consent, scores, and loyalty records. | Helps operators recognise returning guests and support more personal service. |
| **Restaurant, inventory and purchasing** | Supports menus, orders, tables, inventory movements, vendors, and purchase orders. | Brings a major resort revenue operation into the same system as stays. |
| **Flexible payments and billing** | Provides payment, invoice, subscription-billing, and gateway integrations including Bangladesh-focused options. | Lets the product serve local payment habits as well as card-based flows. |
| **Role-based workspaces** | Defines Owner, Manager, Shareholder, Receptionist, Marketer, Developer, Staff, Chef, and Guest roles. | Reduces unnecessary access while matching screens to real responsibilities. |
| **Automated operational communication** | Runs background jobs for reminders, daily reports, booking expiry, calendar sync, automation sequences, and trial lifecycle messaging. | Reduces repeated manual follow-up work. |
| **Embedded and mobile access** | Includes a booking widget SDK, WordPress integration, native Android client, and desktop app package. | Lets operators use the product in the channels where their business already works. |

> **Important scope note:** Restaurant order handling is implemented. A separate plan documents stronger room-charge reconciliation as future P1 work; do not claim that every restaurant order is already included in a final stay bill.

---

## 7. User Types

| User type | What they can do |
|---|---|
| **Resort owner** | Oversees the property, business settings, operations, reporting, billing-related controls, and users. |
| **Manager** | Manages property operations and team workflows without needing every owner-level control. |
| **Receptionist** | Works with bookings, rooms, guests, calendar, housekeeping, support, arrivals, departures, and walk-ins. |
| **Staff** | Uses operational modules such as housekeeping, maintenance, restaurant and orders according to assignment. |
| **Chef** | Has a focused food-order workflow for viewing and updating kitchen order status. |
| **Marketer** | Works with analytics, website content, guest CRM, campaigns, and email-related workflows. |
| **Developer** | Has product configuration responsibilities for website/embed/channel-sync areas. |
| **Shareholder** | Has read-only access to selected dashboard, analytics, and reporting information. |
| **Guest / public visitor** | Searches rooms, makes a booking, pays where enabled, uses public resort pages, and may interact through guest communication/support flows. |
| **Platform administrator** | Manages ResortPro platform-level tenants, themes, plans, requests, settings, and audits. |

---

## 8. User Journey / Workflow

### 1. Direct booking journey

Public visitor → resort website or embedded widget → room/availability selection → booking details → supported payment method or pay-at-resort → confirmation/communication → booking appears in the property's operations workspace.

### 2. Front-desk stay journey

Receptionist → view arrivals or search guest → create/locate booking, including walk-in flow → assign available room → check in → room moves through operational status → checkout and payment/invoice-related workflow → guest history remains in CRM.

### 3. Room-readiness workflow

Checkout or scheduled task → room requires operational attention → housekeeping task is assigned and progressed → room status is updated → front desk can see whether it is ready for the next guest.

### 4. Food and supply workflow

Staff/Chef → menu or table order → order status updates → inventory and purchasing tools support stock operations → management can view restaurant activity alongside wider resort operations.

### 5. Owner oversight workflow

Owner/Manager → dashboard and reports → review bookings, occupancy, arrivals/departures, payments, operations and alerts → send or schedule daily reporting/communications where configured.

---

## 9. Technical Architecture

| Area | Confirmed implementation |
|---|---|
| **Frontend** | Next.js 14 application using React 18, TypeScript, Tailwind CSS, React Query, Zustand, React Hook Form, Zod, Radix primitives, Recharts, and Leaflet. |
| **Backend** | TypeScript Fastify REST API with route modules for product domains, JWT authentication, role middleware, validation, WebSocket support, Swagger/OpenAPI generation, multipart upload support, and health endpoint. |
| **Database** | PostgreSQL via Prisma. The schema models tenants, users, properties, rooms, guests, bookings, payments, invoices, staff, operational tasks, CRM, marketing, and platform administration. |
| **Multi-tenancy** | Shared database architecture with `tenantId`-scoped records. Auth middleware supplies a tenant-scoped Prisma client; the abstraction has a fail-closed check for a missing tenant ID. |
| **Cache / job infrastructure** | Redis is included in local and production Compose configurations. BullMQ and ioredis are dependencies. The verified scheduled job mechanism is a separate Node worker using cron scheduling. Active BullMQ production use: **not confirmed**. |
| **Background processing** | A worker process schedules pre-arrival reminders, iCal sync, daily-report dispatch, automation sequences, trial emails, and expiry of abandoned booking holds. |
| **Mobile** | Native Android module: Kotlin, Jetpack Compose, Navigation Compose, Room, WorkManager, Retrofit/OkHttp, Kotlin serialisation, and biometric library. |
| **Desktop** | Electron desktop package with SQLite dependency and desktop build targets for Windows and macOS. Current distribution/adoption status: **not confirmed**. |
| **Embeds** | Vite-built embeddable widget SDK plus a WordPress plugin with blocks and shortcodes. |
| **Deployment** | Dockerised API, web, PostgreSQL, Redis, background worker and backup service. GitHub Actions builds GHCR images and has staging/production deployment workflows. Staging uses Portainer; production configuration references Coolify. |
| **Backups** | Production Compose includes a daily `pg_dump` job with `pg_restore --list` verification and retention configuration. Off-host backup replication is explicitly documented as a follow-up, not a confirmed capability. |
| **Testing** | Vitest unit/integration suites, Playwright E2E suites, CI schema-drift check, tenant-isolation guard, and role/permission test workflows. |
| **Monitoring / analytics** | API logs through Fastify/Pino configuration; Microsoft Clarity script is conditionally configured for marketing paths. Alerting/error-tracking service: **not confirmed**. |

---

## 10. Technology Stack

### Core technologies

- TypeScript
- Next.js 14 and React 18
- Fastify
- PostgreSQL and Prisma ORM
- Kotlin and Jetpack Compose for Android
- Electron for desktop packaging
- Vite for the embed SDK

### Infrastructure and delivery

- Docker and Docker Compose
- Redis
- GitHub Actions
- GitHub Container Registry (GHCR)
- Portainer staging deployment configuration
- Coolify production deployment configuration
- PostgreSQL backup job

### Confirmed integrations and services

- Stripe
- bKash
- SSLCommerz
- Resend transactional email service
- Telegram Bot API
- Meta WhatsApp Cloud API integration paths
- iCal external calendar URLs
- Microsoft Clarity (conditional marketing analytics)
- Anthropic SDK for optional AI content-generation features

### Development tools and quality controls

- pnpm workspaces and Turborepo
- Prisma migrations
- Vitest
- Playwright
- TypeScript strict type checking
- Zod request validation
- Swagger/OpenAPI generation

### AI-assisted development tools

AI-assisted development was used during product work for architecture exploration, code assistance, debugging, documentation, UI iteration, test review, and planning. The specific model/tool mix, usage volume, and exact contribution breakdown are **not confirmed for publication**. AI should be presented as an internal engineering capability, not as the product's core value proposition.

---

## 11. AI-Assisted Development

Where used, AI accelerated internal development work such as reviewing complex workflows, preparing implementation plans, generating test cases, exploring code relationships, and iterating product copy and interface direction. The customer-facing value remains the implemented product: clearer operational workflows, connected data, stronger quality controls, and maintainable product architecture.

**Publication-safe wording:** “AI-assisted engineering workflows supported research, implementation, QA planning, and documentation. Product decisions and final implementation were reviewed against the actual system requirements.”

---

## 12. Important Product and Engineering Decisions

### Tenant-scoped data access

- **Decision:** Use a shared PostgreSQL database with tenant IDs and a tenant-scoped Prisma access layer.
- **Why:** A SaaS platform must isolate each resort's operational and guest data.
- **Alternative considered:** Separate database per property is not documented.
- **Benefit:** A central deployment model with an explicit isolation guard and CI checks focused on tenant scoping.

### Connected operational modules rather than isolated screens

- **Decision:** Model bookings, rooms, guests, housekeeping, maintenance, restaurant, inventory, payments, and reports as related domains.
- **Why:** A resort's daily work crosses departments.
- **Alternative considered:** Separate point solutions or a booking-only product; not documented.
- **Benefit:** A booking can inform front desk, room readiness, guest history, and management visibility.

### Direct booking beyond a single website

- **Decision:** Build public resort sites, a widget SDK, and a WordPress integration.
- **Why:** Resorts may need booking capability on their own web presence rather than only in a central application.
- **Benefit:** Multiple distribution surfaces can connect to the same product data.

### Bangladesh-first, gateway-registry payment architecture

- **Decision:** Support bKash, SSLCommerz, manual payment and Stripe through a gateway registry, with further country options represented in the registry.
- **Why:** Local payment methods matter for Bangladesh-focused resort businesses while international cards remain relevant.
- **Benefit:** Payment choices are not hard-wired into one provider.

### Separate background worker

- **Decision:** Run scheduled operations in a dedicated worker instead of the HTTP API process.
- **Why:** Reminders, calendar sync, report dispatch, lifecycle messaging, and expiry tasks should not depend on page requests.
- **Benefit:** Background work has an explicit deployment process and single-replica scheduling expectation.

### Delivery pipeline that pins deploys to commit SHA tags

- **Decision:** Deployment workflows stamp images with a commit SHA before staging/production deployment.
- **Why:** Floating image tags can allow a deploy job to report success while a platform continues serving an older image.
- **Benefit:** The configuration documents a reproducible safeguard against stale-image deployment.

---

## 13. Challenges

### Multi-tenant safety

- **Why difficult:** Every operational domain can expose sensitive guest and business data. One unscoped query can cross tenant boundaries.
- **Solution:** Tenant-scoped Prisma access, authentication middleware, a fail-closed missing-tenant guard, integration testing, and CI checks for query coverage.
- **Result:** A concrete isolation strategy is implemented. No external security audit result is claimed.

### Hospitality billing consistency

- **Why difficult:** A stay can accumulate room, food, packages, extras, and payments at different moments.
- **Solution:** The repository contains a billing-contract plan and a P0 checkout-billing completeness plan that define a single authoritative calculation and immutable final invoice direction.
- **Result:** The problem has been identified and planned. Full implementation of that P0 contract is **not confirmed** and should not be presented as complete.

### Reliable deploys across management platforms

- **Why difficult:** Container platforms may accept a deployment request without recreating a running service from a changed floating image tag.
- **Solution:** Staging and production workflows stamp SHA tags and verify deployment configuration/health endpoints.
- **Result:** Deployment scripts explicitly address the stale-image failure mode.

### Public versus private uploaded data

- **Why difficult:** Property imagery must be public while ID/passport documents must not be exposed by an open static path.
- **Solution:** Private upload paths require a short-lived signed URL; invalid signatures return a non-revealing response.
- **Result:** The code separates public property assets from protected guest-document access.

---

## 14. Custom Development

The following are custom product work rather than a standard site template:

- Tenant-aware data model and request-scoped database access.
- Resort-specific booking, front-desk, room readiness, and housekeeping workflows.
- Walk-in and returning-guest lookup behaviour.
- Resort public websites connected to live booking/availability data.
- Embeddable booking and availability widgets, plus WordPress blocks/shortcodes.
- Payment gateway registry with Bangladesh-relevant providers and manual payment fallback.
- Resort operations domains: food orders, inventory, laundry, minibar, maintenance, venue booking, vehicle rental, staff attendance and training.
- Super-admin tools for tenants, themes, audit logs, plans, design requests and platform settings.
- Scheduled operational worker for reminders, calendar synchronisation, report dispatch and lifecycle flows.

---

## 15. Automation and Efficiency

| Automation / simplification | Previous process | New process | Business benefit |
|---|---|---|---|
| Pre-arrival reminders | **Not confirmed** | Background worker schedules pre-arrival reminder jobs. | Reduces manual reminder follow-up. |
| Daily report dispatch | **Not confirmed** | Configurable daily report dispatch supports Telegram and WhatsApp paths. | Gives management a recurring operational summary. |
| External calendar sync | **Not confirmed** | Worker periodically synchronises external iCal calendars. | Helps keep availability aligned with connected calendars. |
| Expiry of abandoned booking holds | **Not confirmed** | Worker expires pending public booking holds. | Prevents temporary holds from blocking inventory indefinitely. |
| Guest follow-up / lifecycle messaging | **Not confirmed** | Automation and trial-email services are scheduled in the worker. | Creates a repeatable communication process. |
| Room and task visibility | **Not confirmed** | Booking, room status, housekeeping, maintenance, and staff modules share the product workspace. | Makes operational handoffs easier to track. |

---

## 16. Security and Reliability

### Confirmed controls

- JWT access control with a production fail-fast requirement for `JWT_SECRET`.
- Role-based middleware and role-specific product access.
- Tenant-scoped database layer with a fail-closed guard for missing tenant IDs.
- CI checks intended to catch missing tenant-scoping behaviour.
- Zod validation and a central API error handler for validation errors.
- Fastify Helmet integration, CORS origin controls, and global/request-specific rate limiting.
- Multipart upload file-size limit.
- Signed URLs for private guest documents; invalid/expired requests receive a non-revealing response.
- Stripe webhook-event persistence exists to support webhook handling/deduplication workflows.
- Database migrations and schema-drift checks in CI.
- Container health checks for API/web and a verified daily database-backup job in production Compose.

### Do not claim without more evidence

- SOC 2, ISO 27001, PCI certification, penetration-test results, encryption-at-rest policy, disaster recovery RPO/RTO, uptime SLA, or off-site backups.
- That every route has completed a security review; the CI file explicitly describes tenant-scoping migration as an ongoing process.

---

## 17. Performance and Scalability

### Confirmed foundations

- Shared multi-tenant PostgreSQL design with tenant-oriented access abstraction.
- Redis service in local and production deployment configurations.
- Dedicated worker process for scheduled/background work.
- Dockerised web/API services with health checks and separate runtime concerns.
- GitHub Actions cache configuration for Docker builds.
- Next.js application structure and Vite-built widget SDK.
- API request metrics utility is registered in the Fastify application.

### Not confirmed

- Benchmarked response times, load-test figures, cache-hit rates, concurrent tenant capacity, queue throughput, CDN configuration, or production database tuning results.

**Portfolio-safe phrasing:** “The product is structured for multi-tenant operation, background processing, containerised deployment, and incremental scale. Quantified performance outcomes were not available for this case study.”

---

## 18. UX / UI Thinking

- The product separates public guest experiences, authenticated resort dashboard, platform administration, and role-focused workflows instead of placing all functions in one interface.
- Front-desk functionality centres on time-sensitive activity such as arrivals, departures, walk-ins, rooms, and guest lookup.
- Dashboard navigation groups operational functions such as rooms, bookings, housekeeping, restaurant, reporting, and account controls.
- The codebase includes a documented design-system migration direction: tokens, primitives, and composite page patterns are intended to reduce visual drift across many dashboard pages.
- Current project instructions require portal-based reusable modal handling for new modals, addressing stacking and body-scroll issues in complex dashboard flows.
- Web UI includes light/dark theme support and responsive dashboard layout patterns.
- Accessibility-oriented details visible in code include semantic role controls, modal fixes, error feedback, protected workflows, and Playwright role coverage. A formal accessibility audit result is **not confirmed**.

---

## 19. Integrations

| Integration | Purpose | How it is used |
|---|---|---|
| **Stripe** | Subscription and guest payment flows | API billing routes and payment gateway integration; webhook route is present. |
| **bKash** | Bangladesh payment support | Subscription and/or guest payment integration paths are implemented in API/payment registry. |
| **SSLCommerz** | Bangladesh payment support | Gateway implementation and service layer are present. |
| **Resend** | Transactional email | API email service sends configured messages when a valid Resend key is supplied. |
| **Telegram Bot API** | Report and support-related messaging | Daily-report dispatch and notification code use Telegram Bot API paths. |
| **Meta WhatsApp Cloud API** | Messaging and report dispatch | Tenant/configurable WhatsApp service paths are present. Live provider configuration is tenant-dependent. |
| **External iCal calendars** | Availability synchronisation | External calendar records and scheduled sync are included. |
| **Microsoft Clarity** | Marketing-site analytics | A conditional marketing-path script is configured via environment variable. |
| **Anthropic SDK** | AI content-generation capability | An API content-generation service exists. Actual tenant adoption/use is not confirmed. |
| **WordPress** | Website embedding | Plugin supplies blocks and shortcodes for ResortPro widgets. |

---

## 20. Project Complexity

**Assessment: Complex product.**

This is more than a booking website or a single dashboard. The repository contains 47 dashboard page files and 58 API route modules at the time of review, alongside a shared data model spanning operations, CRM, payments, content, marketing, support, administration, and a number of deployment surfaces. Complexity comes from:

- Multi-tenant data separation.
- Multiple user roles and permission boundaries.
- Connected guest, room, booking, housekeeping, food, inventory, payment and reporting workflows.
- Public web, dashboard, Android, desktop, widget SDK and WordPress surfaces.
- Local and international payment integration architecture.
- Background jobs and communication integrations.
- Separate staging and production deployment paths.

---

## 21. WebCoronet Contribution

### What the codebase demonstrates

The repository demonstrates work across product design, systems architecture, frontend development, backend API development, database modelling, payment integration, role/permission design, deployment automation, testing, and operational documentation.

### Attribution-safe statement for publication

> “WebCoronet developed and evolved ResortPro as a custom hospitality SaaS platform, covering product architecture, web interfaces, backend services, data modelling, direct-booking surfaces, and deployment workflows.”

Use the statement above **only if WebCoronet owned or was contracted for those areas**. Legal/project attribution, client ownership, contributors, and exact team roles are **not proven by source code alone** and need project-owner confirmation before publication.

---

## 22. Results / Outcomes

### Confirmed results

- A working codebase exists for a multi-tenant resort-management product with public, dashboard, API, mobile, desktop and embed surfaces.
- The product includes production and staging deployment configurations plus CI checks for schema drift, API/integration tests, E2E tests and tenant isolation safeguards.
- Core resort operations are represented in one connected data model and route architecture.
- The platform includes direct-booking and property website capabilities in addition to internal operations tools.

### Qualitative outcomes

- Creates a central operational foundation for resort teams.
- Connects guest-facing booking activity to staff-facing property workflows.
- Gives a resort an owned direct-booking surface and embeddable distribution options.
- Establishes a structured base for role-based growth, new property modules, and regional payment options.

### Metrics worth collecting

Before publishing any quantified result, collect a defined measurement period and data source for:

- Number of active resort tenants/properties.
- Number and value of bookings processed through direct channels.
- Direct-booking share versus third-party channels.
- Average time to complete check-in/check-out before and after adoption.
- Housekeeping task completion time and room-turnover time.
- Staff time saved on daily reporting or booking follow-up.
- Payment success/failure rates by gateway.
- Support ticket volume and response time.
- Website-to-booking conversion rate.
- Availability-sync conflicts or avoided double bookings.

---

## 23. Before / After Story

### Before

**Needs client/project-owner input.** The repository establishes the problem the product is designed to solve, but does not verify a specific resort's prior tools, manual process, or baseline metrics.

### After

ResortPro provides a single product environment for direct booking, front desk, rooms, guests, staff operations, restaurant/inventory work, payment flows, communication and reporting. This is a product-capability statement, not proof of a particular customer's adoption outcome.

---

## 24. Visual Asset Checklist

Collect sanitised, realistic product screenshots—never use a screen containing a guest's personal data, real booking reference, document image, token, API key, or private support conversation.

| Priority visual | What it demonstrates |
|---|---|
| **1. ResortPro landing page, desktop** | Product positioning, brand, and the owner-facing value proposition. |
| **2. Dashboard overview** | A single operational view of rooms, arrivals/departures, revenue/activity, and alerts. |
| **3. Booking calendar or availability view** | How reservations connect to rooms and operational planning. |
| **4. Front-desk / walk-in flow** | Fast staff workflow and returning-guest lookup; use seeded/demo data only. |
| **5. Room detail plus housekeeping state** | Connected room readiness and staff task workflow. |
| **6. Public resort website with booking CTA** | Branded direct-booking experience for a property. |
| **7. Booking widget embedded on a sample site** | How ResortPro can operate outside its own hosted public site. |
| **8. Payment selection screen** | Local/global payment flexibility; use test mode and no customer data. |
| **9. Guest CRM profile** | Guest history and relationship context using fake/demo data. |
| **10. Restaurant/inventory view** | Breadth of operational modules beyond room bookings. |
| **11. Native Android screen** | Mobile operational access. |
| **12. Architecture diagram** | Web/public/Android/desktop surfaces connecting to Fastify, PostgreSQL, Redis and worker services. |

Optional: a short GIF/video of public booking → dashboard booking → front-desk check-in, using a demo tenant.

---

## 25. Sensitive Information Review

### Do not publish

- API keys, JWT secrets, webhook secrets, database URLs, payment credentials, Telegram bot tokens, WhatsApp tokens, Portainer/Coolify tokens, or any `.env` values.
- Real guest names, email addresses, phone numbers, passport/ID documents, booking references, payment records, staff personal details, or support conversations.
- Admin-only URLs, API documentation paths, internal hostnames, deployment platform IDs, container/service IDs, or detailed exploit-oriented security notes.
- Unreleased pricing, internal plan limits, commercial agreements, referral rewards, trial-abuse controls, or any private product roadmap.
- Screenshots containing browser developer tools, query strings with temporary signatures, or test credentials.
- Claims that an integration is live for every customer; gateway/email/messaging configuration is environment and tenant dependent.

### Publication safety checklist

- [ ] Replace all real data with demo/synthetic data.
- [ ] Remove tokens, URLs with signed parameters, and credentials from screenshots/code snippets.
- [ ] Check payment screenshots are test-mode and do not reveal transaction IDs.
- [ ] Confirm legal right to use the ResortPro name, logo, product screenshots and URL.
- [ ] Confirm WebCoronet's exact role and client/product ownership language.
- [ ] Have a technical reviewer approve architecture/security wording.
- [ ] Have the project owner approve commercial claims and publishing date.

---

## 26. Portfolio Card Copy

**Project name:** ResortPro  
**Category:** Hospitality SaaS / Custom Software  
**One-line description:** A connected operating platform for independent resort teams.  
**Short description (33 words):** ResortPro brings direct booking, front desk, rooms, guest CRM, housekeeping, restaurant operations, payments, and reporting into one multi-tenant platform designed for independent resort operators.  
**Suggested tags:** SaaS · Hospitality Technology · Booking Platform · Multi-Tenant · Custom Software

---

## 27. Homepage Featured Project Copy

**Eyebrow:** Hospitality SaaS  
**Headline:** One operating system for the daily work of a resort.  
**Description:** ResortPro connects the guest journey with the work behind the stay—from direct booking and check-in to room readiness, guest records, payments, and operational reporting. Built as a multi-tenant platform for independent resort teams.  
**CTA:** Explore the ResortPro case study

---

## 28. Full Case Study Copy

# ResortPro: Connecting the Day-to-Day Work of an Independent Resort

## Overview

Independent resorts do not operate through a single moment or a single team. A guest's stay can begin on a public website, continue through a booking and payment flow, arrive at the front desk, affect room readiness and housekeeping, generate food-service activity, and end in an operational report. ResortPro was built to connect those moments in one multi-tenant product.

The platform combines a public booking experience, a resort dashboard, an API-led backend, embeddable booking components, a native Android application, and a desktop companion. It is designed for owners and staff who need a practical system for running a property—not a collection of disconnected tools.

## The Challenge

The core challenge was not simply to build a booking form. The product had to support the operational reality behind every reservation: room status, staff roles, guest records, housekeeping, maintenance, food orders, payment choices, communication, and reporting.

This also introduced a SaaS challenge. Multiple resort businesses needed to use the same platform without crossing data boundaries. Public pages and booking widgets needed to connect to the same operational system as staff-facing tools. And the product had to work for a Bangladesh-first market while leaving room for broader payment and property requirements.

## The Approach

The product was approached as a connected operations platform. The architecture uses tenant-aware data modelling and authenticated tenant-scoped access, while the interface separates public guest experiences, resort operations, and platform administration.

Operational modules were organised around the flow of work: bookings and front desk; rooms and housekeeping; guests and CRM; food, inventory and purchasing; payments and invoices; communications and reporting. A separate worker process handles scheduled tasks such as reminders, calendar sync and report dispatch so the core API is not responsible for every background responsibility.

## The Solution

ResortPro provides a single environment for managing a resort's guest journey and internal work.

Public resort websites and embeddable widgets offer direct booking and availability access. The protected dashboard supports booking management, walk-ins, rooms, guest records, task-based operations, financial workflows, CRM and reporting. Role-based access helps give reception, kitchen, operations, management and shareholders different levels of visibility. The platform also includes Android, desktop, and WordPress integration paths for businesses that need more than one way to access their tools.

## Key Features

- Direct booking via public resort sites, embeddable widgets, and WordPress integration.
- Booking, calendar, walk-in, check-in, and checkout workflows.
- Room status, housekeeping tasks, maintenance, minibar, laundry and lost-and-found operations.
- Guest CRM, loyalty, tags, consent, history and communication records.
- Restaurant, tables, orders, inventory, vendors and purchase orders.
- Local and global payment architecture including bKash, SSLCommerz, Stripe, and manual settlement paths.
- Role-based dashboard access and platform administration.
- Scheduled operational messaging, daily reports, iCal synchronisation and booking-hold expiry.

## Technology

The web product uses Next.js, React, TypeScript and Tailwind CSS. The backend is a Fastify REST API backed by PostgreSQL and Prisma. Redis and a dedicated worker support background operations, while Docker and GitHub Actions provide repeatable deployment paths. The project also includes Kotlin/Jetpack Compose Android code, an Electron desktop package, a Vite-built embed SDK and a WordPress plugin.

## Engineering Challenges

The project required careful treatment of multi-tenant isolation, role permissions, protected uploads, payment/invoice complexity, background jobs, and reliable container deployment. The repository includes tenant-scoping safeguards, validation middleware, signed access to private guest documents, CI checks, schema-drift checks, integration/E2E tests, and deployment scripts designed to avoid stale container images.

One important engineering lesson was that hospitality billing needs a single authoritative source of truth. ResortPro documents this as a dedicated billing contract and checkout-completeness initiative rather than obscuring an unfinished reconciliation problem behind a marketing claim.

## Outcome

ResortPro establishes a connected software foundation for independent resort operations. It brings guest-facing booking, staff workflows, property operations, payment options, communication and reporting into one product architecture that can support multiple properties and product surfaces.

Commercial impact metrics, customer adoption figures and time-saving measurements were not available for this case study. They should be added only after a defined measurement period and verified source data are available.

---

## 29. SEO Material

**SEO title:** ResortPro | Multi-Tenant Resort Management SaaS  
**Meta description:** ResortPro is a multi-tenant platform for direct booking, front desk, rooms, guests, housekeeping, payments, and resort operations.  
**Suggested focus keyword:** resort management software  
**Secondary keywords:** hospitality SaaS, direct booking platform, hotel operations software, resort booking system, property management software  
**Suggested OpenGraph title:** ResortPro — A Connected Resort Operations Platform  
**Suggested OpenGraph description:** See how ResortPro connects direct booking, front desk, rooms, guests, payments, and property operations in one multi-tenant hospitality product.

---

## 30. Structured WebCoronet Data

```yaml
project_name: ResortPro
slug: resortpro-resort-management-platform
portfolio_title: ResortPro — A Multi-Tenant Operating Platform for Independent Resorts
one_liner: A connected operating platform for independent resort teams.
short_description: ResortPro brings direct booking, front desk, rooms, guest CRM, housekeeping, restaurant operations, payments, and reporting into one multi-tenant platform designed for independent resort operators.
industry: Hospitality technology
project_type: Multi-tenant B2B SaaS
market: Bangladesh-first; multi-country architecture present
status: Active product codebase; live public availability not verified
featured: true
website_url: https://resortpro.site

services:
  - Product architecture
  - UX and interface development
  - Frontend development
  - Backend API development
  - Database design
  - Payment integration
  - Multi-tenant SaaS engineering
  - DevOps and deployment automation
  - QA and test automation

technologies:
  - TypeScript
  - Next.js 14
  - React 18
  - Fastify
  - PostgreSQL
  - Prisma
  - Redis
  - Kotlin
  - Jetpack Compose
  - Electron
  - Docker
  - GitHub Actions

integrations:
  - Stripe
  - bKash
  - SSLCommerz
  - Resend
  - Telegram Bot API
  - Meta WhatsApp Cloud API
  - External iCal calendars
  - Microsoft Clarity
  - WordPress

key_features:
  - Direct booking and branded public websites
  - Booking, front desk and walk-in workflows
  - Room status and housekeeping operations
  - Guest CRM and loyalty foundation
  - Restaurant, inventory and purchasing workflows
  - Role-based workspaces
  - Payment and invoice capabilities
  - Scheduled operational communications
  - Embed SDK and WordPress integration
  - Android and desktop application surfaces

challenge_summary: Building a connected resort operations platform across guest booking, front desk, rooms, staff, food service, payments, and reporting while keeping every property's data tenant-isolated.
solution_summary: A multi-tenant SaaS platform with a Next.js web app, Fastify API, PostgreSQL/Prisma data layer, operational modules, public booking surfaces, background worker, and deployment automation.
outcome_summary: A connected, extensible product foundation for direct booking and resort operations; commercial adoption and performance metrics are not confirmed.

metrics_confirmed: []
metrics_needed:
  - Active properties and users
  - Direct booking volume and value
  - Conversion rate
  - Check-in/check-out time saved
  - Housekeeping turnaround time
  - Payment success rates
  - Support and operational time saved

case_study_sections:
  overview: ResortPro is a multi-tenant operating platform for independent resorts.
  challenge: Connect guest-facing booking with cross-department property operations and tenant-safe SaaS architecture.
  approach: Build around connected workflows, role-specific interfaces, tenant-scoped access and scheduled background services.
  solution: Deliver web, API, public booking, embed, Android, desktop, payment and operations capabilities in one architecture.
  technology: Next.js, React, Fastify, PostgreSQL, Prisma, Redis, Kotlin, Docker and GitHub Actions.
  challenges: Tenant isolation, hospitality billing, protected uploads, background processing and deploy reliability.
  outcome: A documented and deployable product foundation; measured business impact needs verified analytics.

visual_assets_needed:
  - Landing page
  - Dashboard overview
  - Booking calendar
  - Front-desk walk-in flow
  - Room and housekeeping workflow
  - Public booking page
  - Embed widget
  - Payment selection
  - Guest CRM
  - Restaurant/inventory view
  - Android screen
  - Architecture diagram

publication_warnings:
  - Use demo data only
  - Do not publish credentials, tokens, internal URLs or signed links
  - Do not claim unverified outcomes or live integration adoption
  - Confirm WebCoronet attribution and product ownership
  - Do not present planned billing work as complete
```

---

## 31. Information Still Needed

### Critical

1. Is ResortPro a WebCoronet-owned product, a client project, or a partnership? Confirm the legally correct attribution and whether a client may be named.
2. Is `https://resortpro.site` the public product URL to publish, and is it currently live?
3. Which production integrations are genuinely enabled today (Stripe, bKash, SSLCommerz, Resend, WhatsApp, Telegram, iCal)?
4. Can WebCoronet state that it performed all listed product/design/engineering/DevOps work, or should contribution wording be narrowed?
5. Which screenshots are approved for public use, and is a dedicated demo tenant available?

### Useful

1. Date of first production deployment and current release status.
2. Number of properties, staff users, or bookings—only if a trustworthy source and measurement date are available.
3. A confirmed prior workflow or customer problem statement from an operator.
4. Any approved client/owner quote or testimonial.
5. Measured before/after operational metrics.

### Optional

1. Brand/design rationale or named design collaborators.
2. A short walkthrough video or interactive prototype.
3. Architecture diagram assets in WebCoronet visual style.
4. Product roadmap items that are safe to disclose publicly.

