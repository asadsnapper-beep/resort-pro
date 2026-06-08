# Role & Permission Architecture — ResortPro
**বাংলাদেশের resort context-এ কে কী করবে, সেটা নিয়ে গভীর চিন্তা**

---

## ১. বর্তমান Roles-এর সমস্যা

### বর্তমানে যা আছে:
```
OWNER → MANAGER → SHAREHOLDER → RECEPTIONIST → MARKETER → DEVELOPER → STAFF
```

### সমস্যাগুলো:

| Role | সমস্যা |
|------|--------|
| `STAFF` | অনেক বেশি broad — housekeeping + restaurant + maintenance সব একসাথে। একজন kitchen staff কেন হাউসকিপিং দেখবে? |
| `PARTNER` | নামটা কিছুটা confusing হতে পারে — তবে এই role টা **আসলে জরুরি** (দেখো section ৩)। নাম পরিবর্তন বিবেচনা করা যায়। |
| `DEVELOPER` | খুব niche — বাংলাদেশের 99% resort-এ dedicated developer নেই। এই role-এর মানুষ actually OWNER বা MANAGER-ই হবে যে embed setup করবে |
| Financial gap | কোনো `ACCOUNTANT` role নেই — অথচ বাংলাদেশের মাঝারি resort-এ আলাদা accountant বা finance staff থাকে যে invoice, expense, payment দেখে কিন্তু bookings manage করে না |

---

## ২. বাংলাদেশের Real Resort Staff Structure

```
একটা ছোট resort (10-20 রুম):
  ├── মালিক (Owner) — সব কিছু
  ├── ম্যানেজার — দৈনন্দিন চালনা
  ├── রিসেপশনিস্ট ×২ — শিফটে কাজ
  ├── হাউসকিপিং স্টাফ ×৩-৫ — রুম পরিষ্কার
  └── রেস্টুরেন্ট স্টাফ ×২-৩ — খাবার সার্ভ

একটা মাঝারি resort (20-50 রুম):
  ├── Owner
  ├── General Manager
  ├── Accounts Manager / Accountant  ← এই role এখন নেই!
  ├── Marketing Executive  ← MARKETER
  ├── Front Desk Supervisor + Receptionists
  ├── Housekeeping Supervisor + Staff
  ├── Restaurant Manager + Waiters
  └── Maintenance Staff

একটা বড় resort:
  ├── Owner / Board
  ├── GM
  ├── HODs (Department Heads)
  └── প্রতিটা বিভাগের staff
```

---

## ৩. প্রস্তাবিত নতুন Role Structure

### Option A — মিনিমাল (৬ roles) — **Recommended ✅**

```
OWNER
MANAGER
SHAREHOLDER   ← PARTNER rename (✅ সিদ্ধান্ত নেওয়া হয়েছে)
RECEPTIONIST
MARKETER
STAFF         ← ভেঙে দুটো না করে, sub-access দিয়ে control করব
```

**কেন ৬?**
- `DEVELOPER` বাদ দিয়ে OWNER/MANAGER-এ merge করলে complexity কমে
- `SHAREHOLDER` নাম PARTNER-এর চেয়ে অনেক বেশি clear ও precise
- `STAFF` রেখে দিই কিন্তু login করলে সে শুধু নিজের department দেখবে (future: staff profile-এ department tag)

---

### Option B — বিস্তারিত (৮ roles)

```
OWNER
MANAGER
SHAREHOLDER     ← PARTNER rename (✅ confirmed)
RECEPTIONIST
HOUSEKEEPING    ← STAFF ভেঙে আলাদা
RESTAURANT      ← STAFF ভেঙে আলাদা
MARKETER
DEVELOPER       ← রাখা হবে embed-এর জন্য
```

**কেন ৮?**
- Staff-কে আরো specific করা যায়
- Kitchen staff যেন housekeeping না দেখে
- কিন্তু: বেশি roles = staff invite করতে গেলে confusing

---

### Option C — Hybrid (৭ roles) — **Best Balance**

```
OWNER
MANAGER
SHAREHOLDER     ← PARTNER rename (✅ confirmed)
RECEPTIONIST
MARKETER
STAFF           ← রাখি, কিন্তু staff profile-এ department দিয়ে filter
DEVELOPER       ← রাখি, সুনির্দিষ্ট technical access
```

**এটাই সবচেয়ে balanced কারণ:**
- `DEVELOPER` রাখলে: embed widget, website integration, API settings-এর জন্য আলাদা access দেওয়া যায় — ভবিষ্যতে useful
- `STAFF` রাখলে: সব operations staff এক role-এ ম্যানেজ হয়
- `ACCOUNTANT` rename করলে: সবাই বুঝবে কে কী করে

---

## ৪. Access Matrix — Option C (Recommended)

| Feature / Page | OWNER | MANAGER | SHAREHOLDER | RECEPTIONIST | MARKETER | DEVELOPER | STAFF |
|----------------|:-----:|:-------:|:-----------:|:------------:|:--------:|:---------:|:-----:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Analytics** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Invoices** | ✅ | ✅ | ✅ | ✅ view | ❌ | ❌ | ❌ |
| **Expenses** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Daily Reports** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Rooms & Villas** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ status only |
| **Rate Plans** | ✅ | ✅ | ❌ | ❌ | ✅ view | ❌ | ❌ |
| **Packages** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Bookings** | ✅ | ✅ | ✅ view | ✅ | ❌ | ❌ | ❌ |
| **Booking Calendar** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Group Bookings** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Channel Sync** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Guests** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Loyalty** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Support Tickets** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Staff Management** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Housekeeping** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Maintenance** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Restaurant** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **F&B Orders** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Inventory** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **CRM & Email** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **SMS Marketing** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Website** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Billing** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Settings** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

---

## ৫. প্রতিটি Role-এর বিস্তারিত বিবরণ

### 👑 OWNER — রিসোর্ট মালিক
- **কে ব্যবহার করে:** Resort-এর মালিক বা CEO
- **Access:** সব কিছু — billing, settings, সব delete করার ক্ষমতা
- **বাংলাদেশ context:** সাধারণত নিজেই manage করেন বা trusted ম্যানেজারকে MANAGER role দেন
- **সংখ্যা:** ১ জন (প্রতি resort)

### 👔 MANAGER — জেনারেল ম্যানেজার
- **কে ব্যবহার করে:** Hotel Manager, Resort Manager, Operations Head
- **Access:** Billing বাদে সব — staff manage, booking manage, report দেখা
- **বাংলাদেশ context:** অনেক সময় owner-ই manager, বা trusted পরিচিত কাউকে দেওয়া হয়
- **সংখ্যা:** ১-২ জন

### 📊 SHAREHOLDER — শেয়ারহোল্ডার / নীরব বিনিয়োগকারী
*(আগের নাম: PARTNER — ✅ SHAREHOLDER-এ rename confirmed)*
- **কে ব্যবহার করে:** Silent investor, co-owner, family member যে টাকা দিয়েছে কিন্তু operation-এ নেই
- **Access:** Dashboard overview, Analytics, Revenue reports, Expense overview — **শুধু দেখা, কোনো action নেই**
- **বাংলাদেশ context:** একটা resort-এ প্রায়ই ২-৩ জন shareholder থাকে। তারা প্রতি মাসে occupancy, revenue, profit জানতে চায়
- **সীমাবদ্ধতা:** কোনো booking করতে পারবে না, কোনো কিছু edit/delete করতে পারবে না — pure read-only
- **সংখ্যা:** ১-৫ জন (প্রতি resort)

### 🛎️ RECEPTIONIST — রিসেপশনিস্ট / ফ্রন্ট ডেস্ক
- **কে ব্যবহার করে:** Front desk officer, reservation agent
- **Access:** Booking, Calendar, Check-in/out, Guest, Invoice, Support, Housekeeping (দেখা), F&B orders
- **বাংলাদেশ context:** শিফটে কাজ করে — সকাল/রাত। ২-৩ জন থাকে
- **সংখ্যা:** ২-৫ জন

### 📣 MARKETER — মার্কেটিং ম্যানেজার
- **কে ব্যবহার করে:** Marketing executive, social media manager, digital marketer
- **Access:** Website, CRM, Email campaigns, SMS Marketing, Guests (read), Rate Plans (read), Analytics
- **বাংলাদেশ context:** ছোট resort-এ owner বা manager-ই করে; বড় resort-এ আলাদা marketing team
- **সংখ্যা:** ১-২ জন

### 💻 DEVELOPER — ডেভেলপার / IT
- **কে ব্যবহার করে:** IT staff, web developer যে embed widget বা website integration করছে
- **Access:** Settings (embed, API keys), Website, Channel Sync (technical)
- **বাংলাদেশ context:** অনেক সময় third-party agency বা freelancer যে initial setup করে দেয়
- **সংখ্যা:** ১ জন (external/temporary)
- **Note:** এই role সাধারণত permanent না — setup শেষে revoke করা যায়

### 🧹 STAFF — অপারেশন স্টাফ
- **কে ব্যবহার করে:** Housekeeping worker, restaurant waiter, maintenance person
- **Access:** Housekeeping tasks, Maintenance, Restaurant, F&B Orders, Inventory, Support (respond করা)
- **বাংলাদেশ context:** সবচেয়ে বেশি সংখ্যক — ৫-২০ জন পর্যন্ত
- **সীমাবদ্ধতা:** Guest personal info দেখতে পাবে না (শুধু room number ও task)
- **Future:** Staff profile-এ department tag দিয়ে শুধু relevant task দেখানো

---

## ৬. SHAREHOLDER Role — কেন এটা রাখা জরুরি
*(আগের নাম: PARTNER)*

### বাস্তব scenario (Bangladesh context)
একটা resort-এ প্রায়ই একাধিক shareholder থাকে:
```
উদাহরণ:
  মালিক: করিম সাহেব (৬০% share) → OWNER
  শেয়ারহোল্ডার ১: রহিম সাহেব (২৫% share) → SHAREHOLDER
  শেয়ারহোল্ডার ২: জামাল সাহেব (১৫% share) → SHAREHOLDER
```

রহিম ও জামাল সাহেব:
- টাকা দিয়েছেন কিন্তু daily operation-এ নেই
- প্রতি মাসে জানতে চান: occupancy কত? revenue কত? profit কেমন?
- কোনো booking করবেন না, staff manage করবেন না
- শুধু **দেখার অধিকার** আছে — action নেওয়ার নয়

এই role **না থাকলে:**
- Owner-কে প্রতি মাসে manually screenshot বা Excel পাঠাতে হবে
- Investor-কে manager-এর access দিলে রিস্ক বাড়ে
- Trust ও transparency কমে

### PARTNER-এর নাম নিয়ে চিন্তা

`PARTNER` শব্দটা একটু ambiguous। বিকল্প নামগুলো:

| বিকল্প নাম | সুবিধা | অসুবিধা |
|------------|--------|---------|
| `PARTNER` (আগের নাম) | সহজ, পরিচিত | "Full access partner" মনে হতে পারে |
| `INVESTOR` | একদম clear — টাকা দিয়েছে, দেখবে | অনেক resort-এ family share থাকে, investor মনে হয় না |
| ✅ `SHAREHOLDER` | Formal, precise — শেয়ার আছে, দেখার অধিকার আছে | — |
| `SILENT_PARTNER` | সবচেয়ে descriptive | Underscore আছে, long |
| `VIEWER` | Technical, clear | কোনো আবেগ নেই, flat |

**✅ সিদ্ধান্ত নেওয়া হয়েছে: `SHAREHOLDER`**
UI-তে দেখাবে "**Shareholder**" — বাংলায় "শেয়ারহোল্ডার / বিনিয়োগকারী"।

> ⚠️ **এখনো implement করা হয়নি।** Plan confirm হয়েছে — implement করার নির্দেশ এলে করা হবে।

### PARTNER-এর Access (বর্তমান ও প্রস্তাবিত)

| Feature | বর্তমান | প্রস্তাবিত (কোনো বদল নেই) |
|---------|---------|--------------------------|
| Dashboard overview | ✅ | ✅ |
| Analytics (revenue, occupancy) | ✅ | ✅ |
| Monthly/yearly reports | ❌ নেই | ✅ যোগ করা উচিত |
| Expense overview | ❌ নেই | ✅ যোগ করা উচিত (read-only) |
| Bookings | ❌ | ❌ |
| Staff | ❌ | ❌ |
| Settings | ❌ | ❌ |
| Any write/create/delete | ❌ | ❌ সবসময় |

**একটাই কাজ: দেখা। কোনো action নেই।**

---

## ৭. Staff Invite Flow — কীভাবে কাজ করবে

```
Owner → Settings → Staff → Invite Staff
  ├── Email দেবে
  ├── Role select করবে (dropdown)
  │     Owner
  │     Manager
  │     Accountant       ← (আগের Partner)
  │     Receptionist
  │     Marketer
  │     Developer
  │     Staff
  └── Invite পাঠাবে → Staff email-এ link পাবে → Password set করবে
```

**Role description tooltip (invite করার সময় দেখাবে):**
- প্রতিটা role-এর পাশে ছোট "?" icon — hover করলে বলবে কী দেখতে পাবে

---

## ৮. Implementation Plan

### Phase 1 — Schema & Backend (৩-৪ ঘণ্টা)
- [ ] `UserRole` enum-এ `PARTNER` → `SHAREHOLDER` rename করো
  - Migration: existing PARTNER users → SHAREHOLDER
- [ ] API routes সব জায়গায় `PARTNER` → `SHAREHOLDER` replace করো
- [ ] Staff invite endpoint-এ updated role include করো

### Phase 2 — Sidebar & UI (২ ঘণ্টা)
- [ ] `sidebar.tsx`-এ `PARTNER` → `SHAREHOLDER` rename
- [ ] SHAREHOLDER-এর জন্য সঠিক page access দাও (access matrix অনুযায়ী)
- [ ] Staff invite modal-এ role description যোগ করো

### Phase 3 — Demo Update (১ ঘণ্টা)
- [ ] `seed-demo.ts`-এ PARTNER → SHAREHOLDER rename
- [ ] Demo role picker page-এ ACCOUNTANT card update করো

### Phase 4 — Settings Page (২ ঘণ্টা)
- [ ] Settings → Staff section-এ role badge color update
- [ ] Role filter dropdown update

---

## ৯. Role Badge Colors (UI consistency)

| Role | Badge Color | Icon |
|------|------------|------|
| OWNER | 🟢 resort-green (dark) | 👑 |
| MANAGER | 🔵 blue | 👔 |
| ACCOUNTANT | 🟡 amber/gold | 💰 |
| RECEPTIONIST | 🟣 purple | 🛎️ |
| MARKETER | 🩷 pink | 📣 |
| DEVELOPER | ⚫ slate/dark | 💻 |
| STAFF | 🟠 orange | 🧹 |

---

## ১০. সিদ্ধান্ত নিতে হবে

এই plan implement করার আগে confirm করো:

1. **PARTNER-এর নাম কী হবে?**
   > ✅ **সিদ্ধান্ত: `SHAREHOLDER`** — `PARTNER` → `SHAREHOLDER` rename করা হবে।
   > UI label: "Shareholder / শেয়ারহোল্ডার"

2. **ACCOUNTANT role আলাদা করে বানাব?**
   - হ্যাঁ হলে: নতুন role যোগ হবে — invoice, expense, payment read access
   - না হলে: Accountant-কে MANAGER access দিতে হবে (বেশি access পাবে)
   > এখন নেই, later করা যাবে।

3. **DEVELOPER role রাখব নাকি OWNER/MANAGER-এ merge করব?**
   - রাখলে: embed, API, website — আলাদা technical person-এর জন্য
   - Remove করলে: simplify হয়, owner নিজেই করবে

4. **STAFF role split করব (HOUSEKEEPING + RESTAURANT)?**
   - Split করলে: kitchen staff আর HK staff আলাদা dashboard দেখবে
   - না করলে: এক STAFF role-ই থাকবে, সবাই একই দেখবে

---

*See also: [sms-whatsapp-notifications.md](./sms-whatsapp-notifications.md)*
*See also: [sms-whatsapp-marketing.md](./sms-whatsapp-marketing.md)*
