# Part 12 — Theme System (Complete Plan)

## Overview

ResortPro-এর public website builder-এর জন্য একটা powerful, extensible theme system।
যেকোনো developer নতুন theme বানাতে পারবে। Super admin theme manage করবে। Owner theme select করবে।

---

## Feature 1 — Super Admin: Theme Management Panel

### কী থাকবে
Super admin dashboard-এ `/admin/themes` page:

- **Theme List** — সব installed themes দেখাবে (name, preview image, author, version, status)
- **Enable / Disable** — theme on/off করা যাবে। Disabled theme owner-রা দেখতে পাবে না
- **Set Default** — নতুন tenant register করলে কোন theme default হবে
- **Upload Theme** — ZIP file upload করে নতুন theme install করা (future)
- **Theme Preview** — admin থেকে সরাসরি theme preview দেখা যাবে
- **Delete Theme** — unused theme মুছে ফেলা

### Database
```prisma
model Theme {
  id           String   @id @default(cuid())
  key          String   @unique   // "luxe", "coastal", "minimal"
  name         String             // "Luxe Gold"
  description  String
  previewImage String             // thumbnail URL
  author       String   @default("ResortPro Team")
  version      String   @default("1.0.0")
  isActive     Boolean  @default(true)
  isDefault    Boolean  @default(false)
  isPremium    Boolean  @default(false)
  requiredPlan String   @default("STARTER")  // STARTER | PROFESSIONAL | ENTERPRISE
  tags         String[] @default([])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### API Routes
```
GET    /api/admin/themes          — সব themes list
POST   /api/admin/themes          — নতুন theme register
PATCH  /api/admin/themes/:key     — enable/disable/set default
DELETE /api/admin/themes/:key     — theme delete
```

---

## Feature 2 — Theme Development Instructions

### File Structure (প্রতিটি theme-এর জন্য)
```
src/components/themes/
└── {theme-key}/
    ├── index.tsx          ← Main theme component (required)
    ├── config.ts          ← Theme metadata & section config (required)
    └── sections/
        ├── HeroSection.tsx
        ├── AboutSection.tsx
        ├── RoomsSection.tsx
        ├── GallerySection.tsx
        ├── TestimonialsSection.tsx
        ├── FooterSection.tsx
        └── index.ts
```

### config.ts Template
```typescript
import type { ThemeConfig } from '../types';

export const config: ThemeConfig = {
  key: 'mytheme',           // unique, lowercase, no spaces
  name: 'My Theme Name',
  description: 'Short description of the theme',
  previewImage: '/themes/mytheme/preview.jpg',
  author: 'Developer Name',
  version: '1.0.0',
  tags: ['luxury', 'modern'],
  isPremium: false,
  requiredPlan: 'STARTER',
  sections: ['hero', 'about', 'rooms', 'gallery', 'testimonials', 'footer'],
};
```

### index.tsx Template
```typescript
import type { ResortData } from '../types';
import { HeroSection } from './sections/HeroSection';
import { AboutSection } from './sections/AboutSection';
import { RoomsSection } from './sections/RoomsSection';
import { GallerySection } from './sections/GallerySection';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { FooterSection } from './sections/FooterSection';

export default function MyTheme({ data }: { data: ResortData }) {
  return (
    <main>
      <HeroSection data={data} />
      <AboutSection data={data} />
      <RoomsSection data={data} />
      <GallerySection data={data} />
      <TestimonialsSection data={data} />
      <FooterSection data={data} />
    </main>
  );
}
```

### ResortData Type (সব theme-এ available)
```typescript
interface ResortData {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    logo?: string;
    currency: string;
  };
  website: {
    templateId: string;
    heroTitle: string;
    heroSubtitle?: string;
    heroImage?: string;
    aboutTitle?: string;
    aboutText?: string;
    aboutImage?: string;
    galleryImages?: string[];
    testimonials?: { name: string; text: string; rating: number; avatar?: string }[];
    seoTitle?: string;
    seoDescription?: string;
    primaryColor?: string;
    accentColor?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
    whatsappNumber?: string;
    tripadvisorUrl?: string;
  };
  rooms: {
    id: string;
    name: string;
    type: string;
    description?: string;
    pricePerNight: number;
    maxGuests: number;
    bedType?: string;
    sizesqft?: number;
    images: string[];
    amenities: string[];
    isAvailable: boolean;
  }[];
  menu?: {
    categories: {
      id: string;
      name: string;
      items: {
        id: string;
        name: string;
        description?: string;
        price: number;
        image?: string;
        isAvailable: boolean;
        isVeg?: boolean;
      }[];
    }[];
  };
}
```

### Theme Registry-তে Add করা
`src/components/themes/registry.ts` ফাইলে:
```typescript
import MyTheme from './mytheme';
import { config as myThemeConfig } from './mytheme/config';

export const themes = {
  luxe: LuxeTheme,
  minimal: MinimalTheme,
  coastal: CoastalTheme,
  mytheme: MyTheme,        // ← এখানে add করো
};

export const themeConfigs = [luxeConfig, minimalConfig, coastalConfig, myThemeConfig];
```

---

## Feature 3 — Claude দিয়ে Theme বানানোর Instructions

### Claude-কে দিতে হবে এই prompt:
```
ResortPro-এ নতুন theme বানাও।

Theme name: [NAME]
Style: [e.g., "Tropical paradise", "Modern minimalist", "Heritage boutique"]
Color palette: primary=[HEX], accent=[HEX]
Special features: [e.g., "Full-screen video hero", "Dark mode", "Parallax scrolling"]

File structure follow করো:
src/components/themes/[key]/
  - index.tsx (main component)
  - config.ts (metadata)
  - sections/ (HeroSection, AboutSection, RoomsSection, GallerySection, TestimonialsSection, FooterSection)

ResortData type থেকে data নাও।
primaryColor: {data.website.primaryColor}
accentColor: {data.website.accentColor}
Tailwind CSS use করো, external library নয়।
Mobile-first, responsive design।
```

### Rules for Claude-built themes:
- শুধু Tailwind CSS (no external CSS libraries)
- `data.website.primaryColor` এবং `data.website.accentColor` inline style-এ use করো
- Booking form widget: `import { BookingForm } from '../_widgets/BookingForm'`
- Contact form: `import { ContactForm } from '../_widgets/ContactForm'`
- Social links: `import { SocialLinks } from '../_widgets/SocialLinks'`
- Image fallback সবসময় দাও (`|| '/placeholder-resort.jpg'`)
- `'use client'` শুধু interactive section-এ

---

## Feature 4 — Owner Dashboard: Theme Selector (Improved)

### বর্তমান সমস্যা
- শুধু thumbnail দেখায়, proper preview নেই
- Plan restriction নেই (premium themes সবাই দেখতে পায়)
- Theme details কম

### নতুন UI Plan

#### Theme Card (প্রতিটি theme-এর জন্য)
```
┌─────────────────────────────┐
│  [Preview Screenshot]       │
│                             │
│  Luxe Gold         [Free]   │
│  ⭐ Premium                  │
│  Luxury · Gold · Full-Hero  │
│                             │
│  [Preview] [Select]         │
└─────────────────────────────┘
```

#### Theme Preview Modal
- Full-screen modal-এ theme preview দেখাবে
- Iframe দিয়ে actual `/{slug}?preview=luxe` URL লোড করবে
- "Apply This Theme" button

#### Plan Lock
```typescript
// Premium theme হলে upgrade prompt দেখাবে
if (theme.isPremium && tenant.plan === 'STARTER') {
  return <UpgradePrompt requiredPlan="PROFESSIONAL" />;
}
```

#### Filter Bar
```
All | Free | Premium | Luxury | Minimal | Coastal | Modern
```

---

## Feature 5 — Subdomain System

### Concept
Custom domain না থাকলে tenant পাবে:
```
{slug}.resortpro.site
```

### কীভাবে কাজ করবে

#### Option A — Wildcard DNS + Middleware (Recommended)
```
*.resortpro.site → same server
```

Cloudflare DNS:
```
Type    Name    Content
A       *       88.99.141.243   (Proxied)
```

Next.js middleware (`middleware.ts`):
```typescript
export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.replace('.resortpro.site', '');

  // Subdomain detected (not www, not app)
  if (subdomain && subdomain !== 'app' && subdomain !== 'www') {
    // Rewrite to /{slug} page
    return NextResponse.rewrite(
      new URL(`/${subdomain}${request.nextUrl.pathname}`, request.url)
    );
  }
}
```

#### Owner Dashboard-এ Website Settings
```
┌─────────────────────────────────────────────────┐
│  Your Website URL                               │
│                                                 │
│  ● Subdomain (Free)                             │
│    https://grandpalace.resortpro.site      [✓] │
│                                                 │
│  ● Custom Domain (Professional+)               │
│    [grandpalaceresort.com          ] [Verify]  │
│                                                 │
│  DNS Setup Instructions ↓                      │
│  Add CNAME: www → app.resortpro.site           │
└─────────────────────────────────────────────────┘
```

#### Custom Domain Flow
1. Owner custom domain input করে
2. System DNS verification instructions দেখায়
3. Owner Cloudflare/DNS-এ CNAME add করে
4. System verify করে (TXT record বা CNAME check)
5. Verified হলে `domainVerified: true` DB-তে save
6. Coolify-তে new subdomain Traefik rule add হয়

---

## Feature 6 — Large Menu & Rooms UI/UX Solution

### সমস্যা
- 100+ menu item → scroll করতে করতে হারিয়ে যায়
- 50+ room → comparison কঠিন, filter নেই

---

### Menu UI Solution

#### Public Website Menu Page
```
[Breakfast] [Lunch] [Dinner] [Drinks] [Desserts]  ← Sticky category tabs

🔍 Search menu...                                  ← Search bar

─── Breakfast ────────────────────────────────────

┌──────────┬──────────┬──────────┬──────────┐
│ 🍳        │ 🥞        │ 🥐        │ ☕        │
│ Eggs     │ Pancakes │ Croissant│ Coffee   │
│ $12      │ $10      │ $8       │ $5       │
│ [Add+]   │ [Add+]   │ [Add+]   │ [Add+]   │
└──────────┴──────────┴──────────┴──────────┘

─── Lunch ────────────────────────────────────────
...
```

**Features:**
- Sticky category tabs (scroll করলে সাথে চলে)
- Search bar (real-time filter)
- Grid view (4 col desktop, 2 col mobile)
- Item modal — photo, description, allergens, variants
- "Add to order" cart (guest ordering flow)
- Veg/Non-veg filter toggle 🟢🔴

#### Dashboard Menu Management
```
Category: [Breakfast ▾]  [+ Add Category]  [Reorder ↕]

┌─────────────────────────────────────────────────┐
│ ≡  Eggs Benedict            $12   [✓ Active]   │
│    Classic hollandaise, Canadian bacon          │
│                        [Edit] [Hide] [Delete]   │
├─────────────────────────────────────────────────┤
│ ≡  Pancake Stack            $10   [✓ Active]   │
│    With maple syrup & berries                   │
│                        [Edit] [Hide] [Delete]   │
└─────────────────────────────────────────────────┘

[+ Add Item to Breakfast]
```

**Features:**
- Drag & drop reorder (≡ handle)
- Bulk hide/show
- Category collapse/expand
- Quick price edit (inline)
- Image upload per item

---

### Rooms UI Solution

#### Public Website Rooms Page
```
🔍 Search rooms...    [Filter ▾]    [Grid ⊞] [List ☰]

Filters:
[All Types] [Suite] [Deluxe] [Standard]
[2 Guests] [4 Guests] [6 Guests]
Price: $50 ──●────── $500

─── Available Rooms (12) ─────────────────────────

┌─────────────────┐  ┌─────────────────┐
│ [Photo gallery] │  │ [Photo gallery] │
│ ← 1/4 →        │  │ ← 1/3 →        │
│                 │  │                 │
│ Ocean Suite     │  │ Garden Deluxe   │
│ ⭐⭐⭐⭐⭐ 4.8    │  │ ⭐⭐⭐⭐ 4.5      │
│ 👥 2  📐 450sqft│  │ 👥 4  📐 320sqft│
│ 🛏 King Bed     │  │ 🛏 Twin Beds    │
│ ──────────────  │  │ ──────────────  │
│ WiFi AC Pool +3 │  │ WiFi AC Gym +2  │
│                 │  │                 │
│ $299/night      │  │ $199/night      │
│ [View] [Book Now│  │ [View] [Book Now│
└─────────────────┘  └─────────────────┘

Compare: [Room A] vs [Room B]  ← Compare feature
```

**Features:**
- Search by name/type
- Filter by: type, guests, price range, amenities
- Grid / List view toggle
- Photo gallery per card (swipeable)
- Room comparison (select 2-3 rooms, side-by-side)
- Availability calendar inline
- "Similar rooms" suggestion

#### Room Detail Modal/Page
```
┌─────────────────────────────────────────────────┐
│  ← Back to Rooms                               │
│                                                 │
│  [Large Photo]  [Photo 2] [Photo 3] [Photo 4]  │
│                                                 │
│  Ocean Suite                      $299/night   │
│  ⭐⭐⭐⭐⭐ 4.8 (24 reviews)                      │
│                                                 │
│  👥 Max 2 Guests  📐 450 sq ft  🛏 King Bed     │
│  🏢 Floor 5       🌊 Ocean View  🚿 Rain Shower  │
│                                                 │
│  ─── Description ──────────────────────────    │
│  Stunning ocean views from every angle...      │
│                                                 │
│  ─── Amenities ────────────────────────────    │
│  ✅ Free WiFi    ✅ Air Conditioning             │
│  ✅ Mini Bar     ✅ Room Service                 │
│  ✅ Balcony      ✅ Smart TV                     │
│                                                 │
│  ─── Check Availability ───────────────────    │
│  [Calendar widget]                             │
│                                                 │
│  [Book Now — $299/night]                       │
└─────────────────────────────────────────────────┘
```

#### Dashboard Rooms Management
```
[Grid View ⊞] [Table View ☰]     [+ Add Room]

Filter: [All] [Available] [Occupied] [Maintenance]
Sort: [Name ▾] [Price] [Type]

Table View:
┌──────────────┬────────┬───────┬─────────┬────────┐
│ Room         │ Type   │ Price │ Status  │ Action │
├──────────────┼────────┼───────┼─────────┼────────┤
│ 101 Ocean    │ Suite  │ $299  │ 🟢 Avail│ ⋯     │
│ 102 Garden   │ Deluxe │ $199  │ 🔴 Occup│ ⋯     │
│ 103 Mountain │ Std    │ $99   │ 🟡 Maint│ ⋯     │
└──────────────┴────────┴───────┴─────────┴────────┘

Bulk Actions: [Select All] [Bulk Edit Price] [Export]
```

---

## Implementation Priority

### Phase 1 — Quick Wins (1-2 days each)
1. ✅ Theme registry database sync (API → DB)
2. ✅ Owner theme selector improvements (filter, preview modal)
3. ✅ Super admin theme management page
4. ✅ Subdomain middleware (wildcard DNS)

### Phase 2 — Medium (3-5 days each)
5. ✅ Menu UI overhaul (sticky tabs, search, grid)
6. ✅ Rooms UI overhaul (filter, comparison, gallery)
7. ✅ Theme development docs (THEME_GUIDE.md)

### Phase 3 — Complex (1 week+)
8. ✅ Custom domain verification system
9. ✅ Theme upload system (ZIP)
10. ✅ Room detail page with booking flow

---

## Files to Create/Modify

### New Files
```
apps/api/src/routes/themes.ts                    ← Theme management API
apps/web/src/app/admin/(panel)/themes/page.tsx   ← Super admin themes page
apps/web/src/app/(dashboard)/dashboard/website/  ← Improved website pages
  ├── page.tsx                                    ← Add theme preview modal
  └── components/
      ├── ThemePreviewModal.tsx
      ├── SubdomainSettings.tsx
      └── CustomDomainSettings.tsx
apps/web/src/middleware.ts                        ← Subdomain routing
apps/web/src/components/themes/
  └── _widgets/
      └── RoomGallery.tsx                        ← Swipeable room photos
docs/THEME_DEVELOPMENT_GUIDE.md                  ← Claude + developer guide
```

### Modified Files
```
apps/web/src/components/themes/registry.ts       ← DB-driven theme list
apps/web/src/app/(public)/[slug]/page.tsx        ← Subdomain support
packages/database/prisma/schema.prisma           ← Theme model add
```
