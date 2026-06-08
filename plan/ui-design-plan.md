# ResortPro — UI Design Master Plan

> এই plan টা features complete হওয়ার পর Claude দিয়ে পুরো UI redesign করার জন্য।
> প্রতিটা section-এ exact instruction আছে — কী বদলাবে, কীভাবে বদলাবে।

---

## Project snapshot (design করার আগে জানো)

**Stack:** Next.js 14, Tailwind CSS, shadcn/ui components, Recharts, Lucide icons
**Fonts:** Inter (body) + Playfair Display (headings) — already installed
**Brand colors:**
- Resort green: `#1a6b5e` (dark), `#309485` (mid), `#50b09f` (light)
- Gold: `#d4a853` (primary), `#f0c55a` (bright), `#b8893f` (dark)
- Tailwind classes: `resort-{50..900}`, `gold-{400,500,600}`

**Current UI এর সমস্যা:**
- Dashboard দেখতে generic SaaS tool — resort/hospitality feel নেই
- Sidebar সাদা, flat — premium feel নেই
- Stat cards monotonous — সব একরকম দেখায়
- Pages গুলো functional কিন্তু boring
- Landing page আছে কিন্তু visual hierarchy weak

**লক্ষ্য:** Generic SaaS → Premium Hospitality Management Platform

---

## Design Direction

### Theme: "Warm Luxury"
- **মূল অনুভূতি:** একটা 5-star resort-এর management room যেখানে কাজ করা pleasurable
- **না:** Cold, corporate, generic blue SaaS
- **হ্যাঁ:** Warm greens, gold accents, soft shadows, elegant typography

### Visual Language
- **Radius:** `rounded-2xl` বেশি ব্যবহার (current `rounded-xl` থেকে upgrade)
- **Shadow:** `shadow-sm` → rich layered shadows — `shadow-[0_2px_12px_rgba(26,107,94,0.08)]`
- **Borders:** হালকা `border-resort-100/50` — harsh gray border নয়
- **Backgrounds:** Pure white না, warm `#fafaf9` (stone-50) — আরও comfortable
- **Gradients:** Sidebar ও header-এ subtle resort-green gradient

---

## Design Tokens (সব জায়গায় consistent রাখো)

```css
/* Backgrounds */
--bg-app: #fafaf9;          /* main app background (stone-50 shade) */
--bg-sidebar: #0f3d36;      /* dark green sidebar */
--bg-card: #ffffff;         /* card background */
--bg-card-hover: #f7faf9;   /* card hover */

/* Resort brand */
--resort-primary: #1a6b5e;
--resort-mid: #309485;
--resort-light: #50b09f;
--gold-primary: #d4a853;
--gold-bright: #f0c55a;

/* Text */
--text-heading: #0f2d27;    /* near-black with green tint */
--text-body: #374151;       /* gray-700 */
--text-muted: #9ca3af;      /* gray-400 */

/* Status colors (keep as is) */
--status-green: emerald-500
--status-yellow: amber-500
--status-red: red-500
--status-blue: blue-500
```

---

## Phase 1 — Foundation (এটা আগে করো)

### 1A. globals.css update

```css
/* পুরনো bg-white body → warm off-white */
body { background: #fafaf9; }

/* Sidebar এর জন্য নতুন CSS variable */
:root {
  --sidebar-bg: #0f3d36;
  --sidebar-text: rgba(255,255,255,0.75);
  --sidebar-active: rgba(212,168,83,0.15);
  --sidebar-active-text: #f0c55a;
  --card-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(26,107,94,0.06);
}
```

### 1B. tailwind.config.ts additions

Add these to the `extend.colors` section:
```ts
stone: colors.stone,  // import colors from tailwindcss/colors
sidebar: {
  bg: '#0f3d36',
  text: 'rgba(255,255,255,0.75)',
  border: 'rgba(255,255,255,0.08)',
},
```

Add custom shadow:
```ts
boxShadow: {
  'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(26,107,94,0.06)',
  'card-hover': '0 4px 24px rgba(26,107,94,0.12)',
  'sidebar': '4px 0 24px rgba(0,0,0,0.15)',
}
```

---

## Phase 2 — Sidebar Redesign

**File:** `apps/web/src/components/dashboard/sidebar.tsx`

### Design spec:

```
Background: bg-[#0f3d36] (dark resort green)
Width: w-64 (keep)
Shadow: shadow-sidebar (right-side glow)
Border: none (remove border-r)
```

**Logo area:**
```tsx
/* পুরনো: white bg, gray border */
/* নতুন: */
<div className="flex h-16 items-center gap-3 px-5 border-b border-white/8">
  {/* Logo icon */}
  <div className="flex h-9 w-9 items-center justify-center rounded-xl 
      bg-gradient-to-br from-gold-400 to-gold-600 
      font-display text-lg font-bold text-resort-900 shadow-md">
    R
  </div>
  <div>
    <p className="text-sm font-semibold text-white truncate">{tenant?.name}</p>
    <p className="text-xs text-white/40 capitalize">{plan} plan</p>
  </div>
</div>
```

**Nav group headers:**
```tsx
/* পুরনো: gray-400 text */
/* নতুন: */
<span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/30">
  {group}
</span>
```

**Nav items:**
```tsx
/* Inactive: */
className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm 
           font-medium text-white/60 hover:bg-white/8 hover:text-white 
           transition-all duration-150"

/* Active: */
className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm 
           font-medium bg-gold-500/15 text-gold-400 
           border border-gold-500/20"
/* Active icon gets text-gold-400 */
```

**User footer:**
```tsx
/* পুরনো: white/gray */
/* নতুন: border-t border-white/8, dark bg */
<div className="border-t border-white/8 p-4">
  <div className="flex items-center gap-3">
    {/* Avatar: gold background */}
    <div className="h-8 w-8 rounded-full bg-gold-500/20 border border-gold-500/30 
                    text-xs font-bold text-gold-400 flex items-center justify-center">
      {initials}
    </div>
    <div>
      <p className="text-sm font-medium text-white">{name}</p>
      <span className="text-[10px] text-gold-400/80">{role}</span>
    </div>
    <LogOut className="text-white/30 hover:text-white/70" />
  </div>
</div>
```

---

## Phase 3 — Top Navigation

**File:** `apps/web/src/components/dashboard/top-nav.tsx`

### Design spec:
```
Background: bg-white border-b border-resort-50
Height: h-16
Shadow: none (sidebar provides left shadow)
```

**Changes:**
- Search bar: rounded-full, bg-stone-50 border-stone-200
- Notification bell: badge style — `bg-resort-500 text-white` dot
- User avatar: resort-green gradient background
- Breadcrumb: show current page name with resort-600 color

---

## Phase 4 — Dashboard Home Page

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx`

### Header section:
```tsx
/* পুরনো: plain h1 */
/* নতুন: */
<div className="flex items-center justify-between">
  <div>
    <h1 className="font-display text-2xl font-bold text-gray-900">
      Good morning, {user?.firstName}
    </h1>
    <p className="mt-1 text-sm text-muted-foreground">
      {day} · {date} · {weather_emoji} Resort overview
    </p>
  </div>
  {/* Quick action buttons */}
  <div className="flex items-center gap-2">
    <button className="btn-secondary">New Booking</button>
    <button className="btn-primary">Check In Guest</button>
  </div>
</div>
```

### Stat Cards redesign:
পুরনো সব cards একরকম। নতুনে ৩টা variant থাকবে:

**Hero cards (top 4 — bigger):**
```tsx
/* Occupancy Rate — special hero card */
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br 
    from-resort-700 to-resort-900 p-6 text-white shadow-card col-span-2">
  <div className="absolute right-0 top-0 h-32 w-32 rounded-full 
      bg-white/5 -translate-y-8 translate-x-8" /> {/* decorative circle */}
  <p className="text-sm text-white/60">Occupancy Rate</p>
  <p className="mt-2 font-display text-4xl font-bold">{rate}%</p>
  <div className="mt-4 flex items-center gap-2 text-sm">
    <span className="text-emerald-400">↑ {growth}%</span>
    <span className="text-white/40">vs last month</span>
  </div>
</div>

/* Monthly Revenue — gold accent card */
<div className="rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 
    p-6 text-resort-900 shadow-card">
  <p className="text-sm font-medium text-resort-900/60">Monthly Revenue</p>
  <p className="mt-2 font-display text-3xl font-bold">{formatCurrency(revenue)}</p>
</div>
```

**Standard metric cards (remaining 5):**
```tsx
<div className="rounded-2xl bg-white p-5 shadow-card hover:shadow-card-hover 
    transition-shadow border border-resort-50">
  <div className="flex items-start justify-between">
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
    {/* Icon: colored background, no plain white bg */}
    <div className="rounded-xl p-2.5 {color}/15">
      <Icon className="h-5 w-5 {color-text}" />
    </div>
  </div>
</div>
```

### Charts section:
```
Revenue chart: stroke color → #309485, gradient fill → resort-500/10
Bar chart: fill → #309485, hover → #1a6b5e
Chart container: rounded-2xl bg-white shadow-card
Chart title: font-display font-semibold
```

### Today's Arrivals/Departures cards:
```
Card: rounded-2xl bg-white shadow-card
Guest row: rounded-xl hover:bg-resort-50/50 transition
Avatar: 
  - Arrivals: bg-resort-100 text-resort-700
  - Departures: bg-indigo-100 text-indigo-700
Status pill: rounded-full text-xs font-semibold
```

---

## Phase 5 — Auth Pages

**Files:** `apps/web/src/app/auth/*/page.tsx`

### Current state: Already good! Minimal changes needed.

**Improvements:**
1. Logo icon — আরও polish:
```tsx
/* পুরনো: simple square */
/* নতুন: gradient with subtle glow */
<div className="mx-auto mb-4 relative">
  <div className="absolute inset-0 rounded-2xl bg-gold-500/30 blur-xl" />
  <div className="relative flex h-16 w-16 items-center justify-center 
      rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 
      font-display text-3xl font-bold text-resort-900 shadow-lg">
    R
  </div>
</div>
```

2. Background — add subtle texture:
```tsx
/* পুরনো: flat gradient */
/* নতুন: */
<div className="min-h-screen bg-gradient-to-br from-resort-950 via-resort-900 to-resort-800 
    relative overflow-hidden">
  {/* Decorative blobs */}
  <div className="absolute top-0 right-0 h-96 w-96 rounded-full 
      bg-gold-500/5 blur-3xl -translate-y-48 translate-x-48" />
  <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full 
      bg-resort-400/10 blur-3xl translate-y-48 -translate-x-48" />
  ...form content...
</div>
```

3. Form card glass effect — enhance:
```tsx
/* নতুন: stronger glass */
className="rounded-3xl border border-white/8 bg-white/6 p-8 
           backdrop-blur-md shadow-2xl shadow-black/20"
```

4. Input fields:
```tsx
/* নতুন: show focus better */
className="border-white/12 bg-white/8 text-white placeholder:text-white/25 
           focus-visible:ring-2 focus-visible:ring-gold-400/50 
           focus-visible:border-gold-400/50 focus-visible:bg-white/12"
```

---

## Phase 6 — Landing Page

**File:** `apps/web/src/app/page.tsx`

### Hero Section redesign:

```tsx
/* নতুন hero: full-screen, immersive */
<section className="relative min-h-screen bg-gradient-to-br 
    from-resort-950 via-resort-900 to-resort-800 
    flex items-center overflow-hidden">
  
  {/* Ambient background blobs */}
  <div className="absolute top-20 right-20 h-[600px] w-[600px] rounded-full 
      bg-gold-500/8 blur-[100px]" />
  <div className="absolute bottom-20 left-20 h-[400px] w-[400px] rounded-full 
      bg-resort-400/10 blur-[80px]" />
  
  <div className="relative z-10 container mx-auto px-6 py-24">
    <div className="max-w-3xl">
      {/* Badge */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full 
          border border-gold-500/30 bg-gold-500/10 px-4 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400 animate-pulse" />
        <span className="text-sm font-medium text-gold-400">
          Bangladesh's #1 Resort Management Platform
        </span>
      </div>
      
      {/* Headline */}
      <h1 className="font-display text-5xl md:text-6xl font-bold text-white 
          leading-tight">
        Run your resort
        <span className="block text-transparent bg-clip-text 
            bg-gradient-to-r from-gold-400 to-gold-600">
          like a 5-star.
        </span>
      </h1>
      
      <p className="mt-6 text-lg text-white/60 leading-relaxed max-w-xl">
        ...
      </p>
      
      {/* CTA buttons */}
      <div className="mt-10 flex items-center gap-4">
        <Link href="/auth/register" className="rounded-xl bg-gold-500 px-8 py-4 
            font-semibold text-resort-900 shadow-lg hover:bg-gold-400 
            transition-colors text-base">
          Start free trial
        </Link>
        <Link href="/demo" className="flex items-center gap-2 text-white/70 
            hover:text-white transition-colors text-sm font-medium">
          <Play className="h-4 w-4" /> See demo
        </Link>
      </div>
    </div>
  </div>
  
  {/* Dashboard preview mockup/screenshot — right side */}
  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 
      opacity-20 lg:opacity-40 pointer-events-none">
    {/* Dashboard screenshot বা mockup এখানে */}
  </div>
</section>
```

### Features Section:
```
Background: bg-stone-50
Feature cards: white, rounded-2xl, shadow-card
Icon containers: resort-100 bg, resort-600 icon
Section heading: font-display, resort-900
```

### Pricing Section:
```
Popular plan card: bg-resort-800 text-white (dark)
Other plan cards: bg-white border
CTA button on popular: bg-gold-500 text-resort-900
```

### Navbar redesign:
```tsx
/* পুরনো: plain white navbar */
/* নতুন: transparent on hero, white on scroll */
<nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300
    {scrolled ? 'bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100' 
              : 'bg-transparent'}">
  
  {/* Logo */}
  <div className="flex h-14 w-14... (gold icon + ResortPro text) */}
  
  {/* Nav links: white on hero, gray-600 on scrolled */}
  {/* CTA: outlined on hero, solid on scrolled */}
</nav>
```

---

## Phase 7 — Onboarding Page

**File:** `apps/web/src/app/onboarding/page.tsx`

```
Style: wizard-style steps
Background: resort-900 dark (consistent with auth)
Steps: numbered circles with resort-500 color
Progress bar: gold color
Completion: confetti effect or celebration animation
```

---

## Phase 8 — Feature Pages (Dashboard inner pages)

সব feature page-এ consistent pattern follow করো:

### Page header pattern:
```tsx
<div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="font-display text-xl font-bold text-gray-900">{Page Title}</h1>
    <p className="mt-0.5 text-sm text-muted-foreground">{subtitle/count}</p>
  </div>
  <div className="flex items-center gap-2">
    {/* filters, export, add button */}
    <Button variant="default" size="sm" className="bg-resort-600 hover:bg-resort-700">
      <Plus className="h-4 w-4 mr-1.5" /> Add {item}
    </Button>
  </div>
</div>
```

### Table pattern:
```tsx
/* পুরনো: basic border table */
/* নতুন: card-wrapped table */
<div className="rounded-2xl bg-white shadow-card overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-resort-50 bg-resort-50/50">
        <th className="px-4 py-3 text-left text-xs font-semibold 
            uppercase tracking-wider text-resort-600">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-50">
      <tr className="hover:bg-resort-50/30 transition-colors">
        ...
      </tr>
    </tbody>
  </table>
</div>
```

### Empty state pattern:
```tsx
<div className="flex flex-col items-center py-16 text-center">
  <div className="mb-4 rounded-2xl bg-resort-50 p-5">
    <Icon className="h-8 w-8 text-resort-400" />
  </div>
  <h3 className="font-semibold text-gray-900">No {items} yet</h3>
  <p className="mt-1 text-sm text-muted-foreground max-w-xs">{helpful description}</p>
  <Button className="mt-4 bg-resort-600">Add first {item}</Button>
</div>
```

### Key pages — special attention:

**Rooms page** (`/dashboard/rooms`):
- Room cards as grid (not table) — each card shows room image placeholder, number, type, status badge, price
- Status badge colors: Available=green, Occupied=resort-600, Maintenance=orange, Cleaning=yellow

**Booking Calendar** (`/dashboard/calendar`):
- Calendar cell backgrounds: booked=resort-100, available=white, today=gold-50
- Booking bars: resort-600 bg with guest name
- Drag-to-book: gold highlight

**Analytics** (`/dashboard/analytics`):
- Dark card for main KPI: `bg-resort-800 text-white`
- Chart cards: white with resort-50 header
- Metric cards: colored left border (4px resort-500)

**Invoices** (`/dashboard/invoices`):
- Table row: paid=green left border, pending=gold, overdue=red
- Invoice preview modal: print-optimized white card

**Billing** (`/dashboard/billing`):
- Current plan card: resort-800 dark with plan name in Playfair
- Usage meters: resort-500 progress bars
- Upgrade CTA: gold gradient button

---

## Phase 9 — Admin Panel

**Files:** `apps/web/src/app/admin/(panel)/*/page.tsx`

```
Style: slightly different from tenant dashboard
Sidebar: darker — #0a2820 (even deeper green)
Accent: more blue-tinted for differentiation
Admin badge: top of sidebar — "Platform Admin" pill
```

Admin dashboard hero card:
```tsx
<div className="rounded-2xl bg-gradient-to-r from-resort-900 to-resort-700 
    p-6 text-white shadow-xl">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-white/60 text-sm">Platform MRR</p>
      <p className="font-display text-4xl font-bold mt-1">${mrr}</p>
    </div>
    <div className="text-right">
      <p className="text-white/60 text-sm">Active Tenants</p>
      <p className="text-3xl font-bold mt-1">{count}</p>
    </div>
  </div>
</div>
```

---

## Phase 10 — Modal & Sheet components

**Files:** `apps/web/src/components/*/`

### Sheet (slide-over panel):
```tsx
/* Header: */
<div className="flex items-center justify-between border-b border-resort-50 p-6">
  <div>
    <h2 className="font-display text-lg font-bold text-gray-900">{title}</h2>
    <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
  </div>
  <button className="rounded-lg p-2 hover:bg-resort-50 text-gray-400 
      hover:text-gray-600 transition-colors">
    <X className="h-4 w-4" />
  </button>
</div>
```

### Modal:
```tsx
/* Overlay: backdrop-blur-sm bg-black/40 */
/* Modal: rounded-3xl bg-white shadow-2xl max-w-lg mx-auto */
/* Header: border-b border-gray-100 pb-4 */
/* Footer: border-t border-gray-100 pt-4 flex justify-end gap-2 */
```

### Booking Detail Sheet redesign:
- Guest avatar: large circle, resort-gradient bg
- Check-in/out dates: side-by-side cards with icons
- Payment section: green border-left if paid
- Action buttons: Check-in (resort-600), Invoice (outlined), Void (red)

---

## Phase 11 — UI Components Base

**File:** `apps/web/src/components/ui/`

### Button variants:
```tsx
/* primary: bg-resort-600 hover:bg-resort-700 text-white */
/* gold: bg-gold-500 hover:bg-gold-400 text-resort-900 font-semibold */
/* secondary: bg-resort-50 text-resort-700 hover:bg-resort-100 */
/* outline: border-resort-200 text-resort-700 hover:bg-resort-50 */
/* destructive: bg-red-500 hover:bg-red-600 text-white */
/* ghost: hover:bg-resort-50 text-gray-600 */
```

### Badge/Status:
```tsx
/* CONFIRMED: bg-emerald-100 text-emerald-700 */
/* CHECKED_IN: bg-resort-100 text-resort-700 */
/* CHECKED_OUT: bg-gray-100 text-gray-600 */
/* CANCELLED: bg-red-100 text-red-700 */
/* PENDING: bg-amber-100 text-amber-700 */
```

### Card:
```tsx
/* Base: rounded-2xl bg-white shadow-card border-0 */
/* Hover: shadow-card-hover transition-shadow */
/* Header: pb-3 (tighter) */
/* Title: font-display text-base font-semibold text-gray-900 */
```

### Input:
```tsx
/* Base: rounded-xl border-gray-200 bg-white focus-visible:ring-resort-500 */
/* Focus: border-resort-400 ring-resort-500/20 */
/* Error: border-red-400 */
```

---

## Implementation Order

```
Priority 1 — করলেই পুরো app সুন্দর দেখাবে (1-2 days)
  ✦ globals.css + tailwind tokens
  ✦ Sidebar dark redesign
  ✦ Card shadow + border polish
  ✦ Button variants

Priority 2 — Visitor-facing pages (1 day)
  ✦ Landing page hero
  ✦ Auth pages polish
  ✦ Onboarding

Priority 3 — Dashboard home (half day)
  ✦ Stat cards redesign
  ✦ Charts color update

Priority 4 — Feature pages (2-3 days)
  ✦ Rooms, Bookings, Guests, Staff
  ✦ Calendar, Analytics
  ✦ Invoices, Billing

Priority 5 — Admin panel (1 day)
  ✦ Admin sidebar
  ✦ Tenant list
  ✦ Platform dashboard
```

---

## Claude-কে দেওয়ার জন্য prompt template

যখন Claude দিয়ে design করবে, এই ভাবে বলো:

```
এই project-এর [page নাম] page টা redesign করো।
plan/ui-design-plan.md পড়ো — সেখানে Phase [X] এর instruction follow করো।
Design tokens, color palette, shadows সব ওই plan থেকে নাও।
Existing functionality বা logic কিছু পরিবর্তন করবে না — শুধু UI/className বদলাবে।
```

---

## Reference inspirations

Design করার সময় এই platforms দেখো (feel বোঝার জন্য):
- **Vercel dashboard** — clean dark sidebar, minimal noise
- **Linear** — tight spacing, keyboard-first, fast feel
- **Stripe dashboard** — data-rich, professional, zero clutter
- **Notion** — warm off-white, comfortable reading
- **Luma** — event-focused, beautiful typography

**Resort/hospitality specific:**
- Apaleo (hotel PMS) — clean European design
- Mews dashboard — modern hospitality feel
- **Goal:** ResortPro কে এদের মতো professional কিন্তু আরও warm দেখাতে হবে
