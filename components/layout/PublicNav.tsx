'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/lab/Logo'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { createClient, recoverStaleAuthSession } from '@/lib/supabase/client'

interface PublicNavItem {
  href: string
  th: string
  en: string
  icon?: string
  children?: readonly PublicNavItem[]
}

const RELATED_DOCUMENT_ITEMS = [
  { href: '/related-documents', th: 'เอกสารคุณภาพและเอกสารประกอบ', en: 'Quality & Supporting Documents', icon: 'doc' },
  { href: '/sds', th: 'คลังเอกสาร SDS', en: 'SDS Document Library', icon: 'shieldCheck' },
] as const satisfies readonly PublicNavItem[]

const ORGANIZATION_ITEMS = [
  { href: '/contact', th: 'ผังโครงสร้างองค์กร', en: 'Organization Chart', icon: 'users' },
  { href: '/staff/personnel/team-org', th: 'ผังโครงสร้างกลุ่มงานฯ', en: 'Medical Technology Group Structure', icon: 'users' },
] as const satisfies readonly PublicNavItem[]

const NAV_ITEMS: readonly PublicNavItem[] = [
  { href: '/',        th: 'หน้าแรก',              en: 'Home' },
  { href: '/catalog', th: 'รายการตรวจวิเคราะห์',   en: 'Test Catalog' },
  { href: '/manual',  th: 'คู่มือห้องปฏิบัติการ',  en: 'Lab Manual' },
  {
    href: '/related-documents',
    th: 'เอกสารที่เกี่ยวข้อง',
    en: 'Related Documents',
    children: RELATED_DOCUMENT_ITEMS,
  },
  { href: '/news',    th: 'ข่าวสาร',               en: 'News' },
  {
    href: '/contact',
    th: 'โครงสร้างองค์กร',
    en: 'Organization',
    children: ORGANIZATION_ITEMS,
  },
]

interface SessionUser { name: string; role: string; avatar_url: string | null }

export function PublicNav() {
  const pathname = usePathname()
  const { lang, setLang } = useLang()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [relatedMenuOpen, setRelatedMenuOpen] = useState(false)
  const [organizationMenuOpen, setOrganizationMenuOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const relatedMenuRef = useRef<HTMLDivElement>(null)
  const organizationMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser()
      .then(async ({ data: { user }, error }) => {
        if (error) {
          // ไม่ได้ล็อกอินเป็นสถานะปกติของหน้า public — ล้าง session เฉพาะตอน token ตายจริง
          recoverStaleAuthSession(error)
          return
        }
        if (!user) return
        const { data } = await supabase.from('profiles').select('name, role, avatar_url').eq('id', user.id).single()
        if (data) setSessionUser({ name: data.name, role: data.role, avatar_url: data.avatar_url ?? null })
      })
      .catch((error) => {
        recoverStaleAuthSession(error)
      })
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setRelatedMenuOpen(false)
    setOrganizationMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!relatedMenuOpen && !organizationMenuOpen) return

    function closeOnDesktopOutsideClick(event: PointerEvent) {
      // On mobile the full-screen overlay owns dismissal of the menu. The
      // desktop dropdown needs its own outside-click behavior instead.
      if (window.matchMedia('(max-width: 1240px)').matches) return
      const activeMenuRef = organizationMenuOpen ? organizationMenuRef : relatedMenuRef
      if (!activeMenuRef.current?.contains(event.target as Node)) {
        setRelatedMenuOpen(false)
        setOrganizationMenuOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setRelatedMenuOpen(false)
        setOrganizationMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', closeOnDesktopOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnDesktopOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [organizationMenuOpen, relatedMenuOpen])

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
  const visibleNavItems = NAV_ITEMS

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
          max-width: 1440px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
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
        .pub-related-dropdown {
          position: relative;
          flex-shrink: 0;
        }
        .pub-related-menu {
          position: absolute;
          top: calc(100% + 9px);
          right: 0;
          z-index: 60;
          min-width: 286px;
          padding: 8px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--card);
          box-shadow: var(--public-shadow-md);
        }
        .pub-related-menu-item:hover,
        .pub-related-menu-item:focus-visible {
          background: var(--primary-soft) !important;
          color: var(--primary) !important;
          outline: none;
        }
        .pub-related-chevron {
          transition: transform .15s ease;
        }
        .pub-nav-link[data-open="true"] .pub-related-chevron,
        .pub-mobile-nav-panel button[aria-expanded="true"] .pub-related-chevron {
          transform: rotate(180deg);
        }
        .pub-mobile-related-option:hover,
        .pub-mobile-related-option:focus-visible {
          background: var(--primary-soft) !important;
          color: var(--primary) !important;
          outline: none;
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
        /* Six Thai nav labels + logo + actions stop fitting comfortably below this width. */
        @media (max-width: 1240px) {
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
          .pub-logo-link img { height: 48px !important; }
          .pub-logo-link img:first-child { width: 72px !important; }
          .pub-logo-link img:nth-child(2) { width: 48px !important; }
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
            {visibleNavItems.map((item) => {
              const active = item.children
                ? item.children.some((child) => activeHref.startsWith(child.href))
                : item.href === '/' ? pathname === '/' : activeHref.startsWith(item.href)

              if (item.children) {
                const organizationMenu = item.href === '/contact'
                const dropdownOpen = organizationMenu ? organizationMenuOpen : relatedMenuOpen
                const dropdownMenuId = organizationMenu ? 'public-organization-menu' : 'public-related-documents-menu'
                return (
                  <div
                    key={item.href}
                    className="pub-related-dropdown"
                    ref={organizationMenu ? organizationMenuRef : relatedMenuRef}
                  >
                    <button
                      type="button"
                      className="pub-nav-link"
                      data-active={active ? 'true' : 'false'}
                      data-open={dropdownOpen ? 'true' : 'false'}
                      aria-haspopup="menu"
                      aria-expanded={dropdownOpen}
                      aria-controls={dropdownMenuId}
                      onClick={() => {
                        if (organizationMenu) {
                          setOrganizationMenuOpen((open) => !open)
                          setRelatedMenuOpen(false)
                        } else {
                          setRelatedMenuOpen((open) => !open)
                          setOrganizationMenuOpen(false)
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '9px 11px 11px', borderRadius: 10,
                        border: 0, textDecoration: 'none',
                        background: active || dropdownOpen ? 'var(--primary-soft)' : 'transparent',
                        color: active || dropdownOpen ? 'var(--primary)' : 'var(--ink)',
                        fontWeight: active ? 600 : 500, fontSize: 13,
                        whiteSpace: 'nowrap', transition: 'all .15s',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <span>{lang === 'th' ? item.th : item.en}</span>
                      <Icon name="chevDown" size={13} className="pub-related-chevron" />
                    </button>

                    {dropdownOpen && (
                      <div id={dropdownMenuId} className="pub-related-menu" role="menu">
                        {item.children.map((child) => {
                          const childActive = activeHref.startsWith(child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              role="menuitem"
                              aria-current={childActive ? 'page' : undefined}
                              className="pub-related-menu-item"
                              onClick={() => {
                                setRelatedMenuOpen(false)
                                setOrganizationMenuOpen(false)
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '11px 12px', borderRadius: 10,
                                textDecoration: 'none',
                                color: childActive ? 'var(--primary)' : 'var(--ink)',
                                background: childActive ? 'var(--primary-soft)' : 'transparent',
                                fontWeight: childActive ? 700 : 550, fontSize: 13,
                                transition: 'background .12s, color .12s',
                              }}
                            >
                              <Icon name={child.icon ?? 'doc'} size={17} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{lang === 'th' ? child.th : child.en}</span>
                              <Icon name="chevRight" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="pub-nav-link"
                  data-active={active ? 'true' : 'false'}
                  onClick={() => {
                    setRelatedMenuOpen(false)
                    setOrganizationMenuOpen(false)
                  }}
                  style={{
                    padding: '9px 11px 11px', borderRadius: 10, textDecoration: 'none',
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
                  <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                    {/* Names are user-supplied and unbounded — cap the chip so a long one
                        cannot push the nav into the logo. */}
                    <div
                      title={sessionUser.name}
                      style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap',
                        maxWidth: 132, overflow: 'hidden', textOverflow: 'ellipsis',
                      }}
                    >
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
              // Staff-only action on a page built for patients and external units —
              // it stays in the expected top-right slot but must not outrank the
              // public-facing nav links visually.
              <Link href="/login">
                <Button variant="secondary" size="md" icon="lock">
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
              onClick={() => {
                setMenuOpen((open) => !open)
                setRelatedMenuOpen(false)
                setOrganizationMenuOpen(false)
              }}
              aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              aria-expanded={menuOpen}
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
          onClick={() => {
            setMenuOpen(false)
            setRelatedMenuOpen(false)
            setOrganizationMenuOpen(false)
          }}
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
            @media (max-width: 1240px) {
              .pub-mobile-nav-panel { display: block !important; }
            }
          `}</style>
          <nav style={{ padding: '8px 0' }}>
            {visibleNavItems.map((item) => {
              const active = item.children
                ? item.children.some((child) => activeHref.startsWith(child.href))
                : item.href === '/' ? pathname === '/' : activeHref.startsWith(item.href)

              if (item.children) {
                const organizationMenu = item.href === '/contact'
                const dropdownOpen = organizationMenu ? organizationMenuOpen : relatedMenuOpen
                const dropdownMenuId = organizationMenu
                  ? 'public-organization-mobile-menu'
                  : 'public-related-documents-mobile-menu'
                return (
                  <div key={item.href}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={dropdownOpen}
                      aria-controls={dropdownMenuId}
                      onClick={() => {
                        if (organizationMenu) {
                          setOrganizationMenuOpen((open) => !open)
                          setRelatedMenuOpen(false)
                        } else {
                          setRelatedMenuOpen((open) => !open)
                          setOrganizationMenuOpen(false)
                        }
                      }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 20px', textAlign: 'left',
                        fontFamily: 'inherit', fontSize: 15, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--primary)' : 'var(--ink)',
                        background: active || dropdownOpen ? 'var(--primary-soft)' : 'transparent',
                        border: 0, borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
                        cursor: 'pointer', transition: 'background .12s',
                      }}
                    >
                      <span>{lang === 'th' ? item.th : item.en}</span>
                      <Icon name="chevDown" size={16} className="pub-related-chevron" />
                    </button>

                    {dropdownOpen && (
                      <div id={dropdownMenuId} role="menu" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                        {item.children.map((child) => {
                          const childActive = activeHref.startsWith(child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              role="menuitem"
                              aria-current={childActive ? 'page' : undefined}
                              className="pub-mobile-related-option"
                              onClick={() => {
                                setMenuOpen(false)
                                setRelatedMenuOpen(false)
                                setOrganizationMenuOpen(false)
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 20px 12px 44px',
                                textDecoration: 'none', fontSize: 14,
                                fontWeight: childActive ? 700 : 500,
                                color: childActive ? 'var(--primary)' : 'var(--ink)',
                                background: childActive ? 'var(--primary-soft)' : 'transparent',
                                borderLeft: childActive ? '3px solid var(--primary)' : '3px solid transparent',
                                transition: 'background .12s, color .12s',
                              }}
                            >
                              <Icon name={child.icon ?? 'doc'} size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              <span>{lang === 'th' ? child.th : child.en}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setMenuOpen(false)
                    setRelatedMenuOpen(false)
                    setOrganizationMenuOpen(false)
                  }}
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
                  background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--border)',
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
