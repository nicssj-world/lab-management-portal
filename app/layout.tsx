import type { Metadata } from 'next'
import { IBM_Plex_Sans_Thai, IBM_Plex_Sans, Sarabun, Noto_Sans_Thai } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai'],
  display: 'swap',
  variable: '--font-ibm-thai',
})

const ibmPlexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibm',
})

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-sarabun',
})

const notoSansThai = Noto_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai'],
  display: 'swap',
  variable: '--font-noto-thai',
})

export const metadata: Metadata = {
  title: 'MN-LAB-01 — Lab Management Portal · กลุ่มงานเทคนิคการแพทย์ รพ.ชลบุรี',
  description: 'ระบบจัดการห้องปฏิบัติการ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      className={`${ibmPlexSansThai.variable} ${ibmPlexSans.variable} ${sarabun.variable} ${notoSansThai.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
