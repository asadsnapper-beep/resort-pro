# Custom Domain — Strategy & Selling Domains

Resort owner-দের custom domain নিয়ে ঝামেলা কমানো + (পরে) domain বিক্রি করে convenience/lock-in revenue। তিন ধাপে।

> তারিখ: 2026-06-19 · মূল insight: domain **কেনা** না, **DNS configure** করাই আসল ব্যথা। বিক্রি করলে DNS-ও আমরা auto করে দিতে পারি — ওটাই magic।

---

## এখন কী আছে

- Free subdomain: `<slug>.resortpro.site` (subdomain system)
- BYO custom domain: `Tenant.customDomain` + `domainVerified`, `/site/domain/:hostname` resolver, super-admin domains page
- মানে "নিজের domain আনো" flow আছে — কিন্তু owner-কে নিজে DNS record বসাতে হয় (এখানেই আটকায়)

---

## আসল ব্যথা

Domain কেনা কঠিন না — কঠিন **DNS configure** (A/CNAME তোমার server-এ point করানো) + **SSL**। Non-technical owner এখানেই হারিয়ে যায়।

**Domain বিক্রির সবচেয়ে বড় সুবিধা = বিক্রির সাথে DNS auto-config।** আমরা registrar API দিয়ে domain কিনে দিলে record-ও আমরা বসাই → owner কিছু বুঝতেই হবে না।

---

## Phase 1 — BYO flow সহজ করা (এখন, সস্তা, সব plan)

- যাদের custom domain লাগে না → **free subdomain জোরে push** (অধিকাংশ ছোট resort-এর জন্য যথেষ্ট)
- যারা নিজের domain এনেছে:
  - Registrar-ভিত্তিক step-by-step গাইড (GoDaddy/Namecheap/Cloudflare-এর screenshot সহ "কোথায় কী বসাবে")
  - "Verify" button + auto-detect (existing `domainVerified` reuse)
  - স্পষ্ট status: pending / verified / SSL active
- **SSL:** Cloudflare for SaaS (SSL for SaaS) দিয়ে custom domain + auto SSL handle — BYO ও বেচা দুই ক্ষেত্রেই

**Effort:** ছোট। **Value:** সব plan-এ কাজে লাগে।

---

## Phase 2 — Domain বিক্রি (আসল feature)

- **Registrar reseller API** integrate (Namecheap / Porkbun / Name.com — পাইকারি দামে কেনা, established reseller বলে regulatory ঝামেলা ওরা সামলায়)
- Owner dashboard flow:
  ```
  Domain search ("myresort.com available?") 
        ↓
  Buy in-app (payment gateway)
        ↓
  DNS auto-config (registrar API দিয়ে record বসাই)
        ↓
  SSL auto (Cloudflare for SaaS)
        ↓
  Site live — owner শূন্য DNS জ্ঞান নিয়েও
  ```
- **Renewal automation** (critical — নিচে দেখো)

**Effort:** মাঝারি–বড়। **কখন:** কয়েকজন paying customer হলে, demand দেখে।

---

## Phase 3 — Smart bundling (lock-in)

- "Premium plan-এ প্রথম বছর **free .com domain**" → upgrade incentive
- Domain তোমার কাছে → **churn কঠিন** (retention lock-in)
- Subscription-plans doc-এর সাথে যুক্ত

---

## 🔴 সৎ সতর্কতা (ভুলো না)

| ঝুঁকি | কীভাবে সামলাবে |
|------|----------------|
| **Renewal দায়িত্ব তোমার** — lapse করলে resort-এর site মরে যায় | auto-renew + payment-on-file + ৩০/৭/১ দিন আগে reminder + grace period |
| **Domain-এ লাভ কম** (~$10-15/yr commodity) | এটাকে revenue না, **convenience + lock-in + retention** feature ভাবো |
| **Build cost** (API + billing + DNS + renewal) | Phase 2 আগে না — paying customer-এর পর |
| **SSL জটিলতা** | Cloudflare for SaaS দিয়ে offload |
| **Refund/abuse/ICANN নিয়ম** | full registrar না হয়ে reseller API — ওরা সামলায় |

---

## আর্কিটেকচার ইঙ্গিত (Phase 2-এর সময়)

- নতুন model: `TenantDomain` (registrar, purchaseDate, expiresAt, autoRenew, status) — বা existing `customDomain` extend
- Registrar API wrapper: `packages/domain-registry` (payment-registry-র মতো pattern)
- Renewal cron (worker.ts-এ আরেকটা job): expiring domains → charge → renew → notify
- DNS auto-config: registrar API দিয়ে A/CNAME বসানো (target = তোমার ingress/Cloudflare)

---

## Custom Email (domain বিক্রির স্বাভাবিক পরের চাওয়া)

Domain থাকলে owner `info@theirresort.com` চাইবেই। কিন্তু **নিজে mailbox host কোরো না** — spam/storage/deliverability/support আলাদা ভারী ব্যবসা। DNS দিয়ে enable করে দাও, দায়িত্ব নিও না।

দুটো আলাদা level:

### ১. Email পাঠানো (system → guest) — already করি, শুধু auth দরকার
ResortPro booking confirmation/marketing পাঠায় (Resend, `EmailSettings`)। Domain আমাদের হলে **SPF/DKIM/DMARC auto-configure** → mail `@theirresort.com` থেকে যাবে আর **inbox-এ পড়বে, spam-এ না**।
> সরাসরি website-improvements-এর deliverability সমস্যার সমাধান — domain বিক্রির বড় bonus। **এটা আগে করো (সস্তা, বড় প্রভাব)।**

### ২. Email পড়া/লেখা (owner mailbox) — ৩ option

| Option | কী | আমাদের কাজ |
|--------|-----|------------|
| **A. Forwarding** ⭐ | `info@resort.com` → owner-এর Gmail-এ forward | Cloudflare Email Routing (free) — MX auto-বসাই। ৮০% ছোট resort-এর জন্য যথেষ্ট (receiving) |
| **B. Connect Workspace** | Zoho Mail (free tier) / Google Workspace real mailbox | শুধু MX record বসাই; mailbox-এর টাকা owner provider-কে দেয় |
| **C. নিজে host** | আমরা mailbox চালাই | ❌ **কোরো না — too heavy** |

### সুপারিশ
- **#1 (SPF/DKIM auto-config) আগে** — সস্তা, system email deliverability নাটকীয়ভাবে বাড়ায়
- Mailbox: **Forwarding (A) default**; real mailbox চাইলে **Zoho/Workspace connect (B)** guide — আমরা শুধু DNS, hosting না
- Domain Phase 2-এর পর — এখনই দরকার নেই

---

## সুপারিশ (এক লাইনে)

**এখন Phase 1** (BYO সহজ করা + subdomain push + Cloudflare SSL) — সস্তা, সবার কাজে লাগে।
**Phase 2 (বিক্রি) পরে** — paying customer + demand হলে, established registrar API দিয়ে, renewal automation বাধ্যতামূলক।
Domain বিক্রিকে **profit center ভেবো না — retention + "just works" experience ভাবো।**
