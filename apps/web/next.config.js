const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output: self-contained server.js for Docker
  output: 'standalone',

  // Required for standalone in a pnpm monorepo — traces from repo root
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
};

module.exports = nextConfig;
