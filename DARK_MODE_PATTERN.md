# ResortPro Dark Mode Design Pattern

## Color Tokens

### Backgrounds
| Light Value | Dark Value | Usage |
|-------------|------------|-------|
| `#ffffff` / `#fff` | `rgba(255,255,255,0.07)` | Card / panel bg |
| `bg-white` (className) | `bg-white dark:bg-white/5` | Card className |
| `#faf9f7` | `rgba(255,255,255,0.05)` | Table row, subtle bg |
| `#f5f4f1` | `rgba(255,255,255,0.05)` | Input bg, section bg |
| `#f4f1eb` | `rgba(255,255,255,0.05)` | Alt input bg |
| `#1b342f` | `#1b342f` (unchanged) | Dark green accent bg (always dark) |

### Text Colors
| Light Value | Dark Value | Usage |
|-------------|------------|-------|
| `#18231f` | `#dfd9d0` | Primary text |
| `#8aa29a` | `#94b8b0` | Muted label text |
| `#7a9890` | `#94b8b0` | Secondary muted |
| `#6b8880` | `#94b8b0` | Tertiary muted |
| `#4a6e66` | `#6d9990` | Accent text (features, bullets) |
| `#b5afa7` | `#7a8f8b` | Very muted |
| `#c5bdb4` | `#6e8580` | Disabled / placeholder |
| `#d6cfc4` | `#6e8580` | Disabled |

### Borders
| Light Value | Dark Value | Usage |
|-------------|------------|-------|
| `rgba(0,0,0,0.045)` | `rgba(255,255,255,0.08)` | Card border |
| `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.08)` | Card border alt |
| `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` | Subtle divider |
| `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` | Section border |
| `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` | Button border |
| `rgba(0,0,0,0.09)` | `rgba(255,255,255,0.10)` | Filter button border |

### Accent / Status Backgrounds
| Light Value | Dark Value | Usage |
|-------------|------------|-------|
| `#e3f2ef` | `rgba(35,118,106,0.20)` | Teal accent (Completed, active) |
| `#f4ecda` | `rgba(184,144,64,0.18)` | Amber accent (Pending, warning) |
| `#fef2f2` | `rgba(196,60,60,0.15)` | Red accent (Error, No-show) |
| `#f0ede8` | `rgba(255,255,255,0.08)` | Track/progress bg |
| `#fceee4` | `rgba(184,100,60,0.18)` | Coral accent |
| `#e3f2ef` (active filter) | `rgba(35,118,106,0.20)` | Active filter pill |

---

## Implementation Rules

### Rule 1 — Never hardcode `background: '#fff'` in inline styles
**Wrong:**
```tsx
style={{ background: '#fff', borderColor: 'rgba(0,0,0,0.045)' }}
```
**Right:**
```tsx
// Option A: useTheme
const isDark = resolvedTheme === 'dark';
style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#fff', ... }}

// Option B: className
className="bg-white dark:bg-white/5"
```

### Rule 2 — Never hardcode text colors as inline styles
**Wrong:**
```tsx
style={{ color: '#18231f' }}
```
**Right (className):**
```tsx
className="text-[#18231f] dark:text-[#dfd9d0]"
```
OR covered by globals.css `.dark .text-[\#18231f]` rule.

### Rule 3 — Conditional buttons use isDark
**Pattern:**
```tsx
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';

style={active
  ? { background: '#1b342f', color: '#dfd9d0', borderColor: '#1b342f' }
  : { background: isDark ? 'rgba(255,255,255,0.07)' : '#fff',
      color: isDark ? '#94b8b0' : '#6b8880',
      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)' }}
```

### Rule 4 — Accent bg colors need isDark
```tsx
style={{ background: isDark ? 'rgba(35,118,106,0.20)' : '#e3f2ef' }}
style={{ background: isDark ? 'rgba(184,144,64,0.18)' : '#f4ecda' }}
style={{ background: isDark ? 'rgba(196,60,60,0.15)' : '#fef2f2' }}
```

### Rule 5 — globals.css handles className-based overrides
These Tailwind classes are auto-handled:
- `.text-[#18231f]` → `#dfd9d0`
- `.text-[#8aa29a]` → `#94b8b0`
- `.bg-[#faf9f7]` → `rgba(255,255,255,0.05)`
- `.bg-white` (inside `main`) → `rgba(255,255,255,0.07)`

---

## Violation Patterns to Detect

### CRITICAL — Will show white boxes in dark mode
- `style={{ background: '#fff'` — inline white bg (not isDark conditional)
- `style={{ background: '#ffffff'` — same
- `style={{ background: 'white'` — same

### HIGH — Will show light boxes in dark mode
- `style={{ background: '#faf9f7'` — off-white, not isDark conditional
- `style={{ background: '#f5f4f1'` — light bg, not conditional
- `style={{ background: '#f4f1eb'` — light bg, not conditional
- `style={{ background: '#e3f2ef'` — teal tint, not conditional
- `style={{ background: '#f4ecda'` — amber tint, not conditional
- `style={{ background: '#fef2f2'` — red tint, not conditional

### MEDIUM — Text may be unreadable
- `style={{ color: '#18231f'` — dark text, inline style (not className)
- `style={{ color: '#8aa29a'` — muted text, inline style (not className)
- `style={{ color: '#6b8880'` — muted text, inline style

### LOW — Borders barely visible
- `style={{ borderColor: 'rgba(0,0,0,` — dark borders, not isDark conditional
