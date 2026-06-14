import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import type { ResortData } from '@/components/themes/types';

async function fetchResortData(slug: string, noCache = false): Promise<ResortData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}`, {
      next: noCache ? { revalidate: 0 } : { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await fetchResortData(params.slug);
  if (!data) return { title: 'Resort Not Found' };
  return {
    title: data.website?.seoTitle || data.tenant.name,
    description: data.website?.seoDescription || `Welcome to ${data.tenant.name}`,
    openGraph: {
      title: data.website?.seoTitle || data.tenant.name,
      description: data.website?.seoDescription || `Welcome to ${data.tenant.name}`,
      images: data.website?.heroImage ? [data.website.heroImage] : [],
    },
  };
}

/** Minimal fallback website data used when ?preview=... but no website is configured yet */
function previewFallback(tenantName: string): ResortData['website'] {
  return {
    heroTitle:   `Welcome to ${tenantName}`,
    heroSubtitle: 'Experience luxury and comfort like never before.',
    aboutTitle:  'About Us',
    aboutText:   'We offer world-class hospitality in a serene setting.',
    galleryImages: [],
    testimonials: [],
  };
}

export default async function ResortWebsitePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { preview?: string };
}) {
  const isPreview = !!searchParams?.preview;
  // Preview mode: bypass 60s cache so changes show immediately
  const data = await fetchResortData(params.slug, isPreview);

  // No tenant at all → hard 404
  if (!data) notFound();

  // No website configured yet → only allow preview mode; live site shows 404
  if (!data.website && !isPreview) notFound();

  // In preview mode with no website content, use a placeholder
  const websiteData = data.website ?? previewFallback(data.tenant.name);

  // ?preview=themeKey → show that theme without saving
  const themeKey = searchParams?.preview || websiteData.templateId;

  // Config-driven theme (uploaded or AI-generated) takes priority over hardcoded
  // In preview mode, skip config-driven theme so we show the previewed theme directly
  const configJson    = isPreview ? null : data.themeConfig;
  const ThemeComponent = getTheme(themeKey);
  const resolvedData: ResortData = { ...data, website: websiteData };

  return (
    <>
      {/* Preview mode banner */}
      {searchParams?.preview && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-gray-900/95 backdrop-blur-sm text-white text-sm px-5 py-2.5 rounded-full shadow-xl border border-gray-700">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Preview mode — <strong>{themeKey}</strong> theme
        </div>
      )}
      {configJson
        ? <ConfigThemeRenderer data={resolvedData} config={configJson} />
        : <ThemeComponent data={resolvedData} />
      }
    </>
  );
}
