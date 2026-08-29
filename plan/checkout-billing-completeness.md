# ResortPro — Checkout-এ পুরো বিল

> **সমস্যাটা নতুন feature-এর অভাব নয়** — টাকা রাখার জায়গা আগেই আছে, কিন্তু
> checkout-এর মুহূর্তে সেই টাকা রিসেপশনিস্টের সামনে আসে না। অতিথি ঘরভাড়া
> মিটিয়ে চলে যান, বাকিটা এমন একটা invoice-এ পড়ে থাকে যেটা কেউ আর খোলে না।

Status: ❌ Not built · আগে করা দরকার, কারণ এতে **আজই টাকা হারাচ্ছে**।

---

## ১. এখন যা আছে

`InvoiceExtra` model (`packages/database/prisma/schema.prisma`) — description +
amount + quantity, booking-এর সাথে বাঁধা। **তিনটে মডিউল নিজে থেকেই এতে লেখে:**

| উৎস | কোথা থেকে |
|---|---|
| Minibar | `dashboard/housekeeping/page.tsx:796` |
| Laundry | `dashboard/housekeeping/page.tsx:949` |
| Vehicle rental | `dashboard/vehicles/page.tsx:556` |
| হাতে লেখা charge | `dashboard/bookings/[id]/invoice/page.tsx:60` — **শুধু এই একটা পাতা থেকে** |

অর্থাৎ "গ্লাস ভেঙেছে — ৫০০" লেখার ঘর **আগে থেকেই আছে**। নতুন field লাগবে না।

---

## ২. আসল সমস্যা — তিন জায়গায় তিন হিসাব

```
Front Desk-এর Check Out বাক্স   →  ঘর − জমা
  apps/web/src/app/(dashboard)/dashboard/front-desk/page.tsx:131

PATCH /api/bookings/:id/check-out →  ঘর + খাবার − জমা
  apps/api/src/routes/bookings.ts:605

GET /api/bookings/:id/invoice     →  ঘর + খাবার + extras + ট্যাক্স
  apps/api/src/routes/bookings.ts:942
```

Invoice-টাই ঠিক। কিন্তু **টাকা তোলা হয় প্রথমটা দেখে** — যেটায় খাবারও নেই,
extras-ও নেই।

ফল: মিনিবার, লন্ড্রি, গাড়ি, ক্ষতিপূরণ — কোনোটাই checkout-এর "Balance due"-তে
আসে না। যে তিনটে মডিউল কষ্ট করে charge জমা করল, তাদের টাকাটাই তোলা হয় না।

> **যাচাই বাকি:** এটা তিনটে handler পড়ে বের করা। কোড লেখার আগে একটা test
> দিয়ে বর্তমান আচরণ ধরে ফেলা উচিত — booking + food order + extra বানিয়ে
> checkout করে দেখা `balanceDue` আসলেই কম আসে কিনা।

---

## ৩. কী করতে হবে

### ধাপ ক — এক জায়গায় হিসাব

একটাই function, তিন জায়গা সেটাই ডাকবে:

```
bill(bookingId) → {
  roomTotal, foodTotal, extrasTotal, taxAmount,
  grandTotal, paidAmount, balanceDue
}
```

ট্যাক্স `Tenant.taxRate` থেকে (ইতিমধ্যে আছে, default 0)। Invoice-এ ট্যাক্স ধরা
হয় কিন্তু checkout-এ হয় না — এই ফারাকটাও এতে মিটবে।

**সাবধান:** এটা টাকার হিসাব বদলাচ্ছে। পুরনো CHECKED_OUT booking-এর হিসাব যেন
পাল্টে না যায় — নতুন হিসাব শুধু চলতি checkout-এ।

### ধাপ খ — Check Out বাক্সে ভাঙা হিসাব দেখানো

```
ঘর (২ রাত)              ৳ 12,750
খাবার                    ৳  1,200
অন্যান্য                 ৳    500   ▸ Minibar: Coke ×2, Broken glass
──────────────────────────────────
মোট                      ৳ 14,450
জমা                     −৳ 12,750
বাকি                     ৳  1,700
```

শুধু মোট নয়, **ভাঙা হিসাব** — অতিথি "এত কেন?" জিজ্ঞেস করলে রিসেপশনিস্ট যেন
invoice পাতায় না ছুটে উত্তর দিতে পারে।

### ধাপ গ — Check Out বাক্স থেকেই charge যোগ করা

"গ্লাস ভেঙেছে" জানার মুহূর্তটা **checkout-এই আসে**। এখন charge যোগ করতে হলে
checkout ছেড়ে invoice পাতায় গিয়ে আবার ফিরতে হয় — ব্যস্ত ডেস্কে কেউ করবে না,
আর করবে না মানেই টাকাটা বসে না।

```
[ + Add charge ]  → বর্ণনা + টাকা  → বিলে যোগ, বাকিটা নতুন করে হিসাব
```

API আগেই আছে (`POST /bookings/:id/invoice/extras`) — শুধু বোতামটা নেই।

দ্রুত বেছে নেওয়ার জন্য কয়েকটা চেনা কারণ রাখা যায় (ক্ষতিপূরণ, extra bed,
তোয়ালে/চাবি হারানো) — তবে টাকার অঙ্ক সবসময় হাতে লেখা, কারণ ভাঙা জিনিসের দাম
এক রকম হয় না।

---

## ৪. যা ইচ্ছে করে বাদ

- **সিকিউরিটি ডিপোজিট** — আলাদা ব্যবস্থা, টাকা আটকে রেখে পরে ফেরত। এখানে নয়।
- **ক্ষতিপূরণের ছবি/প্রমাণ** — দরকারি, কিন্তু document upload আলাদা কাজ।
- **অতিথির স্বাক্ষর** — অন্য আলোচনা।

---

## ৫. সম্পর্কিত

- [housekeeping-extras.md](./housekeeping-extras.md) — মিনিবার/লন্ড্রি যেখান
  থেকে `InvoiceExtra`-তে লেখে
- [early-checkin-late-checkout.md](./early-checkin-late-checkout.md) — ওটার
  চার্জও শেষমেশ এই একই বিলে এসে বসবে, তাই এটা আগে
