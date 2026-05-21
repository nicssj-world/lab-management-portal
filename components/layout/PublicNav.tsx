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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('name, role, avatar_url').eq('id', user.id).single()
      if (data) setSessionUser({ name: data.name, role: data.role, avatar_url: data.avatar_url ?? null })
    })
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

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
          maxWidth: 1280, margin: '0 auto',
          padding: isMobile ? '10px 16px' : '14px 28px',
          display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20,
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <Logo size={isMobile ? 40 : 48} lang={lang} />
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
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
        )}

        {/* Desktop right side */}
        {!isMobile && (
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
        )}

        {/* Mobile right side */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
              style={{
                width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)',
                background: menuOpen ? 'var(--primary-soft)' : 'var(--card)',
                color: menuOpen ? 'var(--primary)' : 'var(--ink)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              <Icon name={menuOpen ? 'x' : 'menu'} size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div style={{
          background: 'var(--card)', borderTop: '1px solid var(--border)',
          padding: '8px 16px 16px',
        }}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : activeHref.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block', padding: '12px 14px', borderRadius: 10,
                  textDecoration: 'none', marginBottom: 2,
                  background: active ? 'var(--primary-soft)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--ink)',
                  fontWeight: active ? 600 : 500, fontSize: 15,
                  transition: 'all .15s',
                }}
              >
                {lang === 'th' ? item.th : item.en}
              </Link>
            )
          })}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 12 }}>
            {sessionUser ? (
              <Link href="/staff/profile" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)',
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
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{sessionUser.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{sessionUser.role.toUpperCase()}</div>
                  </div>
                  <Icon name="arrowRight" size={14} style={{ color: 'var(--muted)', marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              </Link>
            ) : (
              <Link href="/login" style={{ display: 'block' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', borderRadius: 10,
                  background: 'var(--primary)', color: '#fff',
                  fontWeight: 600, fontSize: 14, textDecoration: 'none',
                  cursor: 'pointer',
                }}>
                  <Icon name="lock" size={15} style={{ color: '#fff' }} />
                  {lang === 'th' ? 'เข้าสู่ระบบ' : 'Sign in'}
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
