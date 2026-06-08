# Dynamic Theme Upload System — Plan
## Super Admin নিজেই Theme Upload ও AI দিয়ে তৈরি করতে পারবে

---

## সমস্যাটা কী (বর্তমান অবস্থা)

এখন theme মানে hardcoded React component:
```
Developer code লেখে → git push → build → deploy → theme live হয়
```

Super admin শুধু metadata (name, color, preview image) manage করতে পারে।
**New theme = code + deploy ছাড়া সম্ভব না।**

---

## নতুন System — দুটো Option

```
┌─────────────────────────────────────────────────────────┐
│  Super Admin → /admin/themes → "Add Theme"              │
│                                                         │
│  ┌──────────────────┐   ┌──────────────────────────┐   │
│  │  Option A        │   │  Option B                │   │
│  │  Upload Package  │   │  Build with AI           │   │
│  │                  │   │                          │   │
│  │  Admin নিজে       │   │  Prompt দাও → AI         │   │
│  │  theme zip/json  │   │  automatically theme     │   │
│  │  upload করে      │   │  generate করবে          │   │
│  └──────────────────┘   └──────────────────────────┘   │
│         ↓                          ↓                    │
│    Preview → Publish          Preview → Iterate → Publish│
└─────────────────────────────────────────────────────────┘
```

---

## Architecture — কীভাবে কাজ করবে

### মূল পরিবর্তন: Config-Driven Theme Renderer

বর্তমান system:
```
THEME_REGISTRY['luxe'] → LuxeTheme (React component, hardcoded)
```

নতুন system:
```
THEME_REGISTRY['luxe']         → LuxeTheme (React, hardcoded — আগের মতোই)
THEME_REGISTRY['mountain']     → ConfigThemeRenderer({ config }) ← NEW
THEME_REGISTRY['ai-zen-spa']   → ConfigThemeRenderer({ config }) ← AI generated
```

Upload করা বা AI-generated themes সব `ConfigThemeRenderer` দিয়ে render হবে।
পুরনো hardcoded themes আগের মতোই চলবে — কোনো ভাঙা হবে না।

### Config Schema (Theme এর "DNA")

```json
{
  "key": "mountain-escape",
  "name": "Mountain Escape",
  "version": "1.0.0",

  "colors": {
    "primary": "#2d5a3d",
    "accent": "#c8a96e",
    "background": "#faf9f6",
    "surface": "#ffffff",
    "text": "#1a2d1a",
    "textMuted": "#6b7280"
  },

  "fonts": {
    "heading": "serif",
    "body": "sans-serif",
    "googleFonts": ["Playfair Display", "Inter"]
  },

  "navbar": {
    "style": "transparent-to-white",
    "logoEmoji": "🏔️",
    "links": ["about", "rooms", "gallery", "booking", "contact"]
  },

  "hero": {
    "layout": "fullscreen",
    "overlayStyle": "dark-gradient",
    "overlayOpacity": 0.55,
    "textAlign": "center",
    "ctaStyle": "pill"
  },

  "about": {
    "layout": "image-right",
    "showBullets": true,
    "bullets": [
      "Stunning mountain views from every room",
      "Farm-to-table organic dining",
      "Guided nature trails and eco experiences"
    ]
  },

  "rooms": {
    "cardStyle": "rounded",
    "cardBackground": "#f0f7f1",
    "showPriceBadge": true,
    "ctaLabel": "Book Now"
  },

  "gallery": {
    "layout": "masonry",
    "captions": ["Mountain View", "Forest Trail", "Eco Cabin", "Sunrise", "Dining", "Lounge"]
  },

  "footer": {
    "background": "#1a2d1a",
    "divider": "wave",
    "showSocial": true
  },

  "sections": ["hero", "about", "rooms", "gallery", "testimonials", "availability", "booking", "contact"],

  "customCSS": ""
}
```

এই JSON থেকে `ConfigThemeRenderer` পুরো resort website render করতে পারবে।

### DB পরিবর্তন

```prisma
model Theme {
  // existing fields...
  key          String   @unique
  name         String
  isActive     Boolean  @default(false)
  isPremium    Boolean  @default(false)

  // নতুন fields
  themeType    ThemeType @default(HARDCODED)
  configJson   Json?     // Option A & B এর জন্য — config schema above
  uploadedBy   String?   // super admin user id
  aiPrompt     String?   // Option B: AI দিয়ে বানানো হলে prompt টা store হবে
  aiProvider   String?   // "claude", "gpt4", etc.
  previewHtml  String?   // generated preview HTML snapshot
  status       ThemeStatus @default(DRAFT)  // DRAFT → PREVIEW → PUBLISHED
}

enum ThemeType {
  HARDCODED    // পুরনো themes (luxe, minimal, coastal)
  UPLOADED     // Option A: admin upload করেছে
  AI_GENERATED // Option B: AI বানিয়েছে
}

enum ThemeStatus {
  DRAFT      // সংরক্ষিত কিন্তু publish হয়নি
  PREVIEW    // Preview করা যাচ্ছে কিন্তু tenant দেখছে না
  PUBLISHED  // Live — tenant-রা select করতে পারছে
}
```

---

## Option A — Theme Package Upload

### Admin কী করবে

```
1. /admin/themes → "Upload Theme" click
2. ZIP file বা JSON file drag & drop করে upload
3. System validate করে, preview দেখায়
4. Admin preview confirm করে "Publish" click করে
5. Theme live ✅
```

### Upload Package Format

**Simple version (JSON only):**
```
my-theme.json     ← config schema (above)
```

**Full version (ZIP):**
```
my-theme.zip
├── config.json   ← required — theme config
├── preview.jpg   ← optional — screenshot
└── README.md     ← optional — notes
```

### Validation (Server Side)

Upload হওয়ার পরে system check করবে:
- `config.json` আছে কিনা
- `key` field unique কিনা (existing theme-এর সাথে conflict নেই)
- Required fields আছে কিনা (`name`, `colors.primary`, `hero.layout`, etc.)
- `customCSS` তে dangerous patterns নেই কিনা (security)
- Google Fonts list valid কিনা

### Preview Flow

```
Upload → Validate → Store in DB (status: DRAFT)
       → Auto-generate preview URL: /theme-preview/[key]?draft=true
       → Admin sees live preview in iframe
       → "Looks good" → Publish button → status: PUBLISHED
```

---

## Option B — AI Theme Builder

### Admin কী করবে

```
1. /admin/themes → "Build with AI" click
2. AI Provider select করবে (Claude / GPT-4 / Gemini)
3. API Key enter করবে (once — stored encrypted)
4. Theme Brief লিখবে (free text, Bangla or English)
5. "Generate" click
6. AI config JSON generate করে — instant preview
7. Admin দেখে, চাইলে prompt edit করে regenerate
8. Satisfied হলে "Publish" click
```

### AI Theme Brief Example

Admin যা লিখবে:
```
একটা হিল রিসোর্টের জন্য theme চাই।
রঙ সবুজ এবং সোনালি।
serif font heading-এ।
hero full screen হবে misty পাহাড়ের ছবি দিয়ে।
শান্ত, প্রকৃতিপ্রেমী feel।
```

### AI Generation Flow

```
Admin Brief
    │
    ▼
System converts brief → structured prompt for AI
    │
    ▼
Claude API / GPT-4 API call
    │
    ▼
AI returns → theme config JSON
    │
    ▼
System validates JSON (same validation as Option A)
    │
    ▼
Instant preview in iframe (/theme-preview/[key]?draft=true)
    │
    ├── "Regenerate" → tweak prompt → new JSON → new preview
    │
    └── "Publish" → status: PUBLISHED → live ✅
```

### AI Prompt Engineering (Internal — User দেখবে না)

System যে prompt AI-কে পাঠাবে:
```
You are a theme config generator for ResortPro, a hotel management SaaS.

Generate a theme config JSON for a resort website based on this brief:
"[admin's brief goes here]"

The JSON must follow this exact schema:
[config schema]

Rules:
- colors must be valid hex codes
- fonts.heading must be "serif" or "sans-serif"  
- hero.layout must be "fullscreen", "split", or "minimal"
- sections array can only contain known section names
- customCSS must be safe — no @import, no external URLs
- Return ONLY valid JSON, no explanation

Brief: [admin brief]
```

### API Key Management

```
/admin/settings → "AI Integration" section

┌─────────────────────────────────────────┐
│  AI Provider Settings                   │
│                                         │
│  Provider  [Claude (Anthropic) ▼]       │
│  API Key   [••••••••••••••••••]  [Save] │
│                                         │
│  ✅ Connected — Claude claude-sonnet-4-6 │
│                                         │
│  [ Test Connection ]                    │
└─────────────────────────────────────────┘
```

- API key stored encrypted in DB (`aiApiKey` field in `SuperAdminSettings`)
- Key never sent to frontend — only used server-side
- Per-generation cost estimated before submit: `~$0.02 per generation`

---

## ConfigThemeRenderer — কীভাবে কাজ করবে

```tsx
// apps/web/src/components/themes/config-renderer/index.tsx

export function ConfigThemeRenderer({ data, config }: {
  data: ThemeProps['data']
  config: ThemeConfig
}) {
  const { primary, accent, background } = config.colors

  return (
    <div style={{ background, color: config.colors.text }}>
      {/* Google Fonts inject */}
      {config.fonts.googleFonts && (
        <GoogleFontsLoader fonts={config.fonts.googleFonts} />
      )}

      {/* Custom CSS inject */}
      {config.customCSS && (
        <style dangerouslySetInnerHTML={{ __html: sanitize(config.customCSS) }} />
      )}

      {/* Sticky navbar */}
      <ConfigNavbar config={config} data={data} />

      {/* Sections — same shared widgets, different styling via config */}
      {config.sections.map(section => (
        <ConfigSection
          key={section}
          section={section}
          config={config}
          data={data}
        />
      ))}

      <ConfigFooter config={config} data={data} />
    </div>
  )
}
```

### Section Components

Config-driven sections use the same shared widgets (BookingForm, AvailabilityCalendar, MenuWidget) — just styled differently based on config:

```tsx
function ConfigSection({ section, config, data }) {
  switch (section) {
    case 'hero':   return <ConfigHero config={config} data={data} />
    case 'about':  return <ConfigAbout config={config} data={data} />
    case 'rooms':  return <ConfigRooms config={config} data={data} />
    // ... etc
  }
}
```

Each `Config*` component reads from `config.colors`, `config.fonts`, `config.hero` etc. to style itself — no hardcoded values.

---

## Admin UI — Pages & Components

### `/admin/themes` — Theme List

```
┌─────────────────────────────────────────────────────┐
│  Themes                          [+ Add Theme ▼]    │
│                                   ├ Upload Package  │
│                                   └ Build with AI   │
│                                                     │
│  BUILT-IN (3)                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │
│  │ Luxe     │ │ Minimal  │ │ Coastal          │    │
│  │ 23 users │ │ 8 users  │ │ 12 users         │    │
│  │ ●  Live  │ │ ●  Live  │ │ ●  Live          │    │
│  └──────────┘ └──────────┘ └──────────────────┘    │
│                                                     │
│  CUSTOM (2)                                         │
│  ┌──────────────────┐ ┌──────────────────┐         │
│  │ Mountain Escape  │ │ Zen Spa          │         │
│  │ Uploaded by you  │ │ AI Generated     │         │
│  │ ⏸  Draft         │ │ ● Live           │         │
│  │ [Preview] [Edit] │ │ [Preview] [Edit] │         │
│  └──────────────────┘ └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### `/admin/themes/upload` — Upload Flow

```
Step 1: Upload
┌─────────────────────────────────────┐
│  Upload Theme Package               │
│                                     │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  │   Drag & drop .json or .zip │    │
│  │   or click to browse        │    │
│  │                             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Supported formats: .json, .zip     │
└─────────────────────────────────────┘

Step 2: Validate
┌─────────────────────────────────────┐
│  ✅ config.json found               │
│  ✅ Required fields present         │
│  ✅ Key "mountain-escape" is unique  │
│  ✅ Colors are valid hex codes       │
│  ✅ No security issues in CSS        │
│                                     │
│          [ Continue → ]             │
└─────────────────────────────────────┘

Step 3: Preview
┌─────────────────────────────────────┐
│  Preview — Mountain Escape          │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │   [live iframe preview]       │  │
│  │                               │  │
│  └───────────────────────────────┘  │
│                                     │
│  [ ← Back ]    [ Publish Theme ✓ ]  │
└─────────────────────────────────────┘
```

### `/admin/themes/ai-builder` — AI Builder

```
┌──────────────────────────────────────────────────────┐
│  Build Theme with AI                                 │
│                                                      │
│  Provider  [Claude (Anthropic) ▼]                    │
│                                                      │
│  Describe your theme:                                │
│  ┌────────────────────────────────────────────────┐  │
│  │ একটা হিল রিসোর্টের জন্য theme চাই। রঙ সবুজ    │  │
│  │ এবং সোনালি। serif font। hero full screen।      │  │
│  │ misty পাহাড়ের feel।                            │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Quick options:                                      │
│  ○ Luxury  ● Eco/Nature  ○ Modern  ○ Boutique        │
│  ○ Beach   ○ Mountain   ○ Heritage ○ Minimalist       │
│                                                      │
│  Estimated cost: ~$0.02                              │
│                                                      │
│                   [ ✨ Generate Theme ]               │
│                                                      │
│  ──────────────────────────────────────────────────  │
│                                                      │
│  Preview — Mountain Mist (AI Generated)              │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │   [live iframe preview]                        │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [ 🔄 Regenerate ]  [ ✏️ Edit Config ]  [ Publish ✓ ]│
└──────────────────────────────────────────────────────┘
```

---

## Backend API Endpoints

```
POST /api/admin/themes/upload
  Body: multipart/form-data (file)
  Returns: { valid: true, preview_url, config }

POST /api/admin/themes/generate
  Body: { provider, prompt, quickOptions }
  Returns: { config, preview_url, estimatedCost }

GET  /api/admin/themes/preview/:key
  Returns: HTML snapshot for iframe

PUT  /api/admin/themes/:key/publish
  Body: { status: 'PUBLISHED' }
  Returns: { success: true }

PUT  /api/admin/themes/:key/config
  Body: { config }  ← manual JSON edit
  Returns: { success: true }

DELETE /api/admin/themes/:key
  (only UPLOADED or AI_GENERATED, not HARDCODED)
```

---

## Security

| Risk | Mitigation |
|------|-----------|
| Malicious CSS (xss via style) | CSS sanitizer library — strip `@import`, `url()`, `expression()`, `javascript:` |
| Oversized uploads | Max 500KB per upload |
| API key exposure | Stored encrypted in DB, never in response body |
| AI prompt injection | System prompt always wraps admin input, validates output schema |
| Arbitrary JSON exec | Config JSON only drives styling — no `eval()`, no code execution |

---

## Implementation Phases

### Phase 1 — Config Renderer Foundation (2-3 days)
- [ ] Define `ThemeConfig` TypeScript type
- [ ] Build `ConfigThemeRenderer` component
- [ ] Build `Config*` section components (Hero, About, Rooms, Gallery, Footer)
- [ ] Register `ConfigThemeRenderer` in registry (key = dynamic)
- [ ] Add `themeType`, `configJson`, `status` fields to DB schema

### Phase 2 — Upload Option A (1-2 days)
- [ ] Upload API endpoint with validation
- [ ] Drag & drop upload UI
- [ ] 3-step wizard (upload → validate → preview → publish)
- [ ] Config JSON editor (for manual tweaks after upload)

### Phase 3 — AI Option B (2-3 days)
- [ ] AI Settings page (API key storage, encrypted)
- [ ] `POST /api/admin/themes/generate` endpoint
- [ ] Prompt engineering for config JSON generation
- [ ] AI Builder UI (prompt → generate → preview → iterate → publish)
- [ ] Provider support: Claude (primary), GPT-4 (secondary)

### Phase 4 — Polish (1 day)
- [ ] Theme marketplace listing in `/admin/themes`
- [ ] One-click duplicate / fork of existing theme
- [ ] Version history (previous config snapshots)
- [ ] Usage stats (how many tenants using each theme)

---

## Summary

```
বর্তমান:  Developer code → git push → deploy → theme live
নতুন:
  Option A: Admin uploads JSON/ZIP → instant preview → publish ✅
  Option B: Admin types prompt → AI generates → instant preview → publish ✅

পুরনো themes (luxe, minimal, coastal):
  আগের মতোই hardcoded — কোনো পরিবর্তন নেই ✅

নতুন themes:
  ConfigThemeRenderer দিয়ে render হবে
  No rebuild needed
  Super admin fully in control ✅
```
