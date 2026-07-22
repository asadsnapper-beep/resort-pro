# ResortPro — Landing Page Redesign Brief

**Goal:** An elegant, classic, editorial landing page. Calm, confident, premium —
the feeling of a 5-star resort lobby, not a noisy SaaS dashboard. Easy to scan,
effortless to navigate, conversion-focused.

**Design north star:** *"Quiet luxury."* Lots of whitespace, restrained palette,
serif headlines, one accent (gold), subtle motion. Nothing shouts. Every element
earns its place.

---

## 1. Visual System

### Palette (use existing tokens — do not add new colors)
| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Primary | `resort-600` | `#23766a` | Buttons, links, key accents |
| Deep | `resort-900` | `#19403b` | Dark sections, footer, headlines on light |
| Accent | `gold-500` | `#d4a853` | Sparingly — one gold element per section max |
| Canvas | `#faf8f4` (cream) | warm off-white | Page background instead of pure white |
| Surface | `white` | `#ffffff` | Cards on cream |
| Text | `resort-900` / `gray-600` | — | Headlines / body |

> **Key change:** Replace the current `bg-white` / `bg-gray-50` alternation with a
> warm **cream canvas (`#faf8f4`)**. Cream + serif = instant "classic/elegant."
> Pure white feels clinical; cream feels like fine stationery.

### Typography
- **Headlines:** `font-display` (Playfair Display) — already in system. Use it
  generously and large. This is the soul of the "classic" feel.
- **Body / UI:** `Inter` — keep.
- **Scale (desktop):**
  - Hero H1: `text-6xl md:text-7xl` (Playfair, `font-medium`, `leading-[1.05]`, `tracking-tight`)
  - Section H2: `text-4xl md:text-5xl` (Playfair, `font-medium`)
  - Eyebrow label: `text-xs uppercase tracking-[0.2em] text-resort-600 font-semibold`
  - Body: `text-lg text-gray-600 leading-relaxed`
- **Rule:** Headlines serif, everything else sans. Never mix.

### Spacing & rhythm
- Section padding: `py-28 md:py-36` (more air than current `py-24`).
- Max content width: `max-w-6xl mx-auto px-6`.
- Generous gaps: `gap-12` between major blocks.
- **One idea per screen.** Let sections breathe.

### Motion (subtle only)
- Fade-up on scroll (use existing `animate-fade-in`, stagger by 80ms).
- Buttons: `transition-all` + slight lift on hover (`hover:-translate-y-0.5`).
- No parallax, no autoplay carousels, no bouncing. Calm = premium.

### Detailing that signals "classic/elegant"
- **Thin hairline dividers** (`border-resort-900/10`) instead of heavy borders.
- **Generous border-radius** on cards (`rounded-2xl`) but **sharp** on the hero image frame (`rounded-none` with a thin gold rule).
- A repeating **thin gold underline** under eyebrow labels.
- Subtle grain/noise texture on dark sections (optional, 3% opacity).

---

## 2. Section-by-Section — Content + Design

### NAV (sticky, transparent → solid on scroll)
- Transparent over hero; on scroll, `bg-[#faf8f4]/80 backdrop-blur` + hairline bottom border.
- Left: logo. Center: links. Right: `Log in` (text) + `Start free trial` (gold-outlined button).
- Links: `Features · How it works · Pricing · FAQ` (drop "Embed SDK" from nav — fold it into Features).

---

### HERO
**Layout:** Centered, editorial. Eyebrow → serif H1 → sub → 2 CTAs → trust strip.
Below: a single, large, framed product shot (the existing DashboardMockup, but
floated on cream with a soft shadow and a thin gold top-rule).

**Copy:**
> *(eyebrow)* HOTEL & RESORT MANAGEMENT, REIMAGINED
>
> # The calm way to run a busy resort.
>
> Bookings, payments, restaurant, and guests — one elegant system that replaces
> your spreadsheets, WhatsApp groups, and payment screenshots. Built for the way
> resorts in Bangladesh actually work.
>
> **[ Start your free trial ]**  *(primary, resort-600)*  &nbsp; **[ See how it works ]** *(ghost)*
>
> *(trust line, small, gray)* No credit card required · Set up in 10 minutes · bKash & Stripe built in

**Design notes:**
- H1 in Playfair, `text-6xl md:text-7xl`, `text-resort-900`. The word *"calm"* in
  `text-resort-600` or italic for editorial emphasis.
- CTAs: primary = solid `bg-resort-600 text-white rounded-full px-7 py-3.5`;
  secondary = `text-resort-700` with underline-on-hover.
- Product mockup: keep the existing `DashboardMockup`, but place on cream with
  `shadow-2xl shadow-resort-900/15` and a `2px` gold top border. Slight rotate? No —
  keep it straight and dignified.

---

### TRUST STRIP (logos)
- Single line, muted: *"Trusted by resorts across Cox's Bazar, Sylhet & Sreemangal"*
- Render `TRUST_BRANDS` as grayscale wordmarks, `opacity-50`, evenly spaced.
- Thin hairline above and below.

---

### FEATURES
**Eyebrow:** EVERYTHING IN ONE PLACE
**H2:** *Run every part of your property from a single screen.*
**Sub:** From the first enquiry to checkout and the final invoice — ResortPro
handles the whole guest journey.

**Layout:** 3×2 grid of cards on cream. Each card: white surface, `rounded-2xl`,
hairline ring, icon in a soft `resort-50` circle, serif-ish title, calm body.
On hover: card lifts gently, icon circle fills `resort-600`.

**Keep the 6 features** but tighten copy:
1. **Bookings & Calendar** — Drag-and-drop calendar, walk-ins, online and group bookings in one view.
2. **Payments Built In** — bKash, SSLCommerz, Stripe and cash — no plugins, no chasing screenshots.
3. **Analytics & Reports** — Occupancy, revenue and profit, updated in real time.
4. **Restaurant & Room Service** — Menus, table orders and live kitchen status.
5. **Guest CRM & Loyalty** — Profiles, stay history and loyalty points in one place.
6. **Embed Anywhere** — Add booking forms to your existing site with one line of code.

---

### HOW IT WORKS
**Eyebrow:** LIVE IN THREE STEPS
**H2:** *From sign-up to your first online booking — today.*

**Layout:** Horizontal 3-step path with a thin connecting line (gold, dotted).
Large serif step numbers (`01 02 03`) as the hero element of each step.

Keep the 3 steps (Create account → Set up payments → Go live), copy is already good.

---

### EMBED (folded in here, lighter than before)
**Eyebrow:** WORKS WITH YOUR WEBSITE
**H2:** *Keep your website. Add the booking power.*
**Sub:** One snippet drops a live booking form, room list, calendar or menu onto
WordPress, Wix, Squarespace — any site.

**Design:** Two columns. Left: the `EMBED_WIDGETS` as small pill chips. Right: a
clean code block (`<script src="...">`) on a dark `resort-900` card with a copy button.

---

### PRICING
**Eyebrow:** SIMPLE, HONEST PRICING
**H2:** *Pick a plan. Change it anytime.*
**Sub:** Every plan includes a 14-day free trial. No setup fees, no contracts.

**Layout:** 3 cards. Center (PROFESSIONAL) highlighted — slightly taller, gold
ring, "Most popular" gold ribbon. Others calm white on cream.
Keep Starter / Professional / Enterprise. Add a small **monthly/annual toggle**
(annual = "2 months free") above the cards — strong UX win.

**Card design:** Plan name as eyebrow, price in big Playfair, then divider, then
feature list with gold check marks. CTA full-width at bottom.

---

### TESTIMONIALS
**Eyebrow:** LOVED BY RESORT OWNERS
**H2:** *Why teams switch to ResortPro — and stay.*

**Layout:** Keep dark `resort-900` section (it gives the page a rich anchor).
Render the 3 testimonials as a clean 3-column grid of quote cards with a large
serif opening quotation mark in `gold-500`. Avatar = initials in a gold circle.
Keep existing quotes (they're specific and credible).

> Add one **stat band** above the quotes: large Playfair numbers —
> *"500+ rooms managed · ৳2.4Cr+ processed · 99.9% uptime"* — gold accents.

---

### FAQ
**Eyebrow:** GOOD TO KNOW
**H2:** *Questions, answered.*

**Layout:** Single centered column, `max-w-3xl`. Accordion with hairline dividers
(use existing accordion animation). Plus/minus icon in `resort-600`. Keep the 6 FAQs.

---

### FINAL CTA (new — add before footer)
A full-width `resort-900` band with a centered serif headline:
> # Your front desk, finally at peace.
> Start free today. Be taking online bookings by tonight.
> **[ Start free trial ]** *(gold solid)* &nbsp; **[ Book a demo ]** *(ghost, light)*

This gives the page a strong, calm closing note.

---

### FOOTER
- Cream or `resort-900` (pick one — recommend `resort-900` to bookend the page).
- 4 columns: Product · Company · Resources · Legal. Logo + one-line mission left.
- Bottom bar: copyright + language switcher + social. Hairline divider above.

---

## 3. UX Principles (apply everywhere)
1. **One primary action per section.** Never two competing CTAs of equal weight.
2. **Scannable.** Eyebrow → headline → one sentence → proof. User gets it in 3 seconds.
3. **Mobile-first.** Stack gracefully; CTAs become full-width; nav collapses to a
   clean slide-over (not a cramped dropdown).
4. **Performance = elegance.** No heavy images; the CSS mockup stays. Lazy-load
   below-fold. Target LCP < 2s.
5. **Accessibility.** Gold-on-white fails contrast for text — only use gold for
   large text, icons, borders, and fills, never small body copy. Focus rings visible.

---

## 4. Implementation Notes
- File: `apps/web/src/app/page.tsx` (single file today; consider splitting each
  section into `components/marketing/*` for maintainability).
- Reuse: `DashboardMockup`, `FEATURES`, `STEPS`, `PLANS`, `TESTIMONIALS`, `FAQS`,
  `TRUST_BRANDS`, `EMBED_WIDGETS` data arrays — only the **presentation** changes.
- Add cream as an arbitrary value `bg-[#faf8f4]` or, better, register it as
  `resort-25` / `cream` in `tailwind.config`.
- Keep everything in the existing token system — no new dependencies.

---

## 5. Build Order (suggested)
1. Set cream canvas + typography scale (global vibe shift — biggest impact).
2. Hero rebuild.
3. Features + How it works.
4. Pricing (with billing toggle).
5. Testimonials stat band + Final CTA.
6. Nav scroll behavior + mobile menu polish.
7. FAQ + Footer.
