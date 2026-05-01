import { NextRequest, NextResponse } from 'next/server';

// Domains that are OUR own platform — skip custom domain logic
const PLATFORM_DOMAINS = [
  'localhost',
  'resortpro.app',
  'www.resortpro.app',
  'vercel.app',     // preview deploys
];

// Cache: customDomain → slug (in-process, resets on cold start)
// In production you'd use Redis or an edge KV store (Vercel KV, Cloudflare KV)
const domainCache = new Map<string, { slug: string; ts: number }>();
const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes

async function resolveSlugForDomain(domain: string): Promise<string | null> {
  // Check in-process cache first
  const cached = domainCache.get(domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.slug;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${apiUrl}/site/domain/${domain}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const slug: string | null = json?.data?.slug ?? null;
    if (slug) domainCache.set(domain, { slug, ts: Date.now() });
    return slug;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const host     = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0]; // strip port

  // Skip platform domains — normal routing
  if (PLATFORM_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
    return NextResponse.next();
  }

  // Skip internal paths
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')   ||
    pathname.startsWith('/auth')  ||
    pathname.startsWith('/dashboard') ||
    pathname.includes('.')          // static files (.ico, .png…)
  ) {
    return NextResponse.next();
  }

  // Try to resolve this hostname to a tenant slug
  const slug = await resolveSlugForDomain(hostname);
  if (!slug) return NextResponse.next(); // unknown domain — pass through

  // Rewrite / → /slug, /anything → /slug (the public one-page site)
  const url   = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
