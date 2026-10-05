const path = require('path');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output: self-contained server.js for Docker
  output: 'standalone',

  // `X-Powered-By: Next.js` told anyone asking what to look up exploits for,
  // and bought nothing in return.
  poweredByHeader: false,

  /**
   * Security headers for the web app.
   *
   * The API has had Helmet for a long time; the pages people actually open had
   * nothing (RC-M07). Each of these was checked against what the app really
   * does rather than copied from a list:
   *
   *  - SAMEORIGIN, not DENY: the website editor previews a resort's own public
   *    page in an iframe (ThemePicker), and that is same-origin. DENY would
   *    have broken the preview. The embed widget is a script, not a frame, so
   *    it is unaffected either way.
   *  - camera=(self): the ID and passport scanners call getUserMedia in three
   *    components. `camera=()` — the value most of these lists suggest — would
   *    have turned off document scanning.
   *  - microphone and geolocation are closed because nothing calls them.
   *
   * The CSP is Report-Only, deliberately. This app renders uploaded theme HTML
   * and inline styles throughout, so an enforcing policy would break pages in
   * ways nobody could predict from reading it. Report-Only puts the violations
   * in the console first; tightening it and switching it on is the next step,
   * with evidence instead of guesses.
   */
  async headers() {
    // The API the browser actually calls. Named rather than covered by a
    // blanket `https:` — the first Report-Only run flagged every call to it,
    // because in development it is http://localhost:4000 and a wildcard for
    // "any https host" would have hidden that while allowing everything else.
    const apiOrigin = (() => {
      try {
        return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').origin;
      } catch {
        return 'http://localhost:4000';
      }
    })();
    const apiSocket = apiOrigin.replace(/^http/, 'ws');

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Clarity is the only third-party script on the page.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.clarity.ms",
      `connect-src 'self' ${apiOrigin} ${apiSocket} https://www.clarity.ms https://*.clarity.ms`,
    ].join('; ');

    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(), geolocation=(), payment=(self)',
      },
      { key: 'Content-Security-Policy-Report-Only', value: csp },
    ];

    // Only over HTTPS. Sending it in development would teach the browser to
    // refuse plain http://localhost for a year.
    if (process.env.NODE_ENV === 'production') {
      headers.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }

    return [{ source: '/:path*', headers }];
  },

  experimental: {
    // Required for standalone in a pnpm monorepo — traces from repo root
    outputFileTracingRoot: path.join(__dirname, '../../'),

    // Handlebars (template-renderer/compile.ts) only ever runs server-side
    // (inside Server Components — see that file's own docstring), but
    // webpack still tries to statically bundle+analyze it there, and warns
    // on an internal `require.extensions` branch it can't resolve (a
    // well-known handlebars+webpack incompatibility — that branch is dead
    // code for how we call it, just unreachable at runtime here). Marking
    // it external tells Next to leave it as a real `require()` resolved by
    // Node at runtime instead of bundling it, which is the officially
    // supported fix for exactly this class of server-only-package warning.
    serverComponentsExternalPackages: ['handlebars'],

    // sharp's JavaScript is traced into the standalone output on its own; the
    // native binary it loads at runtime is not. `@img/sharp-*` are optional
    // platform dependencies, and tracing follows imports rather than optional
    // peers — so the build looks fine, the image ships, and the first request
    // for an optimized image fails with "Could not load the sharp module".
    // Found by looking in .next/standalone/node_modules after a build: sharp
    // was there, @img was not.
    outputFileTracingIncludes: {
      '/**': ['../../node_modules/.pnpm/@img+sharp-*/**'],
    },
  },

  // Type-checking is a real CI gate now that tsc --noEmit is actually clean
  // (see the 7-error web TS-baseline fix). Flip back to true only alongside
  // a note explaining what's temporarily broken and why — never silently.
  typescript: {
    ignoreBuildErrors: false,
  },

  // Don't fail production builds on ESLint warnings
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      // Local dev — API serves uploaded files from /uploads/
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
    ],
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
};

module.exports = withNextIntl(nextConfig);
