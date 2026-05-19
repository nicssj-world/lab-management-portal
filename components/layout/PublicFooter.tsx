'use client'

import Link from 'next/link'
import { Logo } from '@/components/lab/Logo'
import { useLang } from '@/context/LangContext'

const FOOTER_COLS = [
  {
    th: 'บริการ', en: 'Services',
    links: [
      { th: 'คู่มือห้องปฏิบัติการ', en: 'Lab Manual', href: '/manual' },
      { th: 'รายการตรวจวิเคราะห์',  en: 'Test Catalog', href: '/catalog' },
      { th: 'ข่าวสาร',               en: 'News', href: '/news' },
    ],
  },
  {
    th: 'เกี่ยวกับเรา', en: 'About',
    links: [
      { th: 'เกี่ยวกับเรา',   en: 'About Us', href: '/contact' },
      { th: 'นโยบายคุณภาพ', en: 'Quality Policy', href: '/manual' },
      { th: 'ข่าวสาร',        en: 'News', href: '/news' },
    ],
  },
  {
    th: 'ติดต่อ', en: 'Contact',
    links: [
      { th: 'โทร 038-931-000',        en: 'Tel. 038-931-000', href: '/contact' },
      { th: 'อีเมล lab@cbh.go.th',    en: 'lab@cbh.go.th', href: '/contact' },
      { th: 'เวลาทำการ 07:00–20:00',  en: 'Hours 07:00–20:00', href: '/contact' },
    ],
  },
]

export function PublicFooter() {
  const { lang } = useLang()
  return (
    <footer
      style={{
        background: 'var(--surface-2)', borderTop: '1px solid var(--border)',
        padding: '32px 28px', marginTop: 60,
      }}
    >
      <div
        style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 32,
        }}
      >
        <div>
          <Logo size={56} lang={lang} />
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.7 }}>
            {lang === 'th'
              ? 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ให้บริการตรวจวิเคราะห์ทางห้องปฏิบัติการที่ได้มาตรฐาน ISO 15189 และ ISO 15190'
              : 'Medical Technology Department, Chonburi Hospital. Accredited laboratory services certified under ISO 15189 and ISO 15190 standards.'}
          </p>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.en}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
              {lang === 'th' ? col.th : col.en}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {col.links.map((link) => (
                <li key={link.en}>
                  <Link
                    href={link.href}
                    style={{ fontSize: 12.5, color: 'var(--muted)', textDecoration: 'none' }}
                  >
                    {lang === 'th' ? link.th : link.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1280, margin: '24px auto 0', padding: '16px 0 0',
          borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--muted)',
          display: 'flex', justifyContent: 'space-between',
        }}
      >
        <span>© 2026 Chonburi Hospital — Medical Technology Department.</span>
        <span>v1.0.0 · MN-LAB-01</span>
      </div>
    </footer>
  )
}
