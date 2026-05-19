'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/lab/Logo'
import { Button } from '@/components/ui/Button'
import { useLang } from '@/context/LangContext'

const NAV_ITEMS = [
  { href: '/',        th: 'หน้าแรก',              en: 'Home' },
  { href: '/catalog', th: 'รายการตรวจวิเคราะห์',   en: 'Test Catalog' },
  { href: '/manual',  th: 'คู่มือห้องปฏิบัติการ',  en: 'Lab Manual' },
  { href: '/news',    th: 'ข่าวสาร',               en: 'News' },
  { href: '/contact', th: 'ติดต่อ',                en: 'Contact' },
]

export function PublicNav() {
  const pathname = usePathname()
  const { lang, setLang } = useLang()

  const activeHref = pathname.startsWith('/news') ? '/news' : pathname

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50, background: 'var(--card)',
        borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          maxWidth: 1280, margin: '0 auto', padding: '14px 28px',
          display: 'flex', alignItems: 'center', gap: 20,
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <Logo size={48} lang={lang} />
        </Link>

        <nav style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : activeHref.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: '8px 12px', borderRadius: 8, textDecoration: 'none',
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--ink)',
                  fontWeight: active ? 600 : 500, fontSize: 13,
                  whiteSpace: 'nowrap', transition: 'all .15s',
                }}
              >
                {lang === 'th' ? item.th : item.en}
              </Link>
            )
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            style={{
              width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            {lang === 'th' ? 'EN' : 'TH'}
          </button>
          <Link href="/login">
            <Button variant="primary" size="md" icon="lock">
              {lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign in'}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
