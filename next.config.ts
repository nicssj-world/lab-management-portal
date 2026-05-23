import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['canvas'],
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
