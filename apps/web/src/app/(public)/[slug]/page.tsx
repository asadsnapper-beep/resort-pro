import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import type { ResortData } from '@/components/themes/types';

async function fetchResortData(slug: string): Promise<ResortData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}`, {
      next: { revalidate: 60 },
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

export default async function ResortWebsitePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { preview?: string };
}) {
  const data = await fetchResortData(params.slug);

  if (!data || !data.website) notFound();

  // ?preview=themeKey → show that theme without saving
  const themeKey = searchParams?.preview || data.website?.templateId;

  // Config-driven theme (uploaded or AI-generated) takes priority over hardcoded
  const configJson    = data.themeConfig;
  const ThemeComponent = getTheme(themeKey);

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
        ? <ConfigThemeRenderer data={data} config={configJson} />
        : <ThemeComponent data={data} />
      }
    </>
  );
}
