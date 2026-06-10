import { NextRequest, NextResponse } from 'next/server';

/* ── Platform / infrastructure domains — skip all tenant logic ─────────────
   These are our own app domains; never treat them as custom/subdomain tenants.
─────────────────────────────────────────────────────────────────────────── */
const PLATFORM_DOMAINS = new Set([
  'localhost',
  'resortpro.site',       // bare apex — landing page / marketing
  'www.resortpro.site',
  'app.resortpro.site',   // dashboard app
  'api.resortpro.site',   // API
  'resortpro.app',
  'www.resortpro.app',
]);

/* ── ResortPro subdomain root ───────────────────────────────────────────────
   <slug>.resortpro.site  →  rewrite to /<slug>
─────────────────────────────────────────────────────────────────────────── */
const SUBDOMAIN_BASE = 'resortpro.site';

/* ── Cache: customDomain → slug ─────────────────────────────────────────────
   In-process Map (resets on cold start).
   Production upgrade path: replace with Redis / Cloudflare KV.
─────────────────────────────────────────────────────────────────────────── */
const domainCache = new Map<string, { slug: string; ts: number }>();
const CACHE_TTL   = 5 * 60 * 1000; // 5 minutes

async function resolveSlugForCustomDomain(domain: string): Promise<string | null> {
  const cached = domainCache.get(domain);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.slug;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res    = await fetch(`${apiUrl}/site/domain/${domain}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const slug: string | null = json?.data?.slug ?? null;
    if (slug) domainCache.set(domain, { slug, ts: Date.now() });
    return slug;
  } catch {
    return null;
  }
}

/* ── Paths that always pass through unchanged ───────────────────────────── */
const SKIP_PREFIXES = ['/_next', '/api', '/auth', '/dashboard', '/admin'];

function isInternalPath(pathname: string): boolean {
  if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) return true;
  if (pathname.includes('.')) return true; // static files (.ico, .png, .js…)
  return false;
}

/* ── Auto-detect locale from Cloudflare header or cookie ───────────────────
   Priority: cookie (user choice) > CF-IPCountry (auto) > default 'en'
─────────────────────────────────────────────────────────────────────────── */
function detectLocale(request: NextRequest): string | null {
  // 1. User manually set locale cookie — respect it
  const cookieLocale = request.cookies.get('locale')?.value;
  if (cookieLocale === 'en' || cookieLocale === 'bn') return null; // already set, no override

  // 2. No cookie yet → check Cloudflare country header
  const country = request.headers.get('CF-IPCountry') ?? request.headers.get('cf-ipcountry');
  if (country === 'BD') return 'bn';

  return null; // default 'en'
}

/* ═══════════════════════════════════════════════════════════════════════════
   Middleware
═══════════════════════════════════════════════════════════════════════════ */
export async function middleware(request: NextRequest) {
  const host     = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0]; // strip :port for local dev
  const pathname = request.nextUrl.pathname;

  // 0. Auto-detect locale for Bangladesh visitors (only if no cookie set)
  const autoLocale = detectLocale(request);
  if (autoLocale) {
    const response = NextResponse.next();
    response.cookies.set('locale', autoLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }

  // 1. Always skip Next.js internals and static files
  if (isInternalPath(pathname)) return NextResponse.next();

  // 2. Skip exact platform / Vercel domains
  if (PLATFORM_DOMAINS.has(hostname)) return NextResponse.next();
  if (hostname.endsWith('.vercel.app')) return NextResponse.next();

  // 3. *.resortpro.site  →  extract subdomain → rewrite to /<slug>
  if (hostname.endsWith(`.${SUBDOMAIN_BASE}`)) {
    const subdomain = hostname.slice(0, hostname.length - SUBDOMAIN_BASE.length - 1);

    // Skip empty or multi-level subdomains (e.g. a.b.resortpro.site)
    if (!subdomain || subdomain.includes('.')) return NextResponse.next();

    const url    = request.nextUrl.clone();
    url.pathname = `/${subdomain}`;
    return NextResponse.rewrite(url);
  }

  // 4. Custom domain (e.g. sunsetresort.com) → look up slug via API
  const slug = await resolveSlugForCustomDomain(hostname);
  if (!slug) return NextResponse.next();

  const url    = request.nextUrl.clone();
  url.pathname = `/${slug}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Match every path except Next.js static files and optimised images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
