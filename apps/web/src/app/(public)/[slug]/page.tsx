import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { LuxeTemplate } from '@/components/templates/LuxeTemplate';

interface ResortData {
  tenant: {
    name: string;
    slug: string;
    phone?: string;
    email?: string;
    address?: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
    logoUrl?: string;
  };
  website: {
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
    templateId?: string;
  } | null;
  rooms: {
    id: string;
    name: string;
    type: string;
    number: string;
    basePrice: number;
    maxOccupancy: number;
    floor?: number;
    images: string[];
    videos: string[];
    amenities: string[];
    description?: string;
  }[];
}

async function fetchResortData(slug: string): Promise<ResortData | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/site/${slug}`, {
      next: { revalidate: 60 }, // ISR: revalidate every 60s
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

export default async function ResortWebsitePage({ params }: { params: { slug: string } }) {
  const data = await fetchResortData(params.slug);

  if (!data || !data.website) {
    notFound();
  }

  // Template selection (future: switch based on data.website.templateId)
  return <LuxeTemplate data={data} />;
}
