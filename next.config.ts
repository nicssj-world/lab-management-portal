import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Public safety-manual PDF is embedded same-origin in the /sds in-page viewer,
        // so it needs a relaxed (same-origin-only) framing policy — everything else stays locked down.
        source: '/((?!api/public/safety-manual).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
      {
        source: '/api/public/safety-manual/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ]
  },
  serverExternalPackages: ['canvas', '@napi-rs/canvas', 'sharp'],
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
    proxyClientMaxBodySize: '50mb',
  },
  devIndicators: {
    position: 'bottom-right',
  },
  images: {
    qualities: [75, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default nextConfig
