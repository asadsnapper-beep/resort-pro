import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:     '/',
        disallow:  [],
      },
    ],
    sitemap:  'https://stay.resortpro.site/sitemap.xml',
    host:     'https://stay.resortpro.site',
  };
}
