# ResortPro — Launch Tutorial Video Content Plan

> লক্ষ্য: launch করার সময় একটা full tutorial video (বা video series) বানানো, যেখানে ResortPro-র **একটা option/feature-ও miss না হয়**। এই doc-টা কোডের ভিতর থেকে সত্যিকারের প্রতিটা sidebar item, admin panel item, role আর public-facing feature ধরে ধরে বের করে বানানো — অনুমান করে কিছু লেখা হয়নি।

**একটা কথা আগে বলে রাখি:** পুরো platform-টা একটা ২০-৩০ মিনিটের ভিডিওতে ঢোকানো বাস্তবসম্মত না — sidebar-এই ৭টা group, ৪০+ page, ৮টা আলাদা role, plus admin panel, website builder, discovery platform, desktop app। একটা মেগা-ভিডিও বানালে দর্শক ১০ মিনিটেই হারিয়ে যাবে। তার বদলে **playlist structure** সুপারিশ করছি — নিচে পুরো breakdown।

---

## ০. Series Structure (সুপারিশ)

| # | Series | কার জন্য | ভিডিও সংখ্যা (আনুমানিক) |
|---|--------|----------|--------------------------|
| 1 | **Quickstart** | নতুন signup করা owner — প্রথম ১৫ মিনিটে কী করতে হবে | ১টা (১২-১৫ মিন) |
| 2 | **Owner Deep-Dive** | Owner/Manager — module ধরে ধরে বিস্তারিত | ৭টা (sidebar-এর ৭ group অনুযায়ী) |
| 3 | **Role Quick-Starts** | নতুন staff যারা প্রথমবার লগইন করছে, শুধু নিজের role দেখতে চায় | ৭টা (৩-৫ মিন প্রতিটা) |
| 4 | **Website & Public Presence** | Owner যে নিজের ওয়েবসাইট/marketing চালাবে | ৪টা |
| 5 | **Admin/Platform** | তোমার নিজের team (support/ops), super-admin panel | ১টা (দরকার হলে internal-only, public না) |
| 6 | **Desktop App** | Windows/Mac app ব্যবহারকারী | ১টা |

মোট আনুমানিক: **~২১টা ভিডিও** যদি সব covered করতে চাও। Launch-day-এ সব লাগবে না — নিচে P0 (launch-এর আগে must) vs P1 (পরে যোগ করা যাবে) marked করা আছে।

---

## ১. Quickstart Video (P0 — সবচেয়ে জরুরি)

**দৈর্ঘ্য:** ১২-১৫ মিনিট
**লক্ষ্য দর্শক:** যে কেউ সবেমাত্র signup করেছে

| ধাপ | দেখানো হবে | Reference |
|-----|-----------|-----------|
| ১ | Signup/Register flow — resort name, slug, trial শুরু | `/auth/register` |
| ২ | Welcome email + login | `/auth/login` |
| ৩ | Dashboard-এর প্রথম দৃশ্য — sidebar-এর ৭টা group-এর একটা quick fly-over (প্রতিটাতে ১টা লাইন) | `/dashboard` |
| ৪ | প্রথম Property + Room তৈরি করা | `/dashboard/properties`, `/dashboard/rooms` |
| ৫ | প্রথম booking (Front Desk বা Bookings থেকে) | `/dashboard/front-desk`, `/dashboard/bookings` |
| ৬ | Check-in → Invoice generate | `/dashboard/bookings/[id]/invoice` |
| ৭ | Website তৈরি (basic theme select) | `/dashboard/website` |
| ৮ | Staff invite করা | `/dashboard/staff` |
| ৯ | কোথায় help পাবে (Support ticket) | `/dashboard/support` |
| ১০ | পরের ভিডিওগুলো কোথায় পাবে (playlist CTA) | — |

---

## ২. Owner Deep-Dive Series — sidebar group অনুযায়ী (P0 প্রতিটা group-এর জন্য অন্তত ১টা video)

### 2.1 Overview Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Dashboard (home) | `/dashboard` | P0 | stats cards, quick actions, notification bell |
| Analytics | `/dashboard/analytics` | P0 | revenue chart, occupancy, ADR/RevPAR |
| Invoices | `/dashboard/invoices` | P0 | invoice list, filter, PDF download |
| Expenses | `/dashboard/expenses` | P1 | category-wise expense tracking |
| Daily Reports | `/dashboard/reports` | P1 | shift-end report, export |
| My Shares | `/dashboard/my-shares` | P1 | shareholder view (যদি owner নিজেও shareholder হয়) |

### 2.2 Rooms & Bookings Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Properties | `/dashboard/properties` | P0 | multi-property (Enterprise gate থাকলে বলা লাগবে) |
| Rooms & Villas | `/dashboard/rooms` | P0 | room type, status, custom room types |
| Rate Plans | `/dashboard/rate-plans` | P1 | dynamic pricing, seasonal rates |
| Packages | `/dashboard/packages` | P1 | bundled offers |
| Front Desk | `/dashboard/front-desk` | P0 | walk-in, check-in/out, room status board |
| Bookings | `/dashboard/bookings` | P0 | booking list, filter, detail sheet |
| Booking Calendar | `/dashboard/calendar` | P0 | visual calendar, drag-drop |
| Group Bookings | `/dashboard/group-bookings` | P1 | multi-room group reservation |
| Channel Sync | `/dashboard/channels` | P1 | Airbnb/Booking.com sync (যদি live থাকে) |
| Venues & Events | `/dashboard/venues` | P1 | pool/hall rental |
| Corporate Accounts | `/dashboard/corporate-accounts` | P1 | B2B billing |
| Vehicle Rental | `/dashboard/vehicles` | P1 | fleet + rental tracking |

### 2.3 Guests Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Guests | `/dashboard/guests` | P0 | guest profile, document scanner, history |
| Loyalty Program | `/dashboard/loyalty` | P1 | points, tiers |
| Support | `/dashboard/support` | P1 | ticket system |

### 2.4 Operations Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Staff | `/dashboard/staff` | P0 | invite, roles, attendance, Clock In/Out |
| Housekeeping | `/dashboard/housekeeping` | P0 | task assignment, room status, Lost & Found, Minibar, Laundry |
| Maintenance | `/dashboard/maintenance` | P1 | ticket-based repair tracking |
| Assets | `/dashboard/assets` | P1 | durable property register |

### 2.5 Restaurant Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Restaurant | `/dashboard/restaurant` | P1 | menu management |
| F&B Orders | `/dashboard/orders` | P1 | order queue, chef view |
| Tables | `/dashboard/restaurant/tables` | P1 | tablet kiosk ordering |
| Inventory | `/dashboard/inventory` | P1 | vendor, PO, low-stock alerts |

### 2.6 Marketing Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Offers | `/dashboard/offers` | P1 | promo codes |
| CRM & Email | `/dashboard/crm` | P1 | guest segments, email templates |
| SMS Marketing | `/dashboard/marketing` | P1 | bulk SMS campaigns |
| Website | `/dashboard/website` | P0 | theme select, **Custom Design Request (10k/40k/80k paid tiers)** |
| AI Content | `/dashboard/ai-content` | P1 | AI-generated marketing copy |

### 2.7 Account Group

| Feature | Route | Priority | মূল talking points |
|---------|-------|----------|---------------------|
| Billing | `/dashboard/billing` | P0 | plan, trial countdown, bKash checkout |
| Referrals | `/dashboard/referrals` | P1 | referral program, tracking |
| Shareholders | `/dashboard/shareholders` | P1 | ownership %, payout tracking |
| Settings | `/dashboard/settings` | P0 | property info, check-in/out time, notification prefs |

---

## ৩. Role Quick-Start Series (P1, কিন্তু launch-এর কাছাকাছি করলে ভালো)

প্রতিটা role আলাদা ভিডিও — কারণ একজন Receptionist পুরো Owner dashboard দেখতে চায় না, শুধু নিজের কাজটা কীভাবে করবে জানতে চায়। Demo role selector (`/try`) থেকে সরাসরি reference নেওয়া:

| Role | ভিডিওতে যা দেখাবে | দৈর্ঘ্য |
|------|---------------------|--------|
| **Manager** | Booking + Guest + Housekeeping + Support ticket ওভারভিউ | ৫ মিন |
| **Receptionist** | Check-in/out, Walk-in booking, Room status, Invoice | ৫ মিন |
| **Staff (Housekeeping)** | নিজের task list, room status update, Clock In/Out | ৩ মিন |
| **Chef** | F&B order queue, status update | ৩ মিন |
| **Marketer** | Website, CRM, SMS marketing, offers | ৪ মিন |
| **Developer** | Embed widget SDK, API keys, integration docs | ৪ মিন |
| **Shareholder** | Read-only analytics, revenue, monthly report | ৩ মিন |

---

## ৪. Website & Public Presence Series (P1)

| Video | বিষয় | Reference |
|-------|------|-----------|
| থিম বেছে নেওয়া ও customize করা | Config theme, colors, sections | `/dashboard/website` |
| Custom Design বানানো (paid) | 10k/40k/80k tier flow, admin কিভাবে respond করে | Design Request modal |
| নিজের domain লাগানো | Subdomain (`<slug>.resortpro.site`) + custom domain verification | Custom Domain plan |
| Embed Widget নিজের সাইটে বসানো | WordPress plugin / raw embed script | Embed widget guide |
| **ResortPro Discover-এ listed হওয়া** | `stay.resortpro.site` marketplace, map listing, featured badge | Discovery platform |

---

## ৫. Admin/Platform Series (P1, internal/support team-এর জন্য — public release না করাই ভালো, কারণ এখানে অন্য tenant-দের data touch করার ক্ষমতা দেখানো হয়)

| Feature | Route |
|---------|-------|
| Tenant management | `/admin/tenants` |
| Billing & MRR dashboard | `/admin/billing` |
| Theme management | `/admin/themes` |
| Design Requests pipeline | `/admin/design-requests` |
| Audit Log | `/admin/audit-log` |
| GDPR tools | `/admin/gdpr` |
| Enterprise settings | `/admin/enterprise` |
| Domain management | `/admin/domains` |
| System Health | `/admin/health` |

⚠️ **সতর্কতা:** এই series-টা public YouTube-এ না দেওয়া ভালো — এখানে অন্য resort-এর real data/settings touch করা দেখানো হবে, যেটা privacy-wise সমস্যা করতে পারে। এটা internal training material হিসেবে রাখা ভালো (unlisted link বা শুধু নিজের team-এর জন্য)।

---

## ৬. Desktop App (P1)

| বিষয় | Reference |
|------|-----------|
| Windows/Mac installer download ও install | Landing page Desktop App section |
| Electron app-এর অফলাইন capability (যদি থাকে) | `mobile-electron-architecture.md` |
| Web version vs Desktop version পার্থক্য | — |

---

## ৭. Master Checklist (এক নজরে — কিছু miss হলে এখানে ধরা পড়বে)

- [ ] Quickstart video
- [ ] Overview group video
- [ ] Rooms & Bookings group video
- [ ] Guests group video
- [ ] Operations group video
- [ ] Restaurant group video
- [ ] Marketing group video
- [ ] Account group video
- [ ] Manager role video
- [ ] Receptionist role video
- [ ] Staff role video
- [ ] Chef role video
- [ ] Marketer role video
- [ ] Developer role video
- [ ] Shareholder role video
- [ ] Website/theme video
- [ ] Custom Design paid-feature video
- [ ] Custom domain/subdomain video
- [ ] Embed widget video
- [ ] Discovery platform (stay.resortpro.site) video
- [ ] Admin panel video (internal only)
- [ ] Desktop app video

---

## ৮. পরের ধাপ

এই doc-টা শুধু **কী কী কভার করা লাগবে তার প্ল্যান** — script/voiceover লেখা এখনো বাকি। যখন actual video বানানো শুরু করবে, বলো — আমি প্রতিটা video-র জন্য:
1. Detailed shot-list/script (কোন screen-এ কী click করবে, কী বলবে)
2. On-screen text/caption suggestion
3. Video title + description (SEO-friendly, YouTube-এর জন্য)

বানিয়ে দিতে পারি — একটা একটা video ধরে এগোলে ভালো হবে।

---

**Status:** Plan only — এখনো কোনো video script/recording শুরু হয়নি। কোডের actual sidebar/admin nav ধরে বানানো (2026-07-28 অনুযায়ী), তাই feature list সঠিক ও up-to-date।
