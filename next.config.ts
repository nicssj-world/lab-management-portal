import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['canvas'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    proxyClientMaxBodySize: '20mb',
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
