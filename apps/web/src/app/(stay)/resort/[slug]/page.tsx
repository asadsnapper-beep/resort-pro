import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { MapPin, Globe, Phone, Mail, Home, ChevronLeft, Star, ExternalLink, Instagram } from 'lucide-react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Resort {
  slug:                string;
  name:                string;
  country:             string;
  category:            string;
  shortDescription:    string;
  coverImageUrl:       string | null;
  priceFrom:           number | null;
  latitude:            number | null;
  longitude:           number | null;
  website:             string | null;
  phone:               string | null;
  email:               string | null;
  address:             string | null;
  roomCount:           number;
  url:                 string;
  // Revenue fields
  isFeatured:          boolean;
  featuredBadge:       string | null;
  affiliateUrl:        string | null;
  affiliateSource:     string | null;
  tier:                string;
  galleryImages:       string[];
  amenitiesHighlights: string[];
  bookingPhone:        string | null;
  instagramHandle:     string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  eco: '🌿 Eco Resort', agro: '🌾 Agro Resort', beach: '🏖️ Beach Resort',
  hill: '⛰️ Hill Resort', city: '🏙️ City Hotel', heritage: '🏛️ Heritage Property',
  resort: '🏨 Resort',
};

async function getResort(slug: string): Promise<Resort | null> {
  try {
    const res = await fetch(`${API}/api/discovery/resorts/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const resort = await getResort(params.slug);
  if (!resort) return { title: 'Resort Not Found' };
  return {
    title: `${resort.name} — stay.resortpro.site`,
    description: resort.shortDescription || `Discover ${resort.name}, a ${resort.category} resort.`,
    openGraph: {
      title:       resort.name,
      description: resort.shortDescription ?? '',
      images:      resort.coverImageUrl ? [resort.coverImageUrl] : [],
    },
  };
}

// ─── Affiliate source display labels ──────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  'booking.com': 'Booking.com',
  'agoda':       'Agoda',
  'direct':      'Direct Booking',
  'custom':      'Book Online',
};

export default async function ResortDetailPage({ params }: { params: { slug: string } }) {
  const resort = await getResort(params.slug);
  if (!resort) notFound();

  // Primary booking target: affiliate URL > website
  const bookingUrl    = resort.affiliateUrl ?? resort.website;
  const bookingLabel  = resort.affiliateUrl
    ? `Book via ${SOURCE_LABELS[resort.affiliateSource ?? ''] ?? 'Partner'} →`
    : `Book at ${resort.name} →`;

  // WhatsApp URL
  const whatsappUrl = resort.bookingPhone
    ? `https://wa.me/${resort.bookingPhone.replace(/\D/g, '')}?text=Hello%2C%20I'm%20interested%20in%20booking%20${encodeURIComponent(resort.name)}`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <Link href="/discover" className="inline-flex items-center gap-1.5 text-sm text-[#1a6b5e] hover:underline mb-5">
        <ChevronLeft className="w-4 h-4" /> Back to Discovery
      </Link>

      {/* Cover */}
      <div className="rounded-2xl overflow-hidden h-56 sm:h-72 bg-gradient-to-br from-[#1a6b5e] to-[#145a4f] mb-6 relative">
        {resort.coverImageUrl ? (
          <img src={resort.coverImageUrl} alt={resort.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="w-16 h-16 text-white/20" />
          </div>
        )}

        {/* Category chip */}
        <span className="absolute top-3 left-3 bg-white/90 text-[#1a6b5e] text-xs font-semibold px-2.5 py-1 rounded-full">
          {CATEGORY_LABELS[resort.category] ?? resort.category}
        </span>

        {/* Featured badge */}
        {resort.isFeatured && resort.featuredBadge && (
          <span className="absolute top-3 right-3 flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-[#d4a853] text-white shadow-md">
            <Star className="w-3 h-3 fill-white" />
            {resort.featuredBadge}
          </span>
        )}
      </div>

      {/* Gallery (premium tier) */}
      {resort.galleryImages && resort.galleryImages.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Gallery</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {resort.galleryImages.slice(0, 8).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block group">
                <img
                  src={url}
                  alt={`${resort.name} photo ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border border-gray-100 group-hover:opacity-90 transition-opacity"
                  onError={undefined}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{resort.name}</h1>
          {resort.shortDescription && (
            <p className="text-gray-500 mt-1">{resort.shortDescription}</p>
          )}
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {resort.address ?? resort.country}
          </p>
        </div>

        {resort.priceFrom && (
          <div className="bg-[#f0faf8] border border-[#b2ddd6] rounded-xl px-4 py-3 text-center flex-shrink-0">
            <p className="text-xs text-gray-500">Starting from</p>
            <p className="text-xl font-bold text-[#1a6b5e]">৳{resort.priceFrom.toLocaleString()}</p>
            <p className="text-xs text-gray-400">per night</p>
          </div>
        )}
      </div>

      {/* Amenities (premium tier) */}
      {resort.amenitiesHighlights && resort.amenitiesHighlights.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {resort.amenitiesHighlights.map((item, i) => (
              <span key={i} className="inline-flex items-center text-xs font-medium bg-[#f0faf8] border border-[#b2ddd6] text-[#1a6b5e] px-3 py-1.5 rounded-full">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Home, label: 'Rooms',   value: `${resort.roomCount} rooms` },
          { icon: Globe, label: 'Country', value: resort.country },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <item.icon className="w-5 h-5 text-[#1a6b5e] mx-auto mb-1" />
            <p className="text-xs text-gray-400">{item.label}</p>
            <p className="text-sm font-semibold text-gray-700">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 space-y-3">
        <h2 className="font-semibold text-gray-700 mb-3">Contact</h2>

        {/* Booking phone */}
        {resort.bookingPhone && (
          <a href={`tel:${resort.bookingPhone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#1a6b5e]">
            <Phone className="w-4 h-4 text-[#1a6b5e]" /> {resort.bookingPhone}
            <span className="text-xs text-gray-400">(Booking)</span>
          </a>
        )}

        {resort.phone && resort.phone !== resort.bookingPhone && (
          <a href={`tel:${resort.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#1a6b5e]">
            <Phone className="w-4 h-4 text-[#1a6b5e]" /> {resort.phone}
          </a>
        )}

        {resort.email && (
          <a href={`mailto:${resort.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#1a6b5e]">
            <Mail className="w-4 h-4 text-[#1a6b5e]" /> {resort.email}
          </a>
        )}

        {resort.instagramHandle && (
          <a
            href={`https://instagram.com/${resort.instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-pink-600">
            <Instagram className="w-4 h-4 text-pink-500" />
            @{resort.instagramHandle}
          </a>
        )}

        {resort.website && (
          <a href={resort.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[#1a6b5e] hover:underline">
            <Globe className="w-4 h-4" /> Visit Website
          </a>
        )}
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-[#1a6b5e] hover:bg-[#145a4f] text-white font-semibold py-3 rounded-xl transition-colors">
            <ExternalLink className="w-4 h-4" />
            {bookingLabel}
          </a>
        )}

        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-[#25d366] hover:bg-[#1ebe5a] text-white font-semibold py-3 rounded-xl transition-colors">
            {/* WhatsApp icon */}
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp Inquiry
          </a>
        )}
      </div>

      {/* Affiliate source label */}
      {resort.affiliateUrl && resort.affiliateSource && (
        <p className="text-center text-xs text-gray-400 mt-3">
          Booking powered by {SOURCE_LABELS[resort.affiliateSource] ?? resort.affiliateSource}
        </p>
      )}

      {/* Schema.org JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type':    'LodgingBusiness',
            name:       resort.name,
            description: resort.shortDescription,
            url:         resort.website,
            telephone:   resort.phone ?? resort.bookingPhone,
            email:       resort.email,
            address: {
              '@type':         'PostalAddress',
              addressCountry:  resort.country,
              streetAddress:   resort.address,
            },
            ...(resort.latitude && resort.longitude ? {
              geo: {
                '@type':    'GeoCoordinates',
                latitude:   resort.latitude,
                longitude:  resort.longitude,
              },
            } : {}),
            ...(resort.priceFrom ? {
              priceRange: `৳${resort.priceFrom}+`,
            } : {}),
            ...(resort.coverImageUrl ? { image: resort.coverImageUrl } : {}),
          }),
        }}
      />
    </div>
  );
}
