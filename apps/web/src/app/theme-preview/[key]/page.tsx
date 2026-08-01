import { notFound } from 'next/navigation';
import { getTheme, isHardcodedTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import { TemplateThemeRenderer } from '@/components/themes/template-renderer';
import { compileTemplate } from '@/components/themes/template-renderer/compile';
import type { ResortData } from '@/components/themes/types';
import type { ThemeConfig } from '@/components/themes/config-renderer/config-types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ── Mock data — fallback when demo tenant not seeded ───────────────────── */
const MOCK_DATA: ResortData = {
  tenant: {
    name:         'Ocean Pearl Resort',
    slug:         'demo',
    phone:        '+880 1712-345678',
    email:        'info@oceanpearl.com',
    address:      'Cox\'s Bazar, Chittagong, Bangladesh',
    currency:     'BDT',
    checkInTime:  '14:00',
    checkOutTime: '11:00',
  },
  website: {
    heroTitle:    'Welcome to Ocean Pearl Resort',
    heroSubtitle: 'Where luxury meets the sea',
    heroImage:    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80',
    aboutTitle:   'A Sanctuary by the Sea',
    aboutText:    'Nestled along the pristine coastline of Cox\'s Bazar, Ocean Pearl Resort offers an unparalleled blend of luxury and natural beauty. Our world-class facilities and personalized service ensure every moment of your stay is extraordinary.',
    aboutImage:   'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
      'https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&q=80',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80',
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
      'https://images.unsplash.com/photo-1606046604972-77cc76aff43d?w=800&q=80',
    ],
    testimonials: [
      { name: 'Rahman Ahmed', text: 'An absolutely breathtaking experience. The ocean view suite was magnificent and the staff went above and beyond.', rating: 5 },
      { name: 'Sarah Johnson', text: 'Perfect escape from city life. The spa treatments were divine and the food was exceptional.', rating: 5 },
      { name: 'Karim Hossain', text: 'Stunning property with impeccable service. Will definitely return for our anniversary.', rating: 4 },
    ],
    primaryColor:   '#1a6b5e',
    accentColor:    '#d4a853',
    whatsappNumber: '8801712345678',
    facebookUrl:    'https://facebook.com',
    instagramUrl:   'https://instagram.com',
    seoTitle:       'Ocean Pearl Resort — Luxury by the Sea',
    seoDescription: 'Experience unparalleled luxury at Ocean Pearl Resort in Cox\'s Bazar.',
  },
  rooms: [
    {
      id:           'room-1',
      name:         'Deluxe Ocean View',
      type:         'DELUXE',
      number:       '201',
      basePrice:    8000,
      maxOccupancy: 2,
      floor:        2,
      images:       ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'],
      videos:       [],
      amenities:    ['King Bed', 'Ocean View', 'AC', 'Mini Bar', 'WiFi', 'Bathtub'],
      description:  'Breathtaking ocean views from your private balcony. Features a king-sized bed, marble bathroom with soaking tub, and premium minibar.',
    },
    {
      id:           'room-2',
      name:         'Presidential Suite',
      type:         'SUITE',
      number:       '501',
      basePrice:    22000,
      maxOccupancy: 4,
      floor:        5,
      images:       ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80'],
      videos:       [],
      amenities:    ['2 Bedrooms', 'Private Pool', 'Butler Service', 'Panoramic View', 'Jacuzzi', 'Kitchen'],
      description:  'The pinnacle of luxury living. A sprawling 2-bedroom suite with a private plunge pool, panoramic ocean views, and dedicated butler service.',
    },
    {
      id:           'room-3',
      name:         'Garden Villa',
      type:         'VILLA',
      number:       'V-01',
      basePrice:    14000,
      maxOccupancy: 3,
      floor:        1,
      images:       ['https://images.unsplash.com/photo-1602002418082-a4443e081dd1?w=800&q=80'],
      videos:       [],
      amenities:    ['Private Garden', 'Outdoor Shower', 'AC', 'WiFi', 'Hammock', 'Kitchenette'],
      description:  'Your own private tropical garden oasis. A secluded villa surrounded by lush greenery with an outdoor shower and direct garden access.',
    },
    {
      id:           'room-4',
      name:         'Standard Room',
      type:         'STANDARD',
      number:       '101',
      basePrice:    4500,
      maxOccupancy: 2,
      floor:        1,
      images:       ['https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80'],
      videos:       [],
      amenities:    ['Queen Bed', 'AC', 'WiFi', 'TV', 'En-suite Bathroom'],
      description:  'Comfortable and well-appointed room with all modern amenities for a relaxing stay.',
    },
  ],
};

/* ── Preview banner ─────────────────────────────────────────────────────── */
function PreviewBanner({ themeKey, themeType }: { themeKey: string; themeType?: string }) {
  const badge = themeType === 'AI_GENERATED' ? '🤖 AI' : themeType === 'UPLOADED' ? '📦 Uploaded' : themeType === 'TEMPLATE' ? '🧩 Template' : '🎨 Hardcoded';
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-950/95 backdrop-blur-md text-white text-sm px-5 py-3 rounded-2xl shadow-2xl border border-gray-700/80">
      <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
      <span>
        Previewing <strong className="text-indigo-300 font-mono">{themeKey}</strong>
        {' '}<span className="text-gray-500 text-xs">{badge}</span>
        {' '}— <span className="text-gray-400">mock data</span>
      </span>
      <a href="/admin/themes"
        className="ml-2 text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors text-gray-300">
        ← Back to Admin
      </a>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */
export default async function ThemePreviewPage({
  params,
}: {
  params: { key: string };
}) {
  const { key } = params;

  // 1. Try to load live demo tenant data
  let data: ResortData = MOCK_DATA;
  try {
    const res = await fetch(`${API_URL}/site/demo`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json.data?.website) data = json.data;
    }
  } catch { /* fallback to mock */ }

  // 2. Fetch theme config from DB via public endpoint
  let configJson: ThemeConfig | null = null;
  let themeType: string | undefined;
  let templateHtml: string | null = null;
  let templateCss: string | null = null;
  try {
    const res = await fetch(`${API_URL}/site/theme/${key}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      themeType = json.data?.themeType;
      if (json.data?.configJson) {
        configJson = json.data.configJson as ThemeConfig;
      }
      if (themeType === 'TEMPLATE') {
        templateHtml = json.data?.templateHtml ?? null;
        templateCss = json.data?.templateCss ?? null;
      }
    }
  } catch { /* no config — fall through to hardcoded */ }

  // 3. If not in DB and not hardcoded → 404
  if (!configJson && !templateHtml && !isHardcodedTheme(key)) {
    notFound();
  }

  // 4. Render: template (Tier 2), config-driven (Tier 1), or hardcoded (Tier 3)
  if (templateHtml) {
    const resolvedData: ResortData = { ...data, website: { ...data.website!, templateId: key } };
    const compiledHtml = compileTemplate(templateHtml, resolvedData);
    const compiledCss = templateCss ? compileTemplate(templateCss, resolvedData) : null;
    return (
      <>
        <TemplateThemeRenderer html={compiledHtml} css={compiledCss} data={resolvedData} />
        <PreviewBanner themeKey={key} themeType={themeType} />
      </>
    );
  }

  if (configJson) {
    return (
      <>
        <ConfigThemeRenderer data={data} config={configJson} />
        <PreviewBanner themeKey={key} themeType={themeType} />
      </>
    );
  }

  const ThemeComponent = getTheme(key);
  if (!ThemeComponent) notFound();

  if (data.website) {
    data = { ...data, website: { ...data.website, templateId: key } };
  }

  return (
    <>
      <ThemeComponent data={data} />
      <PreviewBanner themeKey={key} themeType="HARDCODED" />
    </>
  );
}

export async function generateMetadata({ params }: { params: { key: string } }) {
  return {
    title: `Preview — ${params.key} theme | ResortPro Admin`,
  };
}
