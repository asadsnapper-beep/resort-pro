import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import { TemplateThemeRenderer } from '@/components/themes/template-renderer';
import { compileTemplate } from '@/components/themes/template-renderer/compile';
import { PreviewPage } from './PreviewPage';
import { getSiteData, resolvePreviewConfig } from './site-data';
import type { ResortData } from '@/components/themes/types';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getSiteData(params.slug);
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
  const data = await getSiteData(params.slug);

  // No tenant at all → hard 404
  if (!data) notFound();

  // No website configured yet → only allow preview mode; live site shows 404
  if (!data.website && !isPreview) notFound();

  // In preview mode with no website content, use a placeholder
  const websiteData = data.website ?? previewFallback(data.tenant.name);

  // ?preview=themeKey → show that theme without saving
  const themeKey = searchParams?.preview || websiteData.templateId;

  // Config-driven theme (uploaded or AI-generated) takes priority over hardcoded.
  // In preview mode the config has to come from the *previewed* theme, not the
  // saved one — looking it up is what WB-004 was missing; see
  // resolvePreviewConfig for what the owner saw instead.
  const configJson     = isPreview
    ? await resolvePreviewConfig(themeKey, data)
    : data.themeConfig;
  const ThemeComponent = getTheme(themeKey);
  const resolvedData: ResortData = { ...data, website: websiteData };

  // Preview mode → client component for live postMessage updates
  // (Tier 2 live-editing preview is not wired up yet — a TEMPLATE key still
  // falls back here, and /theme-preview/[key] covers static preview for those
  // in the meantime)
  if (isPreview) {
    return (
      <PreviewPage
        initialData={resolvedData}
        themeKey={themeKey ?? 'luxe'}
        configJson={configJson}
      />
    );
  }

  // Tier 2 template theme — Handlebars-compile server-side (real data baked
  // into the HTML string here, so SSR output has real content for SEO), then
  // hand off to the client renderer for widget hydration + section hide/reorder.
  if (data.themeType === 'TEMPLATE' && data.templateHtml) {
    const compiledHtml = compileTemplate(data.templateHtml, resolvedData);
    // CSS can reference the same tokens as HTML (e.g. `background: {{website.primaryColor}}`)
    // so it needs the same Handlebars pass — raw `{{ }}` left in is invalid CSS.
    const compiledCss = data.templateCss ? compileTemplate(data.templateCss, resolvedData) : null;
    return <TemplateThemeRenderer html={compiledHtml} css={compiledCss} data={resolvedData} />;
  }

  return (
    <>
      {configJson
        ? <ConfigThemeRenderer data={resolvedData} config={configJson} />
        : <ThemeComponent data={resolvedData} />
      }
    </>
  );
}
