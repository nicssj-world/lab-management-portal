import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['canvas'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  devIndicators: {
    position: 'bottom-right',
  },
  images: {
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
