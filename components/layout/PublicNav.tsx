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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('name, role, avatar_url').eq('id', user.id).single()
      if (data) setSessionUser({ name: data.name, role: data.role, avatar_url: data.avatar_url ?? null })
    })
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const activeHref = pathname.startsWith('/news') ? '/news' : pathname

  return (
    <>
      <style>{`
        .pub-nav-desktop { display: flex; }
        .pub-nav-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .pub-hamburger { display: none; }
        @media (max-width: 1100px) {
          .pub-nav-desktop { display: none; }
          .pub-nav-actions { display: none; }
          .pub-hamburger { display: flex; }
        }
      `}</style>

      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50, background: 'var(--card)',
          borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)',
        }}
      >
        <div
          style={{
            maxWidth: 1280, margin: '0 auto', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 20,
            minWidth: 0,
          }}
        >
          <Link href="/" style={{ textDecoration: 'none', flexShrink: 1, minWidth: 0 }}>
            <Logo size={48} lang={lang} />
          </Link>

          {/* Desktop nav */}
          <nav className="pub-nav-desktop" style={{ gap: 2, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
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

          {/* Desktop actions */}
          <div className="pub-nav-actions">
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

          {/* Mobile: lang + hamburger */}
          <div className="pub-hamburger" style={{ marginLeft: 'auto', alignItems: 'center', gap: 8 }}>
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
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 49,
            background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(2px)',
          }}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div
        style={{
          position: 'fixed', top: 77, left: 0, right: 0, zIndex: 50,
          background: 'var(--card)', borderBottom: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,.12)',
          transform: menuOpen ? 'translateY(0)' : 'translateY(-110%)',
          transition: 'transform .25s cubic-bezier(.4,0,.2,1)',
          display: 'none',
        }}
        className="pub-mobile-nav-panel"
      >
        <style>{`
          @media (max-width: 1100px) {
            .pub-mobile-nav-panel { display: block !important; }
          }
        `}</style>
        <nav style={{ padding: '8px 0' }}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : activeHref.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', padding: '14px 20px',
                  textDecoration: 'none', fontSize: 15, fontWeight: active ? 700 : 500,
                  color: active ? 'var(--primary)' : 'var(--ink)',
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                  transition: 'background .12s',
                }}
              >
                {lang === 'th' ? item.th : item.en}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '12px 20px 20px', borderTop: '1px solid var(--border)' }}>
          {sessionUser ? (
            <Link href="/staff/profile" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
              }}>
                {sessionUser.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sessionUser.avatar_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'var(--primary)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, flexShrink: 0,
                  }}>
                    {sessionUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{sessionUser.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{sessionUser.role.toUpperCase()}</div>
                </div>
                <Icon name="arrowRight" size={16} style={{ color: 'var(--muted)' }} />
              </div>
            </Link>
          ) : (
            <Link href="/login" style={{ display: 'block' }}>
              <button style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: 'var(--primary)', color: '#fff', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Icon name="lock" size={15} />
                {lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign in'}
              </button>
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
