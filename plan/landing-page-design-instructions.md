# ResortPro Landing Page — Active Design Instructions

**Applies to:** `apps/web/src/app/page.tsx` and its marketing assets.

**Audience:** Designers and developers changing the ResortPro public landing page.

**Purpose:** Keep the landing page original, modern, simple, and consistent with
the decisions made for ResortPro. This document is the current source of truth.

> The older [landing-page-redesign.md](./landing-page-redesign.md) is a historic
> brief. Where it recommends cream canvas, green as the main brand colour, or
> Playfair Display, this document takes priority.

## 1. Design direction

ResortPro should feel like a polished, modern hospitality operating system:
calm, clear, and trustworthy. It must feel original—not a copy of Airbnb or any
other travel product. Use generous whitespace, a strong product preview, and
simple copy that helps a resort owner understand the value quickly.

Avoid generic, overly busy SaaS styling: excessive gradients, too many badge
colours, decorative effects with no purpose, or several competing CTAs.

## 2. Typography

### Primary font: Nunito

- `Nunito` is the main ResortPro font for body copy, interface text, navigation,
  buttons, headings, and brand text.
- Use weights 400, 500, 600, 700, and 800 as needed.
- Tailwind classes `font-sans` and `font-display` both resolve to Nunito.
- Do not introduce DM Sans, Playfair Display, Inter, or another body/display
  font on the landing page without an explicit design decision.

### Accent font: Bitcount Prop Single

`Bitcount Prop Single` is a display accent only, never a body-copy font. Use
`font-bitcount` for short, digital/product moments:

- section eyebrow labels;
- compact live-dashboard metrics;
- numbered steps such as `01`, `02`, `03`;
- large pricing figures.

Keep it sparse. It should add a small, distinctive product-tech character, not
make the resort experience look like a retro game interface.

## 3. Colour palette — no green-led identity

The landing page must not use green as its primary identity. Use the following
**Coastal Coral** palette on future landing-page colour work:

| Role | Name | Hex | Usage |
|---|---|---:|---|
| Canvas | Pure white | `#FFFFFF` | Default page background |
| Primary dark | Deep navy | `#183153` | Headlines, navbar, dark sections, primary buttons |
| Primary accent | Sunset coral | `#EF725C` | Main highlight, selected states, key icons, CTA emphasis |
| Soft accent surface | Pale peach | `#FFF1EA` | Alternating sections and callouts |
| Secondary accent | Warm gold | `#F4C76B` | Badges, small highlights, pricing emphasis |
| Cool support surface | Mist blue | `#E5F0F7` | Product cards, supporting visual panels |
| Secondary text | Slate blue | `#64748B` | Supporting copy and metadata |

### Colour rules

- The overall page canvas is pure white. Do not use `#F7F3ED` as a page or card
  background.
- Use navy for the primary CTA and dark anchor sections; use coral as the
  recognizable accent. Do not put every accent colour in one section.
- Keep body text dark navy or slate blue for readable contrast.
- Use gold for small emphasis only; it is not body-text colour on white.
- When converting existing green values, use the role above rather than doing a
  blind hex-for-hex replacement.

## 4. Hero rules

- The H1 is one solid colour: deep navy (`#183153` when the Coastal Coral palette
  is applied).
- Never split the H1 across two colours.
- Never italicise any word inside the H1.
- Keep the message short, confident, and benefit-led.
- Use one dominant primary CTA and one clearly secondary CTA.

## 5. Logo rules

- Use the approved asset:
  `apps/web/public/brand/resortpro-logo-concept-v2.png`.
- At small navigation, dashboard-preview, and footer sizes, show only the coral
  icon/monogram crop via the shared `BrandMark` component.
- Pair that icon with the `ResortPro` text wordmark only once. Do not display the
  asset's embedded wordmark and an adjacent text wordmark together.
- Preserve the logo's rounded, original modern mark. Do not reproduce Airbnb's
  symbol, layout, or visual identity.

## 6. Page composition and interaction

- Keep the asymmetric hero with the live availability/product board; the product
  should be visible early, not hidden behind abstract decoration.
- Use one clear idea per section: eyebrow → headline → short explanation →
  action or proof.
- Cards need enough contrast against a white canvas using a subtle border or a
  pale peach/mist-blue surface—never a heavy shadow everywhere.
- Keep mobile navigation compact and usable. On small screens, stack actions and
  prevent horizontal overflow.
- Motion is restrained: quick colour changes and a small button lift are enough.
  Avoid auto-playing, bouncing, parallax, or distracting animation.

## 7. Pricing content

Show three easy-to-understand plans. Internal enum names may remain unchanged,
but the visitor-facing names must be:

| Plan | Monthly | Annual | Best for |
|---|---:|---:|---|
| Free Forever | `$0` | `$0` | A new or very small single-property resort |
| Independent Resort | `$19` | `$190` | A serious independent property |
| Resort Group | `$59` | `$590` | A larger resort or small group of properties |

- Keep the monthly/yearly switcher visible and explain that annual billing gives
  two months free.
- Lead visibly with **Free Forever**. It is a real, no-card, no-expiry option,
  not a buried trial. Core booking, guest data, invoices, basic reports, and
  data export are never held behind a paid plan.
- **Independent Resort** includes custom domain. Paid plans buy capacity,
  broader operations, multi-property visibility, and support—not basic freedom.
- The three-month launch promotion applies only to the two paid plans. Its
  dates and eligibility must be a server-controlled flag, not hardcoded copy.
  A duplicate promotion attempt falls back to a usable Free Forever account;
  it does not block the customer.
- `ENTERPRISE` may remain as an internal legacy/custom plan but must not render
  as a fourth public card.
- Full source of truth: [fair pricing rollout plan](./launch-pricing-and-trial-abuse-prevention.md).

## 8. Implementation checklist

Before merging a landing-page change, confirm:

- [ ] Nunito remains the primary font and Bitcount is used only as an accent.
- [ ] The canvas is white; `#F7F3ED` is absent from the landing page.
- [ ] The H1 has one colour and no italic styling.
- [ ] The logo wordmark is visible only once in each placement.
- [ ] No new green-led primary colour has been introduced.
- [ ] The page works at desktop and mobile widths without horizontal overflow.
- [ ] Pricing names and USD prices come from `PLAN_PRICING`, not duplicated
      hardcoded values.
