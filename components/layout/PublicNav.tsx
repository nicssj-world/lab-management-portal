'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/lab/Logo'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/',        th: 'หน้าแรก',              en: 'Home' },
  { href: '/catalog', th: 'รายการตรวจวิเคราะห์',   en: 'Test Catalog' },
  { href: '/manual',  th: 'คู่มือห้องปฏิบัติการ',  en: 'Lab Manual' },
  { href: '/news',    th: 'ข่าวสาร',               en: 'News' },
  { href: '/contact', th: 'ติดต่อ',                en: 'Contact' },
]

interface SessionUser { name: string; role: string; avatar_url: string | null }

export function PublicNav() {
  const pathname = usePathname()
  const { lang, setLang } = useLang()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('name, role, avatar_url').eq('id', user.id).single()
      if (data) setSessionUser({ name: data.name, role: data.role, avatar_url: data.avatar_url ?? null })
    })
  }, [])

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
          {sessionUser ? (
            <Link href="/staff/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px 6px 6px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--card)',
                cursor: 'pointer', transition: 'background .15s',
              }}>
                {sessionUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sessionUser.avatar_url} alt="avatar" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {sessionUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {sessionUser.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.04em' }}>
                    {sessionUser.role.toUpperCase()}
                  </div>
                </div>
                <Icon name="arrowRight" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              </div>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="primary" size="md" icon="lock">
                {lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign in'}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
