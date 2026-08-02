# Styling System — ResortPro

## এই project এ styling এর ইতিহাস

### আগে ছিল (সমস্যা)
তিনটা mixed approach:
1. `style={{ color: '#18231f' }}` — inline hardcoded hex
2. `className="text-[#18231f]"` — Tailwind arbitrary value
3. কিছু জায়গায় `var(--rp-*)` — কিন্তু consistent ছিল না

**ফলাফল:** প্রতিটা dark mode fix এর জন্য আলাদা `isDark` conditional লাগতো। 20+ files এ বারবার একই কাজ।

### এখন আছে (solution)
`globals.css` এ semantic CSS custom properties:

```css
:root {
  --rp-text: #18231f;
  --rp-surface: #ffffff;
  /* ...17টা token */
}
.dark {
  --rp-text: #dfd9d0;
  --rp-surface: rgba(255,255,255,0.07);
  /* ...same tokens, dark values */
}
```

**ফলাফল:** `style={{ color: 'var(--rp-text)' }}` লিখলেই dark mode automatically কাজ করে।

---

## Available Tokens

| Token | Light | Dark | ব্যবহার |
|-------|-------|------|---------|
| `--rp-text` | `#18231f` | `#dfd9d0` | Primary text |
| `--rp-text-muted` | `#8aa29a` | `#94b8b0` | Secondary text |
| `--rp-text-subtle` | `#6b8880` | `#94b8b0` | Labels, captions |
| `--rp-text-faint` | `#c5bdb4` | `#6e8580` | Placeholder, disabled |
| `--rp-text-accent` | `#4a6e66` | `#6d9990` | Accent text |
| `--rp-surface` | `#ffffff` | `rgba(255,255,255,0.07)` | Card background |
| `--rp-surface-2` | `#faf9f7` | `rgba(255,255,255,0.04)` | Subtle background |
| `--rp-surface-3` | `#f4f1eb` | `rgba(255,255,255,0.05)` | Input background |
| `--rp-surface-4` | `#f0ede8` | `rgba(255,255,255,0.06)` | Hover background |
| `--rp-modal` | `#ffffff` | `#1a2e2a` | Modal background |
| `--rp-border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` | Subtle border |
| `--rp-border-md` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | Medium border |
| `--rp-teal-bg` | `#e3f2ef` | `rgba(35,118,106,0.20)` | Success/active bg |
| `--rp-amber-bg` | `#f4ecda` | `rgba(184,144,64,0.18)` | Warning bg |
| `--rp-red-bg` | `#fef2f2` | `rgba(196,60,60,0.15)` | Error/danger bg |
| `--rp-coral-bg` | `#fceee4` | `rgba(184,100,60,0.18)` | Pending bg |
| `--rp-teal-soft` | `#f5faf9` | `rgba(35,118,106,0.08)` | Very subtle teal |

---

## Migration Script

`scripts/migrate-colors.py` — hardcoded hex থেকে token এ convert করে।

```bash
cd /Users/parthohore/Hotel\ management
python3 scripts/migrate-colors.py
```

49 files, 539 replacements করেছিল একবারে।

---

## নতুন component লেখার rule

```tsx
// ❌ এভাবে লিখবে না
<div style={{ background: '#faf9f7', color: '#18231f', border: '1px solid rgba(0,0,0,0.06)' }}>

// ✅ এভাবে লিখবে
<div style={{ background: 'var(--rp-surface-2)', color: 'var(--rp-text)', border: '1px solid var(--rp-border)' }}>
```
