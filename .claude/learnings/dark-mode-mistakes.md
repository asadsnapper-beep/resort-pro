# Dark Mode Mistakes — ResortPro

এই project এ dark mode করতে গিয়ে বারবার একই ভুল হয়েছে। ভবিষ্যতে যেন না হয়।

---

## ভুল ১ — Modal এর `bg-white` dark mode এ override হয় না

**কখন হয়:** `createPortal` দিয়ে render হওয়া modals — `NewBookingModal`, `WalkInModal` ইত্যাদি।

**কেন হয়:** `globals.css` এ `.dark main .bg-white` শুধু `<main>` এর ভেতরে কাজ করে। Portal `document.body` তে render হয়, তাই এই rule apply হয় না।

**Fix:**
```tsx
// ❌ ভুল
<div className="bg-white rounded-2xl">

// ✅ সঠিক
<div className="bg-white dark:bg-[#1a2e2a] rounded-2xl">
```

**Rule:** Portal-rendered component এ সব সময় explicit `dark:bg-[#1a2e2a]` দিতে হবে।

---

## ভুল ২ — `hover:bg-[#faf9f7]` dark mode এ সাদা দেখায়

**কখন হয়:** Table rows, list items — যেকোনো jagaye hover color দেওয়া হয়েছে।

**কেন হয়:** `#faf9f7` light mode এ near-white, কিন্তু dark background এ সাদা দেখায়।

**Fix:**
```tsx
// ❌ ভুল
className="hover:bg-[#faf9f7]"

// ✅ সঠিক
className="hover:bg-[#faf9f7] dark:hover:bg-white/5"
```

**কোন কোন file এ ছিল:** 14টা file — dashboard, bookings, housekeeping, invoices, expenses, crm, loyalty, inventory, staff, orders, reports, front-desk, guests, rate-plans.

---

## ভুল ৩ — Tailwind className হিসেবে দেওয়া color `globals.css` override ছাড়া dark এ কাজ করে না

**কখন হয়:** `className="text-[#18231f]"` বা `className="bg-[#f5f4f1]"` — এগুলো inline style নয়, className।

**কেন হয়:** `useTheme` বা CSS variable ছাড়া এগুলো সবসময় light mode color দেখাবে।

**Fix দুইটা আছে:**
1. `globals.css` এ override rule যোগ করো: `.dark .text-\[\#18231f\] { color: var(--rp-text) !important; }`
2. অথবা directly `var(--rp-*)` token use করো `style={{ color: 'var(--rp-text)' }}`

---

## ভুল ৪ — Hardcoded hex color inline style এ দিলে dark mode কাজ করে না

**কখন হয়:** `style={{ color: '#18231f' }}` বা `style={{ background: '#faf9f7' }}`

**Fix:**
```tsx
// ❌ ভুল
style={{ color: '#18231f' }}

// ✅ সঠিক
style={{ color: 'var(--rp-text)' }}
```

**Available tokens:** `globals.css` এ `--rp-text`, `--rp-surface`, `--rp-border` ইত্যাদি define করা আছে।

---

## ভুল ৫ — `useTheme` ছাড়া conditional dark mode

**কখন দরকার:** যখন CSS token দিয়ে হয় না — যেমন stock number color (low = red, normal = dark text)।

```tsx
import { useTheme } from 'next-themes';
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';

// তারপর:
style={{ color: isLow ? '#c43c3c' : isDark ? '#dfd9d0' : '#18231f' }}
```

**সতর্কতা:** `resolvedTheme` use করো, `theme` নয় — system theme handle করে।
