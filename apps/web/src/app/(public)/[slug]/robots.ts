import { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://app.resortpro.site';

export default function robots({
  params,
}: {
  params: { slug: string };
}): MetadataRoute.Robots {
  const base = `${BASE}/${params.slug}`;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/checkout', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
