import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/providers'
import './globals.css'
import '@fontsource/noto-sans-thai/300.css'
import '@fontsource/noto-sans-thai/400.css'
import '@fontsource/noto-sans-thai/500.css'
import '@fontsource/noto-sans-thai/600.css'
import '@fontsource/noto-sans-thai/700.css'

export const metadata: Metadata = {
  title: 'CBH - Lab Management',
  description: 'ระบบจัดการห้องปฏิบัติการ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
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
