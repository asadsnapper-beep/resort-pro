const path = require('path');
const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output: self-contained server.js for Docker
  output: 'standalone',

  // Required for standalone in a pnpm monorepo — traces from repo root
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },

  // Don't fail production builds on type errors (fix separately in dev)
  typescript: {
    ignoreBuildErrors: true,
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
