import { MetadataRoute } from 'next';
import { getBlogPosts } from '@/lib/blog';

const BASE_URL = 'https://stay.resortpro.site';
const API      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getVisibleResorts() {
  try {
    const res  = await fetch(`${API}/api/discovery/resorts?limit=500`, { next: { revalidate: 3600 } });
    const json = await res.json();
    return (json.data?.resorts ?? []) as { slug: string; updatedAt?: string }[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const resorts   = await getVisibleResorts();
  const blogPosts = getBlogPosts();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url:              `${BASE_URL}/discover`,
      lastModified:     new Date(),
      changeFrequency:  'daily',
      priority:         1.0,
    },
    {
      url:              `${BASE_URL}/discover?view=list`,
      lastModified:     new Date(),
      changeFrequency:  'daily',
      priority:         0.9,
    },
    {
      url:              `${BASE_URL}/blog`,
      lastModified:     new Date(),
      changeFrequency:  'weekly',
      priority:         0.8,
    },
  ];

  // Resort pages
  const resortPages: MetadataRoute.Sitemap = resorts.map(r => ({
    url:             `${BASE_URL}/resort/${r.slug}`,
    lastModified:    new Date(),
    changeFrequency: 'weekly' as const,
    priority:        0.7,
  }));

  // Blog pages
  const blogPages: MetadataRoute.Sitemap = blogPosts.map(post => ({
    url:             `${BASE_URL}/blog/${post.slug}`,
    lastModified:    new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority:        0.6,
  }));

  return [...staticPages, ...resortPages, ...blogPages];
}
