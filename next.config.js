/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily disable React Strict Mode to avoid double-mounting in dev
  // Re-enable this for production builds to catch potential issues
  reactStrictMode: process.env.NODE_ENV === 'production',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/rooftopkc',
        has: [
          {
            type: 'host',
            value: 'therooftopkc.com',
          },
        ],
      },
      {
        source: '/',
        destination: '/rooftopkc',
        has: [
          {
            type: 'host',
            value: 'www.therooftopkc.com',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig 