import { MetadataRoute } from 'next';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://app.resortpro.site';

async function getResortData(slug: string) {
  try {
    const res = await fetch(`${API}/site/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as { tenant: { slug: string }; rooms: { id: string }[] } | null;
  } catch {
    return null;
  }
}

export default async function sitemap({
  params,
}: {
  params: { slug: string };
}): Promise<MetadataRoute.Sitemap> {
  const data = await getResortData(params.slug);
  if (!data) return [];

  const base = `${BASE}/${data.tenant.slug}`;

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${base}/rooms`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/checkout`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  return staticPages;
}
