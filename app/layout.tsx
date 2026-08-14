import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://lab-management-cbh.vercel.app').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'CBH - Lab Management',
  description: 'ระบบจัดการห้องปฏิบัติการ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  openGraph: {
    title: 'CBH - Lab Management',
    description: 'ระบบจัดการห้องปฏิบัติการ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
    type: 'website',
    images: [
      {
        url: '/images/cbh-lab-logo-v3.png',
        width: 1254,
        height: 1254,
        alt: 'CBH Lab',
      },
    ],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
