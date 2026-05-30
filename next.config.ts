import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['canvas'],
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
