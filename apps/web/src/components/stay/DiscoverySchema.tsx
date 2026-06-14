'use client';

/**
 * DiscoverySchema
 * Injects Schema.org structured data for the discovery map page.
 * - ItemList of visible resorts (for Google's rich results)
 * - BreadcrumbList
 */

interface Resort {
  slug:             string;
  name:             string;
  country:          string;
  category:         string;
  shortDescription: string;
  coverImageUrl:    string | null;
  priceFrom:        number | null;
  latitude:         number | null;
  longitude:        number | null;
  website:          string | null;
}

interface Props {
  resorts: Resort[];
}

export default function DiscoverySchema({ resorts }: Props) {
  if (resorts.length === 0) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    name:       'Resorts in South Asia',
    description:'Eco, agro, beach and hill resorts across South Asia available on stay.resortpro.site',
    url:        'https://stay.resortpro.site/discover',
    numberOfItems: resorts.length,
    itemListElement: resorts.map((r, i) => ({
      '@type':    'ListItem',
      position:   i + 1,
      item: {
        '@type':     'LodgingBusiness',
        name:        r.name,
        description: r.shortDescription,
        url:         `https://stay.resortpro.site/resort/${r.slug}`,
        image:       r.coverImageUrl,
        address: {
          '@type':        'PostalAddress',
          addressCountry: r.country,
        },
        ...(r.latitude && r.longitude ? {
          geo: {
            '@type':    'GeoCoordinates',
            latitude:   r.latitude,
            longitude:  r.longitude,
          },
        } : {}),
        ...(r.priceFrom ? {
          priceRange: `from ${r.priceFrom.toLocaleString()}`,
        } : {}),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
