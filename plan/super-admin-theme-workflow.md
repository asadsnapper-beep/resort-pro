# Super Admin — Theme Add করার Workflow

## আসল সমস্যাটা কী

Theme মানে শুধু database entry না — theme মানে **code + metadata** একসাথে।

```
Theme = Code (React component)  +  Metadata (DB entry)
         ↑                              ↑
    Developer লেখে              Admin panel-এ manage হয়
    Deploy করতে হয়             Instantly update হয়
```

Super admin UI থেকে শুধু metadata control করতে পারে।
কিন্তু code ছাড়া সেই theme টা render হবে না।

**এটা কোনো bug না — এটাই সব theme-based SaaS-এর reality।**
Shopify, Webflow, WordPress — সবাই এভাবেই কাজ করে।

---

## বর্তমান Flow (যা আছে)

```
Super Admin                 Developer / Claude              System
    │                              │                          │
    │  1. /admin/themes এ যায়      │                          │
    │  2. "Add Theme" click        │                          │
    │  3. Form fill করে:           │                          │
    │     - Theme name             │                          │
    │     - Key (slug)             │                          │
    │     - Description            │                          │
    │     - Preview image URL      │                          │
    │     - Colors, plan           │                          │
    │  4. "Generate Brief" click   │                          │
    │     ──────── Brief document ──▶                         │
    │                              │  5. Brief দিয়ে           │
    │                              │     theme code লেখে     │
    │                              │     (Claude বা developer)│
    │                              │  6. Code deploy করে      │
    │                              │     (git push → CI/CD)  │
    │                              │     ─────────────────────▶ Registry-তে add
    │  7. "Mark as Ready" click    │                          │
    │  8. Theme live হয় ✅         │                          │
```

**Step 5-6 এ developer/Claude দরকার — এটা unavoidable।**

---

## কেন Code Deploy ছাড়া সম্ভব না

Theme মানে হলো এই ধরনের React component:

```tsx
// apps/web/src/components/themes/mountain/index.tsx

export function MountainTheme({ data }: ThemeProps) {
  return (
    <div style={{ fontFamily: 'Georgia' }}>
      <nav>...</nav>
      <HeroSection />        ← পুরো design কোড
      <RoomsSection />       ← custom layout কোড
      <FooterSection />      ← custom কোড
    </div>
  )
}
```

এই code না থাকলে theme টা exist করে না।
DB-তে `key: "mountain"` থাকলেও যখন render করতে যাবে:

```typescript
// registry.ts
const theme = THEME_REGISTRY['mountain']  // → undefined ❌
```

Theme render হবে না, site 404 দেখাবে।

---

## Proposed Workflow — পরিষ্কার করা

### Step 1 — Admin Brief তৈরি করে (UI)

`/admin/themes` → "Add New Theme" বোতাম:

```
┌──────────────────────────────────────────────────────┐
│  New Theme                                           │
├──────────────────────────────────────────────────────┤
│  Theme Name      [ Mountain Escape              ]    │
│  Key (auto)      [ mountain                     ]    │
│  Description     [ Nature-inspired resort...    ]    │
│                                                      │
│  Colors                                              │
│  Primary         [#2d5a3d]  Accent  [#c8a96e]        │
│  Background      [#faf9f6]                           │
│                                                      │
│  Style                                               │
│  Heading Font    ○ Serif  ● Sans                     │
│  Hero Layout     ● Full-screen  ○ Split  ○ Minimal   │
│  Mood            [ Nature, Earthy, Warm, Forest ]    │
│                                                      │
│  Required Plan   ● STARTER  ○ PRO  ○ ENTERPRISE      │
│  Premium Theme   ○ Free  ● Paid                      │
│                                                      │
│  Special Notes   [ Parallax hero, hover zoom rooms ] │
│                                                      │
│  Sections        ✓Hero ✓About ✓Rooms ✓Gallery        │
│                  ✓Testimonials ✓Availability          │
│                  ✓Booking ✓Contact                   │
│                                                      │
│            [ Save Draft ]  [ Generate Brief → ]      │
└──────────────────────────────────────────────────────┘
```

### Step 2 — System Brief Generate করে

"Generate Brief" click করলে system একটা structured text তৈরি করে:

```
┌──────────────────────────────────────────────────────┐
│  Theme Brief — Mountain Escape                       │
│  Generated: 2025-01-15                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  === THEME BRIEF ===                                 │
│  Key:         mountain                               │
│  Name:        Mountain Escape                        │
│  Colors:                                             │
│    Primary:    #2d5a3d                               │
│    Accent:     #c8a96e                               │
│    Background: #faf9f6                               │
│  Typography: Sans-serif body, Serif headings         │
│  Hero: Full-screen with parallax                     │
│  Mood: Nature, Earthy, Warm, Forest resort           │
│  Special: Parallax hero, hover zoom on room cards    │
│  Sections: hero, about, rooms, gallery,              │
│            testimonials, availability, booking,       │
│            contact                                   │
│  === END BRIEF ===                                   │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  এই brief টা Claude-কে দিন:                 │    │
│  │                                             │    │
│  │  ResortPro project-এ নতুন theme বানাতে হবে │    │
│  │  plan/theme-system.md এর Part B পড়ো।       │    │
│  │  নিচের brief অনুযায়ী theme তৈরি করো:       │    │
│  │  [brief এখানে]                              │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [ Copy Brief ]  [ Copy Claude Prompt ]              │
│                                                      │
│  Status: ⏳ Waiting for code                         │
└──────────────────────────────────────────────────────┘
```

### Step 3 — Claude/Developer Code লেখে

Brief দিয়ে Claude বা developer theme code বানায়।
`plan/theme-system.md` এর Part B তে পুরো guide আছে।

Code তৈরি হলে:
```bash
# apps/web/src/components/themes/mountain/ folder তৈরি হবে
# registry.ts এ add হবে
# git push → CI/CD → deploy
```

### Step 4 — Admin "Mark as Ready"

Deploy হওয়ার পরে admin panel থেকে:

```
Mountain Escape
Status: ⏳ Code Pending  →  [Mark as Ready ✓]
```

Click করলে:
- DB-তে theme `isActive: true` হয়
- Tenant-রা theme picker-এ দেখতে পাবে
- Live হয়ে যাবে ✅

---

## DB-তে কী Store হয়

```prisma
model Theme {
  id           String   @id @default(cuid())
  key          String   @unique  // "mountain" — registry-র key-এর সাথে match করতে হবে
  name         String             // "Mountain Escape"
  description  String?
  previewImage String?            // screenshot URL
  screenshots  String[]           // multiple screenshots
  tags         String[]           // ["Nature", "Earthy"]
  primaryColor String?
  accentColor  String?
  requiredPlan String   @default("FREE")
  isPremium    Boolean  @default(false)
  isActive     Boolean  @default(false)  // false যতক্ষণ code deploy না হয়
  isDefault    Boolean  @default(false)
  installCount Int      @default(0)      // কতটা tenant ব্যবহার করছে
  brief        String?                   // generated brief (JSON)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

---

## কোথায় কোথায় কী Control করা যায়

```
Admin Panel করতে পারে:                Code ছাড়া হয় না:
─────────────────────────────────     ──────────────────────────────
✅ Theme name, description বদলানো     ❌ Theme-এর visual design
✅ Preview image/screenshots           ❌ Section layout
✅ Tags বদলানো                        ❌ Colors (code-এ default হিসেবে)
✅ Required plan বদলানো               ❌ Typography / fonts
✅ Active/inactive toggle             ❌ Animation / effects
✅ Default theme set করা             ❌ New sections যোগ করা
✅ Install count দেখা                 ❌ Responsiveness behavior
✅ Brief generate করা
```

---

## ভবিষ্যতে কি আরও Dynamic করা যাবে?

হ্যাঁ, কিন্তু complexity অনেক বাড়বে। দুটো option আছে:

### Option A — Theme Builder (Low Code)

Admin panel-এ drag-and-drop builder যেখানে:
- Section গুলো on/off করা যাবে
- Colors, fonts live preview-এ বদলানো যাবে
- Section order change করা যাবে

**কিন্তু:** Custom design (parallax, unique layouts) সম্ভব না।
সব theme একইরকম দেখাবে, শুধু color/font আলাদা।

**উদাহরণ:** Webflow-এর template system।

### Option B — Remote Component Loading

Theme code আলাদা server-এ (CDN) deploy হবে।
Runtime-এ `import()` দিয়ে load হবে।

```
Theme Registry (CDN):
https://themes.resortpro.site/mountain/v1.0.js

Runtime:
const ThemeComponent = await import('https://themes.resortpro.site/mountain/v1.0.js')
```

**কিন্তু:** Security nightmare। Arbitrary code execution।
Third-party theme marketplace হলে consider করা যাবে।

### এখনকার জন্য সঠিক approach:

**Code + Deploy = একটু manual, কিন্তু safe, fast, secure।**

Brief → Claude → Code → Deploy → Mark Ready।
মোট সময়: ৩০-৬০ মিনিট।

Shopify, WordPress, Webflow সবাই এই model-ই follow করে।

---

## Summary — Super Admin কী করে

```
1. Admin panel-এ Theme Brief form fill করে    ← 5 মিনিট
2. "Generate Brief" click করে copy করে        ← 1 মিনিট
3. Claude-কে brief দিয়ে theme বানাতে বলে      ← 30-45 মিনিট
4. Code deploy হলে "Mark as Ready" click করে  ← 1 মিনিট

Total: ~1 hour — নতুন theme live ✅
```

**Code deploy করা ছাড়া theme add করা technically সম্ভব না।**
কারণ theme = React component = code।
DB entry শুধু metadata — renderer জানে না কোথায় কী দেখাবে।
