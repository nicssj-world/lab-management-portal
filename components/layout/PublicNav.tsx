'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/lab/Logo'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { clearStaleAuthSession, createClient, recoverStaleAuthSession } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/',        th: 'หน้าแรก',              en: 'Home' },
  { href: '/catalog', th: 'รายการตรวจวิเคราะห์',   en: 'Test Catalog' },
  { href: '/manual',  th: 'คู่มือห้องปฏิบัติการ',  en: 'Lab Manual' },
  { href: '/news',    th: 'ข่าวสาร',               en: 'News' },
  { href: '/contact', th: 'โครงสร้างองค์กร',      en: 'Organization' },
]

interface SessionUser { name: string; role: string; avatar_url: string | null }

export function PublicNav() {
  const pathname = usePathname()
  const { lang, setLang } = useLang()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser()
      .then(async ({ data: { user }, error }) => {
        if (error) {
          if (!recoverStaleAuthSession(error)) clearStaleAuthSession()
          return
        }
        if (!user) return
        const { data } = await supabase.from('profiles').select('name, role, avatar_url').eq('id', user.id).single()
        if (data) setSessionUser({ name: data.name, role: data.role, avatar_url: data.avatar_url ?? null })
      })
      .catch((error) => {
        if (!recoverStaleAuthSession(error)) clearStaleAuthSession()
      })
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  useEffect(() => {
    const saved = localStorage.getItem('theme') === 'dark'
    setDark(saved)
    document.documentElement.setAttribute('data-theme', saved ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const activeHref = pathname.startsWith('/news') ? '/news' : pathname

  return (
    <>
      <style>{`
        .pub-header {
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 1px 0 rgba(255,255,255,.7), 0 10px 34px rgba(11,22,38,.055);
        }
        .pub-nav-desktop { display: flex; }
        .pub-nav-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .pub-hamburger { display: none; }
        .pub-nav-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 20px;
          min-width: 0;
        }
        .pub-logo-link {
          text-decoration: none;
          flex-shrink: 1;
          min-width: 0;
        }
        .pub-nav-link {
          position: relative;
          box-shadow: inset 0 0 0 1px transparent;
        }
        .pub-nav-link:hover {
          background: var(--primary-soft) !important;
          color: var(--primary) !important;
          box-shadow: inset 0 0 0 1px var(--public-hairline);
        }
        .pub-nav-link[data-active="true"]::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 5px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--primary), var(--public-accent));
        }
        .pub-icon-button {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.65), var(--public-shadow-sm);
          transition: border-color .15s ease, color .15s ease, background .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .pub-icon-button:hover {
          border-color: var(--public-hairline) !important;
          color: var(--primary) !important;
          transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.78), 0 10px 26px rgba(11,22,38,.085);
        }
        .pub-profile-chip {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.72), var(--public-shadow-sm);
          transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .pub-profile-chip:hover {
          border-color: var(--public-hairline) !important;
          transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 12px 30px rgba(11,22,38,.09);
        }
        [data-theme="dark"] .pub-header {
          box-shadow: 0 1px 0 rgba(255,255,255,.04), 0 12px 36px rgba(0,0,0,.28);
        }
        [data-theme="dark"] .pub-icon-button,
        [data-theme="dark"] .pub-profile-chip {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.06), var(--public-shadow-sm);
        }
        @media (max-width: 1100px) {
          .pub-header {
            position: relative;
            top: auto;
            z-index: 20;
          }
          .pub-nav-desktop { display: none; }
          .pub-nav-actions { display: none; }
          .pub-hamburger { display: flex; }
          .pub-nav-inner {
            padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px 12px;
            gap: 10px;
            min-height: 82px;
          }
          .pub-logo-link {
            max-width: calc(100% - 96px);
          }
          .pub-logo-link > div {
            align-items: center;
          }
          .pub-logo-link > div > div {
            white-space: normal !important;
            line-height: 1.25 !important;
            max-height: none !important;
          }
          .pub-mobile-nav-panel {
            top: 82px !important;
          }
        }
        @media (max-width: 420px) {
          .pub-nav-inner {
            padding: calc(env(safe-area-inset-top, 0px) + 12px) 12px 10px;
            min-height: 72px;
          }
          .pub-logo-link {
            max-width: calc(100% - 88px);
          }
          .pub-logo-link img {
            width: 48px !important;
            height: 48px !important;
          }
          .pub-mobile-nav-panel {
            top: 76px !important;
          }
        }
      `}</style>

      <header
        className="pub-header"
        style={{
          background: 'color-mix(in srgb, var(--card) 88%, transparent)',
          borderBottom: '1px solid var(--border)', backdropFilter: 'blur(18px) saturate(1.18)',
        }}
      >
        <div
          className="pub-nav-inner"
        >
          <Link href="/" className="pub-logo-link">
            <Logo size={64} lang={lang} />
          </Link>

          {/* Desktop nav */}
          <nav className="pub-nav-desktop" style={{ gap: 2, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
            {NAV_ITEMS.map((item) => {
              const active = item.href === '/' ? pathname === '/' : activeHref.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="pub-nav-link"
                  data-active={active ? 'true' : 'false'}
                  style={{
                    padding: '9px 13px 11px', borderRadius: 10, textDecoration: 'none',
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
              className="pub-icon-button"
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button
              onClick={toggleDark}
              title={dark ? 'Light mode' : 'Dark mode'}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="pub-icon-button"
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={dark ? 'sun' : 'moon'} size={15} />
            </button>
            {sessionUser ? (
              <Link href="/staff/profile" style={{ textDecoration: 'none' }}>
                <div className="pub-profile-chip" style={{
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
              className="pub-icon-button"
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <button
              onClick={toggleDark}
              title={dark ? 'Light mode' : 'Dark mode'}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="pub-icon-button"
              style={{
                width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name={dark ? 'sun' : 'moon'} size={15} />
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="pub-icon-button"
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
      {menuOpen && (
        <div
          style={{
            position: 'fixed', top: 77, left: 0, right: 0, zIndex: 50,
            background: 'var(--card)', borderBottom: '1px solid var(--border)',
            boxShadow: '0 8px 32px rgba(0,0,0,.12)',
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
      )}
    </>
  )
}
