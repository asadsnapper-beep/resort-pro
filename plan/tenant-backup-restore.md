# Tenant Data Backup & Restore
**Resort owner নিজের data নিজে backup করবে, দরকারে restore করবে**

---

## কেন এটা দরকার

### Real scenarios যা হতে পারে:

```
❌ Staff ভুলে ৫০টা booking delete করে ফেলল
❌ কেউ guest data mass edit করে ভুল করল
❌ Resort owner তার পুরনো data দেখতে চায় (audit)
❌ ResortPro server-এ কোনো সমস্যা হলো
❌ Owner অন্য system-এ যেতে চায়, data নিয়ে যাবে
❌ নতুন tax year শুরু — পুরনো বছরের full snapshot রাখতে চায়
```

**এখন কী হয়:** কোনো option নেই। Data গেলে গেছে।
**হওয়া উচিত:** Owner নিজেই backup নিতে পারবে, restore করতে পারবে।

---

## দুটো আলাদা জিনিস — clear করা দরকার

| | **Backup & Restore** | **Export** |
|--|--|--|
| **উদ্দেশ্য** | Data হারানো থেকে রক্ষা, ফিরিয়ে আনা | Data নিজের কাছে রাখা, বাইরে নিয়ে যাওয়া |
| **Format** | JSON (machine-readable, restorable) | CSV / Excel (human-readable) |
| **Restore হয়?** | ✅ হ্যাঁ — system-এ ফিরিয়ে দেওয়া যায় | ❌ না — শুধু দেখার জন্য |
| **কে করে** | Owner নিজে (Settings থেকে) | Owner নিজে |
| **কখন লাগে** | Emergency, বা precaution হিসেবে | Monthly report, account migration |
| **Existing?** | ❌ নেই | ✅ Admin panel-এ কিছুটা আছে |

---

## কী কী Data Backup হবে

### Tenant-এর সব নিজস্ব data:

```
🏨 Core
  ├── Tenant profile (name, settings, currency, timezone)
  ├── Rooms & Villas (সব room info, amenities)
  ├── Rate Plans
  └── Packages

📅 Bookings & Guests
  ├── Guests (সব guest profile)
  ├── Bookings (সব booking, status সহ)
  ├── Payments
  ├── Invoices + Invoice Items
  └── Group Bookings

👥 Operations
  ├── Staff (user info ছাড়া, শুধু staff records)
  ├── Housekeeping Tasks
  ├── Maintenance Tickets
  ├── Support Tickets
  └── External Calendars

🍽️ Restaurant
  ├── Menu Items
  ├── Food Orders + Items
  └── Inventory Items

💰 Finance
  ├── Expenses
  └── Invoice Extras

📣 Marketing & CRM
  ├── Guest Tags & Relations
  ├── Guest Scores
  ├── Marketing Campaigns
  ├── Message Templates
  └── Email Templates / CRM Campaigns

🌐 Website
  └── Website Content (hero, about, gallery, testimonials)

⚙️ Settings
  ├── SMS & WhatsApp settings (credentials বাদে)
  ├── Amenities
  └── Loyalty Program config
```

### Backup-এ থাকবে না (security):
```
❌ User passwords (hash-ও না)
❌ SMS API keys / WhatsApp tokens (sensitive credentials)
❌ Stripe payment tokens
❌ Refresh tokens / JWT
❌ অন্য tenant-এর কোনো data
```

---

## Backup Types

### Type 1 — Full Backup
সব কিছু একসাথে। Emergency restore-এর জন্য।
- Size: ~1-20 MB (JSON, compressed)
- Time: 10-30 seconds
- Use case: Major restore, migration

### Type 2 — Module Backup
নির্দিষ্ট section-এর data।
```
Owner select করবে:
☑ Bookings & Guests
☐ Finance (Invoices, Expenses)
☐ Restaurant (Menu, Orders)
☐ Marketing (CRM, Campaigns)
☐ Operations (HK, Maintenance)
☐ Website Content
```
- Size: Much smaller
- Time: 2-5 seconds
- Use case: "শুধু guest data backup নিতে চাই"

### Type 3 — Automatic Scheduled Backup
System নিজেই রোজ রাতে backup নেবে।
- Daily: last 7 days রাখবে
- Weekly: last 4 weeks রাখবে
- Monthly: last 12 months রাখবে
- Owner কিছু করতে হবে না — auto হবে
- Plan-ভেদে:
  - Starter: Weekly auto backup (4 weeks retain)
  - Professional: Daily auto backup (30 days retain)
  - Enterprise: Daily + custom retention

---

## Restore Types

### Restore 1 — Full Restore (সতর্কতার সাথে)
```
⚠️ Warning: এটা বর্তমান সব data মুছে দেবে
   backup-এর সময়কার data ফিরিয়ে আনবে।

   Confirm করতে resort slug type করো: "palm-paradise-resort"
   [___________________]   [Restore করো]
```
- Use case: Complete disaster recovery
- Irreversible — তাই double confirmation

### Restore 2 — Selective Restore (Safe)
```
Backup: May 15, 2026 — Full Backup

কোন data restore করবে?
☑ Guests — 142 records
☐ Bookings — 89 records  
☐ Invoices — 67 records
☐ Expenses — 34 records
☐ Menu Items — 23 records

কীভাবে restore করবে?
○ Merge (নতুনগুলো রেখে backup থেকে missing গুলো যোগ করো)
● Overwrite (backup-এর data দিয়ে replace করো)
```
- Safe — বর্তমান data নষ্ট হওয়ার ঝুঁকি কম
- Use case: "Guest data ভুল হয়েছে, শুধু সেটা restore করো"

### Restore 3 — Preview Before Restore
Restore করার আগে দেখাবে কী change হবে:
```
Preview — কী বদলাবে:

  Guests:
  + 12 records যোগ হবে (backup-এ ছিল, এখন নেই)
  ~ 8 records update হবে (backup থেকে)
  - 3 records delete হবে (backup-এ ছিল না)

  [Cancel]   [Confirm Restore]
```

---

## কোথায় Backup Store হবে

### Option A — Cloud Storage (S3 / Cloudflare R2) ✅ Recommended
```
Storage structure:
  resortpro-backups/
    └── tenant-{id}/
          ├── auto/
          │     ├── 2026-05-20-daily.json.gz
          │     ├── 2026-05-19-daily.json.gz
          │     └── ...
          └── manual/
                ├── 2026-05-18-full-backup.json.gz
                └── 2026-05-15-guests-only.json.gz
```

- প্রতিটা tenant আলাদা folder — কেউ অন্যজনের দেখতে পাবে না
- Gzip compressed (80% smaller)
- AES-256 encrypted at rest
- Signed URL দিয়ে download (15 min expire)

**Cost:**
- Cloudflare R2: First 10 GB free, তারপর $0.015/GB/month
- একটা tenant-এর full backup ~2-5 MB → ৩০টা backup = ~75 MB → ঘরে বসে $0.001/month
- সব tenant মিলিয়েও বছরে কয়েক ডলার — negligible

### Option B — Local Download (Download করে রাখো)
Backup file সরাসরি browser-এ download হবে। Cloud storage নেই।
- Zero storage cost
- Guest নিজের computer-এ রাখে
- Restore করতে file upload করতে হবে
- Cloud auto-backup হবে না

**সুপারিশ: দুটোই অফার করো** — auto cloud + manual download।

---

## UI — Settings > Backup & Restore

```
┌─────────────────────────────────────────────────────────────┐
│  💾 Backup & Restore                                         │
│  আপনার resort-এর সব data সুরক্ষিত রাখুন                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📅 Automatic Backups             [Professional Plan ✅]    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Daily backup: রাত ২টায়        Status: ✅ Active     │  │
│  │  Last backup:  Today 2:00 AM   Size: 3.2 MB          │  │
│  │  Retention:    30 days                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  📦 Manual Backup                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [Full Backup]   [Select Modules ▾]                  │  │
│  │                                                       │  │
│  │  ✓ Full backup includes all data (rooms, bookings,   │  │
│  │    guests, invoices, expenses, restaurant, CRM...)   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  🗂️ Backup History                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  📁 May 20, 2026 — 2:00 AM  AUTO  Full   3.2 MB     │  │
│  │     [↓ Download] [↩ Restore] [🗑 Delete]            │  │
│  │                                                       │  │
│  │  📁 May 18, 2026 — 3:45 PM  MANUAL Full  3.0 MB     │  │
│  │     [↓ Download] [↩ Restore] [🗑 Delete]            │  │
│  │                                                       │  │
│  │  📁 May 15, 2026 — 2:00 AM  AUTO  Full   2.9 MB     │  │
│  │     [↓ Download] [↩ Restore] [🗑 Delete]            │  │
│  │                           ... (28 more backups)       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  📤 Import / Upload Backup                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [📂 Choose backup file]  (.json or .json.gz)        │  │
│  │  বা এখানে drag & drop করুন                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Backup File Format

```json
{
  "resortpro_backup": {
    "version": "1.0",
    "created_at": "2026-05-20T02:00:00Z",
    "tenant": {
      "id": "35d95f4e-...",
      "name": "Palm Paradise Resort",
      "slug": "palm-paradise-resort",
      "plan": "PROFESSIONAL"
    },
    "backup_type": "full",
    "modules": ["rooms", "bookings", "guests", "invoices", "expenses", "..."],
    "stats": {
      "rooms": 12,
      "guests": 347,
      "bookings": 891,
      "invoices": 423
    }
  },
  "data": {
    "rooms": [ { "number": "101", "name": "Sea View", "basePrice": 4500, ... } ],
    "guests": [ { "firstName": "Karim", "lastName": "Hossain", "email": "...", ... } ],
    "bookings": [ { "confirmationNo": "PPR-2026-001", "checkIn": "...", ... } ],
    "invoices": [ { "invoiceNumber": "INV-2026-001", "total": 14850, ... } ],
    "expenses": [ ... ],
    "menuItems": [ ... ],
    "websiteContent": { ... }
  }
}
```

**IDs নিয়ে সমস্যা:**
Restore করার সময় original UUID গুলো conflict করতে পারে।
Solution: Restore engine নতুন UUID generate করবে, কিন্তু relation গুলো maintain করবে।

---

## API Endpoints

```
# Backup তৈরি করা
POST /api/tenant/backups
     Body: { type: "full" | "modules", modules?: string[] }
     → Backup job queue করে, job ID দেয়

GET  /api/tenant/backups/:jobId/status
     → backup progress দেখাবে (0-100%)

# Backup list
GET  /api/tenant/backups
     → সব backup এর list (auto + manual)

# Download
GET  /api/tenant/backups/:id/download
     → Signed URL দেবে (15 min expire) — সরাসরি S3 থেকে download

# Delete
DELETE /api/tenant/backups/:id

# Restore
POST /api/tenant/backups/:id/restore
     Body: { mode: "full" | "selective", modules?: string[], strategy: "merge" | "overwrite" }
     → Restore job queue করে

POST /api/tenant/backups/upload
     → File upload করে restore

GET  /api/tenant/backups/:id/preview
     → Restore করার আগে কী change হবে দেখাবে
```

---

## Database Schema

```prisma
model TenantBackup {
  id           String   @id @default(cuid())
  tenantId     String
  tenant       Tenant   @relation(...)

  type         String   // "full" | "modules"
  trigger      String   // "auto" | "manual"
  status       String   // "pending" | "processing" | "ready" | "failed"
  modules      String[] // ["rooms", "bookings", "guests", ...]

  // Storage
  storageKey   String?  // S3/R2 object key
  sizeBytes    Int?
  checksum     String?  // integrity verify করার জন্য

  // Stats (backup-এর সময় কতটা data ছিল)
  recordCount  Json?    // { rooms: 12, guests: 347, bookings: 891 }

  errorMsg     String?
  createdAt    DateTime @default(now())
  completedAt  DateTime?
  expiresAt    DateTime? // retention policy অনুযায়ী

  @@index([tenantId, createdAt])
  @@map("tenant_backups")
}
```

Tenant model-এ যোগ হবে:
```prisma
  backupEnabled        Boolean  @default(true)
  autoBackupSchedule   String   @default("daily")  // daily | weekly | none
  backupRetentionDays  Int      @default(7)  // plan অনুযায়ী
  lastBackupAt         DateTime?
  backups              TenantBackup[]
```

---

## Plan-ভেদে Feature

| Feature | Free | Starter | Professional | Enterprise |
|---------|:----:|:-------:|:------------:|:----------:|
| Manual backup | ✅ | ✅ | ✅ | ✅ |
| Download backup | ✅ | ✅ | ✅ | ✅ |
| Upload & restore | ✅ | ✅ | ✅ | ✅ |
| Auto daily backup | ❌ | ❌ | ✅ | ✅ |
| Auto weekly backup | ❌ | ✅ | ✅ | ✅ |
| Retention (days) | manual only | 14 days | 30 days | 365 days |
| Max manual backups | 3 | 10 | Unlimited | Unlimited |
| Module-level restore | ❌ | ✅ | ✅ | ✅ |
| Restore preview | ❌ | ✅ | ✅ | ✅ |
| Admin-triggered backup | — | — | — | ✅ |

---

## Admin Panel Integration

Platform owner (তুমি) admin panel থেকে:
- যেকোনো tenant-এর backup trigger করতে পারবে
- Backup history দেখতে পারবে
- Emergency restore করতে পারবে (support case-এ)

```
Admin → Tenants → [Palm Paradise Resort] → Backup & Restore
  ├── [Trigger Backup Now]
  ├── Backup History
  └── [Restore from backup...]
```

---

## Security

- **Tenant isolation:** প্রতিটা tenant শুধু নিজের backup দেখতে ও download করতে পারবে
- **Encryption:** Backup file S3-তে AES-256 encrypted
- **Download URL:** Signed URL — ১৫ মিনিট পরে expire, share করা যাবে না
- **Restore confirmation:** Full restore-এর আগে resort slug type করে confirm করতে হবে
- **Audit log:** কে কখন backup নিয়েছে, কে restore করেছে — সব লগ থাকবে
- **Rate limiting:** একজন tenant ঘণ্টায় সর্বোচ্চ ৫টা manual backup করতে পারবে

---

## Implementation Order

```
Week 1 — Backend
  ✦ TenantBackup model → DB push
  ✦ Backup engine (Prisma query → JSON serialize)
  ✦ S3/R2 upload service
  ✦ Manual backup API (POST, GET list, download URL)
  ✦ BullMQ job queue (async processing)

Week 2 — Restore Engine + UI
  ✦ Restore engine (JSON parse → Prisma upsert with ID remapping)
  ✦ Selective restore (module-level)
  ✦ Restore preview diff
  ✦ Settings page — Backup & Restore tab
  ✦ Upload & restore from file

Week 3 — Automation + Polish
  ✦ Cron job: auto daily/weekly backup
  ✦ Retention policy (auto delete old backups)
  ✦ Plan-based feature gating
  ✦ Admin panel integration
  ✦ Audit logging
  ✦ Email notification: "Your daily backup is ready"
```

---

## Estimated Effort

| Task | দিন |
|------|-----|
| Backup engine (serialize all models) | 2–3 days |
| S3/R2 storage integration | 1 day |
| Restore engine (with ID remapping) | 3–4 days |
| Selective restore + preview | 2 days |
| Settings UI (backup list, download, restore) | 2–3 days |
| Auto backup cron + retention | 1–2 days |
| Admin panel + audit log | 1 day |
| Testing + edge cases | 2 days |
| **Total** | **~3 weeks** |

---

## এক লাইনে

> Data হারানো মানে trust হারানো।
> Resort owner যদি জানে যে তার data সুরক্ষিত আছে, সে নিশ্চিন্তে কাজ করতে পারবে।
> এই feature বিক্রি করা যায় — "আপনার data সবসময় আপনার কাছেই থাকবে।"

---

*Related: [platform-owner-dashboard.md](./platform-owner-dashboard.md) — admin panel data export*
*Related: [roles-permissions.md](./roles-permissions.md) — কে restore করতে পারবে*
