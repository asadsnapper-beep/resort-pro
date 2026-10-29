import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTheme } from '@/components/themes/registry';
import { ConfigThemeRenderer } from '@/components/themes/config-renderer';
import { TemplateThemeRenderer } from '@/components/themes/template-renderer';
import { compileTemplate } from '@/components/themes/template-renderer/compile';
import { PreviewPage } from './PreviewPage';
import { getSiteData, resolvePreviewTheme, type PreviewTemplate } from './site-data';
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

/**
 * Handlebars-compile a Tier 2 theme against real data, HTML and CSS together.
 *
 * The CSS needs the same pass as the HTML because it can reference the same
 * tokens (`background: {{website.primaryColor}}`) and a raw `{{ }}` left in is
 * invalid CSS. Both the live site and the preview compile here, so a previewed
 * Tier 2 theme cannot drift from the published one.
 */
function compileTier2(template: PreviewTemplate, data: ResortData): PreviewTemplate {
  return {
    html: compileTemplate(template.html, data),
    css:  template.css ? compileTemplate(template.css, data) : null,
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
  // In preview mode the theme has to come from the *previewed* key, not the
  // saved one — looking it up is what WB-004 was missing; see
  // resolvePreviewTheme for what the owner saw instead.
  const previewTheme   = isPreview ? await resolvePreviewTheme(themeKey, data) : null;
  const configJson     = isPreview ? previewTheme?.config ?? null : data.themeConfig;
  const ThemeComponent = getTheme(themeKey);
  const resolvedData: ResortData = { ...data, website: websiteData };

  // Preview mode → client component for live postMessage updates.
  //
  // A Tier 2 template is compiled here rather than in the client component:
  // Handlebars is a server dependency, and compiling before the response means
  // the owner's first paint is the real theme instead of a flash of fallback.
  // The cost is that the compiled HTML carries saved content, so text the
  // owner is still typing does not appear inside it — the banner says so.
  if (isPreview) {
    return (
      <PreviewPage
        initialData={resolvedData}
        themeKey={themeKey ?? 'luxe'}
        configJson={configJson}
        template={previewTheme?.template ? compileTier2(previewTheme.template, resolvedData) : null}
      />
    );
  }

  // Tier 2 template theme — compiled server-side so the SSR output carries real
  // content for SEO, then handed to the client renderer for widget hydration
  // and section hide/reorder.
  if (data.themeType === 'TEMPLATE' && data.templateHtml) {
    const compiled = compileTier2({ html: data.templateHtml, css: data.templateCss ?? null }, resolvedData);
    return <TemplateThemeRenderer html={compiled.html} css={compiled.css} data={resolvedData} />;
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
