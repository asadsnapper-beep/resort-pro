# ResortPro — Launch Marketing Plan

**Date:** 30 June 2026 · **Author:** Full-product audit + business review (see `report.md`)
**Goal:** প্রথম **10 paying resort in 60 days**, তারপর self-serve public launch।
**Grounded in:** এই project-এর আসল অবস্থা — কী আছে (৪০+ module, bKash/SSLCommerz native, public booking site, stay.resortpro.site portal), কী নেই (এখনো ০ customer, কোনো social proof নেই), আর কী শেখা হয়েছে (fake stat দিয়ে shortcut চলবে না — আসল proof লাগবে)।

---

## 1. Positioning — এক লাইনে ResortPro কী

> **"বাংলাদেশের রিসোর্টের জন্য বানানো একমাত্র ম্যানেজমেন্ট প্ল্যাটফর্ম — bKash-এ পেমেন্ট, বাংলায় সাপোর্ট, আর নিজের বুকিং ওয়েবসাইট ১০ মিনিটে।"**

**কেন এটা জেতে (আসল moat, feature-list নয়):**
| তুমি | eZee / Cloudbeds / Little Hotelier |
|---|---|
| bKash + SSLCommerz native | নেই বা জটিল integration |
| বাংলা UI + WhatsApp support | English-only, ticket support |
| ৳ pricing, লোকাল bank/bKash-এ subscription | USD card লাগে |
| stay.resortpro.site → guest demand এনে দেয় | শুধু software, demand আনে না |
| ১০ মিনিটে setup + hand-holding | enterprise onboarding |

**Rule (এই project থেকেই শেখা):** কোনো বানানো সংখ্যা না। "Trusted by 200+" লেখার বদলে ৩টা আসল রিসোর্টের নাম — সেটাই এই plan-এর কাজ।

---

## 2. ICP — ঠিক কাকে বেচব (সবাইকে না)

**Primary:** ৮–৪০ রুমের রিসোর্ট/বুটিক হোটেল, মালিক নিজে চালান বা এক ম্যানেজার দিয়ে, বুকিং এখন **খাতা + WhatsApp screenshot + Facebook page**-এ চলে।
**Geography (এক cluster ধরে):** Cox's Bazar (সবচেয়ে ঘন), তারপর Sylhet/Sreemangal, Sajek, Kuakata।
**Pain (তাদের ভাষায়):** double-booking হয়, advance-এর হিসাব থাকে না, guest রাতে ফোন করে দাম জিজ্ঞেস করে, OTA commission ২০% খেয়ে ফেলে।
**Buying trigger:** পিক সিজনের আগেই (Oct–Feb high season → **September onboarding সবচেয়ে সহজ sell**; এখন June — off-season, মালিকদের হাতে সময় আছে, এটাও সুবিধা)।

**Anti-ICP (এখন না):** ১০০+ রুমের হোটেল চেইন, Dhaka corporate hotel, OTA-dependent city hotel।

---

## 3. Offer — কী দিয়ে ঢুকব

### Founding Resort Offer (প্রথম ১০ জনের জন্য, নাম ধরে সীমিত)
- **৩ মাস অর্ধেক দামে** + আমরা নিজে হাতে setup করে দেব (রুম, রেট, ছবি, মেনু — সব)
- বিনিময়ে: logo ব্যবহারের অনুমতি + ১টা honest testimonial + মাসে ১টা ফিডব্যাক কল
- Guarantee: "১ম মাসে কাজে না লাগলে টাকা ফেরত" (refund policy already live at /refund)

### দাম (BDT, per-room band — report Part II অনুযায়ী)
| Plan | রুম | দাম/মাস | Annual (20% off) |
|---|---|---|---|
| Starter | ≤20 | ৳4,900* | ৳47,040 |
| Professional | ≤100 | ৳9,900* | ৳95,040 |
| Enterprise | unlimited | ৳19,900* | custom |

*বর্তমান code default (BKASH_PRICE_* env)। **সিদ্ধান্ত লাগবে:** এই দাম BD ছোট রিসোর্টের জন্য বেশি হতে পারে — pilot-এ willingness-to-pay টেস্ট করো; দরকার হলে Starter ৳2,500–3,500-এ নামাও। Env দিয়েই বদলানো যায়, deploy লাগবে না।

**Payment:** bKash button (built ✅) + annual-এ জোর (churn কমায়, cash আগে আসে)।

---

## 4. Channels — একটা করে, ক্রমে

### Channel 1 (এখনই): Field sales — Cox's Bazar sprint
BD রিসোর্ট মালিক Google-এ "PMS" খোঁজে না; মুখের কথায় কেনে। তাই:
- ৩ দিনের ট্রিপ, দিনে ৫টা রিসোর্ট ভিজিট, ট্যাবলেটে **/try demo** (এখন কাজ করে ✅) + তাদের নামে ১০ মিনিটে live site বানিয়ে দেখাও — এটাই killer demo: *"এই যে, আপনার রিসোর্টের ওয়েবসাইট এখনই বানিয়ে দিলাম"*
- Script: "খাতায় বুকিং রাখেন? গত মাসে কয়টা double-booking হইসে?" → demo → Founding Offer → ওই দিনই setup
- Target: ২০ ভিজিট → ৫ trial → ৩ paying

### Channel 2 (সমান্তরালে): Facebook + WhatsApp presence
- **Facebook page + ২–৩টা রিসোর্ট-মালিক group** এ সপ্তাহে ২টা value post (বাংলায়): "double-booking বন্ধ করার ৩ উপায়", "OTA commission বাঁচানোর হিসাব" — sell নয়, শেখাও
- **WhatsApp Business number** = primary support + sales line (report Part II: এটা non-negotiable)। Landing-এ WhatsApp button বসাও
- Demo ভিডিও (২ মিনিট, বাংলা, ফোনে ধারণ করা authentic) — landing-এর "Watch demo"-তে এখন আসল ভিডিও নেই, এটা লাগবে

### Channel 3 (মাস ২): Referral loop
- Referral system already built ✅ (admin panel + dashboard) — এটাকে growth engine বানাও: "একটা রিসোর্ট আনলে দুজনেই ১ মাস ফ্রি"
- প্রতি happy pilot-কে জিজ্ঞেস করো: "আপনার পরিচিত আর কোন মালিক আছে?" — এটাই BD-তে আসল distribution

### Channel 4 (মাস ২–৩): stay.resortpro.site demand flywheel
- Portal-এ listed রিসোর্টগুলো promote করো (Facebook boost ৳৫০০/post দিয়ে টেস্ট) → guest বুকিং আসা শুরু করলে pitch পাল্টে যায়: *"আমাদের portal থেকে গেস্টও পাবেন"* — তখন software না, **demand** বেচছ

**এখন যা করব না:** Google Ads, SEO-first, cold email, international market — সব পরে।

---

## 5. Launch sequence — সপ্তাহ ধরে

### Week 1 (এই সপ্তাহ): Ship + Pilot প্রস্তুতি
- [ ] dev → staging টেস্ট → **main push** (production live হয় নতুন সব fix সহ)
- [ ] Infra: Resend verify (email চালু), bKash merchant creds, দাম চূড়ান্ত
- [ ] WhatsApp Business number চালু, landing-এ বসানো
- [ ] ২ মিনিটের বাংলা demo ভিডিও
- [ ] Pilot target list: চেনা-পরিচিত + Facebook থেকে ১০টা রিসোর্টের নাম

### Week 2: ৩টা pilot onboard (hand-holding)
- নিজে setup করে দাও (রুম/রেট/ছবি/মেনু) — activation ১০০% নিশ্চিত করো
- প্রথম আসল online booking আসা পর্যন্ত পাশে থাকো — সেটাই তাদের "aha moment"
- প্রতিটা friction নোট করো → product fix list

### Week 3: Proof তৈরি
- ৩ pilot-এর logo landing-এর trust strip-এ (এখন payment partner আছে — আসল রিসোর্ট logo দিয়ে আপগ্রেড)
- ১টা ভিডিও/লিখিত testimonial + ১টা সংখ্যাসহ mini case study ("X রিসোর্ট ৩ সপ্তাহে ৪০টা online booking নিয়েছে")
- Benefit cards → আসল testimonial-এ swap (landing-এর ওই section আবার সত্যি quote পাবে)

### Week 4: Cox's Bazar field sprint + public
- ৩ দিনের field trip (উপরের script)
- Facebook post cadence শুরু
- Public self-serve signup announce (proof এখন আসল)

### Month 2–3: Scale যা কাজ করে
- Referral push, portal flywheel, Sylhet/Sreemangal cluster
- Metrics দেখে decide (নিচে)

---

## 6. Assets checklist (marketing-এর কাঁচামাল)

| Asset | অবস্থা | Owner |
|---|---|---|
| Landing page (honest copy) | ✅ done | — |
| Legal pages | ✅ done (lawyer review বাকি) | তুমি |
| /try role-based demo | ✅ কাজ করে | — |
| বাংলা landing (/bn) | ✅ আছে | — |
| ২-মিনিট বাংলা demo ভিডিও | ❌ | তুমি (ফোনেই হবে) |
| WhatsApp Business + landing button | ❌ | তুমি + আমি (button আমি বসাতে পারি) |
| Pilot pitch one-pager (বাংলা PDF) | ❌ | আমি লিখে দিতে পারি |
| Field sales script (বাংলা) | ❌ | আমি লিখে দিতে পারি |
| Facebook post series (৮টা draft) | ❌ | আমি লিখে দিতে পারি |
| Case study template | ❌ | আমি |

---

## 7. Metrics — মাত্র ৪টা সংখ্যা দেখো

| Metric | Target (৬০ দিন) | কোথায় দেখবে |
|---|---|---|
| Paying resorts | 10 | Admin → Billing/MRR ✅ built |
| Activation (signup → live booking page <24h) | >60% | এখন manually; পরে instrument |
| Trial → paid | >30% (pilot-এ hand-holding সহ) | Admin panel |
| Monthly churn | <5% | Admin panel |

**সাপ্তাহিক রিচুয়াল:** প্রতি রবিবার এই ৪টা সংখ্যা লেখো। যেটা আটকে আছে, পরের সপ্তাহ শুধু সেটায় কাজ।

---

## 8. Budget (প্রথম ৬০ দিন, বাস্তবসম্মত)

| খাত | আনুমানিক |
|---|---|
| Cox's Bazar ট্রিপ (৩ দিন) | ৳15–25k |
| Facebook boost টেস্ট | ৳5–10k |
| Domain/email/infra (Resend free tier-এ শুরু) | ~৳0–3k |
| Founding discount-এর revenue ছাড় | pricing-এ ধরা |
| **মোট** | **~৳25–40k** — ৩টা paying Starter-এই উঠে আসে |

---

## Bottom line

Product তৈরি, সব P0 code-complete। এখন marketing মানে ad নয় — **৩টা আসল রিসোর্ট, তাদের আসল ফলাফল, তারপর সেই গল্পটাই সব জায়গায় বলা।** এই plan-এর প্রতিটা ধাপ সেই এক লক্ষ্যে: fake proof সরিয়েছি, এবার আসল proof বানাব।

**তোমার এই সপ্তাহের ৩টা কাজ:** (1) main-এ push + infra (Resend/bKash), (2) WhatsApp number + demo ভিডিও, (3) ১০টা pilot-target রিসোর্টের list। বাকি assets (script, one-pager, FB posts) আমি লিখে দেব — বললেই শুরু করি।
