'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { useSettings } from '@/context/SettingsContext'
import { useSidebar } from '@/context/SidebarContext'
import { createClient } from '@/lib/supabase/client'

interface NavChild {
  href: string
  th: string
  en: string
  icon: string
  color: string
  role?: string | string[]
  docRole?: string | string[]
  resource?: string
}

interface NavItem {
  href: string
  th: string
  en: string
  icon: string
  color: string
  badge?: string
  role?: string | string[]
  resource?: string
  requireEdit?: boolean
  children?: NavChild[]
}

type NavEntry = NavItem | { section: string }

const isNavItem = (entry: NavEntry): entry is NavItem => 'href' in entry

const NAV_ITEMS: NavEntry[] = [
  { href: '/staff/dashboard',  th: 'แดชบอร์ด',           en: 'Dashboard',      icon: 'dash',  color: '#1E5FAD' },
  { section: 'งานหลัก' },
  { href: '/staff/tests',      th: 'รายการตรวจ',         en: 'Tests',          icon: 'flask',  color: '#1E5FAD', resource: 'รายการตรวจ' },
  { href: '/staff/documents/dashboard', th: 'เอกสารคุณภาพ', en: 'Documents', icon: 'doc', color: '#0D9488',
    children: [
      { href: '/staff/documents/dashboard',   th: 'Dashboard',   en: 'Dashboard',   icon: 'dash',  color: '#0D9488', resource: 'เอกสารคุณภาพ' },
      { href: '/staff/documents',             th: 'คลังเอกสาร',  en: 'Library',     icon: 'doc',   color: '#0D9488', resource: 'เอกสารคุณภาพ' },
      { href: '/staff/documents/categories',  th: 'หมวดหมู่',    en: 'Categories',  icon: 'inbox', color: '#0D9488', resource: 'เอกสารคุณภาพ' },
      { href: '/staff/documents/pending',     th: 'รออนุมัติ',   en: 'Pending',     icon: 'clock', color: '#0D9488',
        role: ['Admin', 'Document Controller'], docRole: ['Document Controller', 'Reviewer'] },
      { href: '/staff/documents/read-report', th: 'รายงานการอ่าน', en: 'Read Report', icon: 'eye', color: '#0D9488',
        role: ['Admin', 'Document Controller'], docRole: ['Document Controller', 'Quality Manager', 'Laboratory Director'] },
      { href: '/staff/documents/master-list', th: 'Master List', en: 'Master List', icon: 'book', color: '#0D9488', resource: 'Master List' },
    ] },
  { href: '/staff/news',       th: 'จัดการข่าวสาร',        en: 'News',           icon: 'bell',       color: '#D97706', resource: 'ข่าวสาร' },
  { href: '/staff/risk',       th: 'ทะเบียนความเสี่ยง',   en: 'Risk Register',  icon: 'shield',     color: '#DC2626', resource: 'ความเสี่ยง / Rejection' },
  { href: '/staff/contracts',  th: 'บริหารสัญญา',         en: 'Contracts',      icon: 'building',   color: '#7C3AED', resource: 'สัญญา' },
  { href: '/staff/equipment',  th: 'ทะเบียนเครื่องมือ',   en: 'Equipment',      icon: 'microscope', color: '#EA580C', resource: 'ทะเบียนเครื่องมือ' },
  { href: '/staff/personnel',  th: 'บุคลากร',             en: 'MT-CBH Staff',   icon: 'shieldCheck', color: '#4338CA', resource: 'บุคลากร' },
  { href: '/staff/quality-tasks', th: 'งานคุณภาพ', en: 'Quality Tasks', icon: 'calendar', color: '#0891B2', resource: 'งานคุณภาพ',
    children: [
      { href: '/staff/quality-tasks', th: 'ปฏิทินและงาน', en: 'Dashboard', icon: 'calendar', color: '#0891B2', resource: 'งานคุณภาพ' },
      { href: '/staff/quality-tasks/registry', th: 'ทะเบียนกิจกรรม', en: 'Registry', icon: 'inbox', color: '#0891B2', resource: 'งานคุณภาพ' },
    ] },
  { section: 'Analytics' },
  { href: '/kpi/dashboard',    th: 'KPI Dashboard',       en: 'KPI Dashboard',  icon: 'chart',  color: '#16A34A', resource: 'KPI' },
  { href: '/lab-workload/dashboard', th: 'Lab Workload', en: 'Lab Workload',   icon: 'beaker', color: '#0EA5E9', resource: 'Workload' },
  { href: '/tat',              th: 'Turnaround Time',     en: 'TAT',            icon: 'clock',  color: '#8B5CF6', resource: 'TAT' },
  { href: '/staff/rejection',  th: 'Rejection Log',       en: 'Rejection',      icon: 'alert',  color: '#DC2626', resource: 'ความเสี่ยง / Rejection' },
  { section: 'ระบบ' },
  { href: '/staff/admin',      th: 'จัดการผู้ใช้',         en: 'Users & Roles',  icon: 'users',    color: '#475569', resource: 'User Management' },
  { href: '/staff/settings',   th: 'ตั้งค่าระบบ',          en: 'Settings',       icon: 'settings', color: '#475569', role: 'Admin' },
  { href: '/staff/activity',   th: 'กิจกรรมทั้งหมด',       en: 'Activity Log',   icon: 'inbox',    color: '#475569', resource: 'Activity Log' },
  { href: '/staff/changelog',  th: 'บันทึกการแก้ไขระบบ',   en: 'Change Log',     icon: 'edit',     color: '#475569', resource: 'บันทึกการแก้ไข' },
  { href: '/staff/tests/categories', th: 'หมวดหมู่การตรวจ', en: 'Categories', icon: 'beaker', color: '#475569', resource: 'รายการตรวจ', role: 'Admin' },
]

const DOC_ROLE_COLOR: Record<string, string> = {
  'Laboratory Director': '#1E5FAD',
  'Quality Manager':     '#0D9488',
  'Document Controller': '#7C3AED',
  'Reviewer':            '#B45309',
  'Viewer':              '#64748B',
}

interface StaffSidebarProps {
  userRole?: string
  userName?: string
  userAvatar?: string
  userDocRole?: string
  userPermissions?: Record<string, string>
}

export function StaffSidebar({ userRole, userName, userAvatar, userDocRole, userPermissions }: StaffSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { lang } = useLang()
  const { settings } = useSettings()
  const { collapsed, mobileOpen, closeMobile } = useSidebar()
  const [testCount, setTestCount] = useState<number | null>(null)
  const [docCount, setDocCount]   = useState<number | null>(null)
  // Lets a user collapse a submenu they're currently inside by clicking its parent again.
  // Cleared whenever they navigate away from that group, so it opens fresh next time.
  const [collapsedGroup, setCollapsedGroup] = useState<string | null>(null)
  const w = collapsed ? 64 : 248

  useEffect(() => {
    fetch('/api/admin/tests?pageSize=1&active=true')
      .then(r => r.json())
      .then(j => { if (typeof j.count === 'number') setTestCount(j.count) })
      .catch(() => {})
    fetch('/api/admin/documents?pageSize=1')
      .then(r => r.json())
      .then(j => { if (typeof j.count === 'number') setDocCount(j.count) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (collapsedGroup && !pathname.startsWith(collapsedGroup)) setCollapsedGroup(null)
  }, [pathname, collapsedGroup])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = userName?.charAt(0) ?? 'U'

  // A child is visible when its resource permission allows it, OR (for role/docRole
  // gated items) when either the user's role or doc_role matches.
  const childVisible = (child: NavChild) => {
    if (child.role || child.docRole) {
      const roles = child.role ? (Array.isArray(child.role) ? child.role : [child.role]) : []
      const docRoles = child.docRole ? (Array.isArray(child.docRole) ? child.docRole : [child.docRole]) : []
      if (roles.includes(userRole ?? '') || docRoles.includes(userDocRole ?? '')) return true
      if (!child.resource) return false
    }
    if (child.resource) {
      return (userPermissions?.[child.resource] ?? 'none') !== 'none'
    }
    return true
  }

  function isEntryVisible(item: NavItem): boolean {
    if (item.role) {
      const allowed = Array.isArray(item.role) ? item.role : [item.role]
      if (!allowed.includes(userRole ?? '')) return false
    }
    if (item.resource) {
      const level = userPermissions?.[item.resource] ?? 'none'
      const managerDocumentProfileAccess = item.href === '/staff/admin' && userRole === 'Manager'
      if (level === 'none' && !managerDocumentProfileAccess) return false
      if (item.requireEdit && level !== 'edit') return false
    }
    if (item.children) return item.children.some(childVisible)
    return true
  }

  // Drop section labels that end up with no visible items under them.
  const renderList: NavEntry[] = []
  let pendingSection: string | null = null
  for (const entry of NAV_ITEMS) {
    if (!isNavItem(entry)) { pendingSection = entry.section; continue }
    if (!isEntryVisible(entry)) continue
    if (pendingSection) { renderList.push({ section: pendingSection }); pendingSection = null }
    renderList.push(entry)
  }

  const flatItems = renderList.filter(isNavItem)
  const flat: { href: string }[] = flatItems.flatMap(item =>
    item.children ? item.children.filter(childVisible) : [item],
  )
  const bestMatch = flat
    .filter(entry => pathname === entry.href || pathname.startsWith(entry.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <>
    <style>{`
      @keyframes sidebarPulse{0%,100%{opacity:1}50%{opacity:.35}}
      .staff-nav-link{transition:background .15s, box-shadow .15s, transform .12s}
      .staff-nav-link:not(.staff-nav-active):hover{background:var(--surface-2) !important; transform:translateX(2px)}
      .staff-group-link:not(.staff-nav-active):hover{background:var(--surface-2) !important}
      .staff-child-link:not(.staff-nav-active):hover{background:var(--surface-2) !important; transform:translateX(2px)}
      .staff-user-card:hover{background:var(--primary-soft) !important}
      .staff-nav-chip{transition:background .15s,color .15s}
    `}</style>
    {/* Spacer keeps the flex layout — actual sidebar is fixed */}
    <button
      aria-label="Close navigation"
      onClick={closeMobile}
      className={`staff-sidebar-overlay ${mobileOpen ? 'is-mobile-open' : ''}`}
      style={{
        display: mobileOpen ? 'block' : 'none',
        position: 'fixed',
        inset: 0,
        border: 0,
        background: 'rgba(15,23,42,.42)',
        zIndex: 39,
        padding: 0,
      }}
    />
    <div className="staff-sidebar-spacer" style={{ width: w, flexShrink: 0, transition: 'width .2s' }} />
    <aside
      className={`staff-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}
      style={{
        width: w, background: 'var(--card)',
        borderRight: '1px solid var(--border)', height: '100vh',
        position: 'fixed', top: 0, left: 0,
        display: 'flex', flexDirection: 'column',
        transition: 'width .2s', zIndex: 40,
        overflowY: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 12px' : '18px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
        <Link href="/staff/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flex: 1, minWidth: 0 }}>
          <Image
            src="/images/logo-chonburi.png"
            alt="รพ.ชลบุรี"
            width={44}
            height={44}
            preload
            quality={100}
            style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }}
          />
          {!collapsed && (
            <div style={{ lineHeight: 1.25, overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {settings.systemCode}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{settings.siteName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, animation: 'sidebarPulse 2.2s ease-in-out infinite' }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--success)', letterSpacing: '.03em' }}>ระบบทำงานปกติ</span>
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {renderList.map((entry, i) => {
          if (!isNavItem(entry)) {
            return collapsed ? (
              <div key={`sec-${i}`} style={{ height: 1, background: 'var(--border)', margin: '9px 8px' }} />
            ) : (
              <div key={`sec-${i}`} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.09em', textTransform: 'uppercase', padding: '15px 10px 5px' }}>
                {entry.section}
              </div>
            )
          }

          const item = entry

          // ── Submenu group ──
          if (item.children) {
            const visibleChildren = item.children.filter(childVisible)
            if (visibleChildren.length === 0) return null
            const parentHref = visibleChildren.some(c => c.href === item.href) ? item.href : visibleChildren[0].href
            const groupBase = item.href.split('/').slice(0, 3).join('/') // e.g. /staff/documents
            const groupActive = pathname === groupBase || pathname.startsWith(groupBase + '/')
            const expanded = !collapsed && groupActive && collapsedGroup !== groupBase
            const showActiveRow = groupActive && (collapsed || !expanded)
            return (
              <div key={item.href} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Link
                  href={parentHref}
                  onClick={(e) => {
                    if (groupActive) {
                      // Already on a page in this group — treat the click as an accordion
                      // toggle instead of a re-navigation.
                      e.preventDefault()
                      setCollapsedGroup((prev) => (prev === groupBase ? null : groupBase))
                    } else {
                      setCollapsedGroup(null)
                      closeMobile()
                    }
                  }}
                  title={collapsed ? (lang === 'th' ? item.th : item.en) : undefined}
                  className={`staff-group-link${showActiveRow ? ' staff-nav-active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: collapsed ? '9px' : '7px 10px 7px 8px',
                    borderRadius: 9, textDecoration: 'none',
                    background: showActiveRow ? `${item.color}14` : 'transparent',
                    boxShadow: showActiveRow ? `inset 3px 0 0 ${item.color}` : 'inset 3px 0 0 transparent',
                    fontWeight: groupActive ? 700 : 500, fontSize: 13,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <span className="staff-nav-chip" style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: groupActive ? item.color : `${item.color}16`,
                    color: groupActive ? '#fff' : item.color,
                  }}>
                    <Icon name={item.icon} size={14} />
                  </span>
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, minWidth: 0, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lang === 'th' ? item.th : item.en}</span>
                      {item.href === '/staff/documents/dashboard' && docCount !== null && (
                        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 20 }}>{docCount}</span>
                      )}
                      <Icon name={expanded ? 'chevDown' : 'chevRight'} size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    </>
                  )}
                </Link>
                {expanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginLeft: 13, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
                    {visibleChildren.map(child => {
                      const childActive = bestMatch?.href === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={closeMobile}
                          className={`staff-child-link${childActive ? ' staff-nav-active' : ''}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 10px',
                            borderRadius: 8, textDecoration: 'none',
                            background: childActive ? `${child.color}14` : 'transparent',
                            fontWeight: childActive ? 700 : 500, fontSize: 12.5,
                          }}
                        >
                          <span style={{
                            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: childActive ? child.color : `${child.color}14`,
                            color: childActive ? '#fff' : child.color,
                          }}>
                            <Icon name={child.icon} size={11.5} />
                          </span>
                          <span style={{ flex: 1, color: childActive ? 'var(--ink)' : 'var(--muted)' }}>{lang === 'th' ? child.th : child.en}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const active = bestMatch?.href === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              title={collapsed ? (lang === 'th' ? item.th : item.en) : undefined}
              className={`staff-nav-link${active ? ' staff-nav-active' : ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '9px' : '7px 10px 7px 8px',
                borderRadius: 9, textDecoration: 'none',
                background: active ? `${item.color}14` : 'transparent',
                boxShadow: active ? `inset 3px 0 0 ${item.color}` : 'inset 3px 0 0 transparent',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
            >
              <span className="staff-nav-chip" style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? item.color : `${item.color}16`,
                color: active ? '#fff' : item.color,
              }}>
                <Icon name={item.icon} size={14} />
              </span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: active ? 700 : 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lang === 'th' ? item.th : item.en}</span>
                  {item.href === '/staff/tests' && testCount !== null
                    ? <>
                        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 20 }}>{testCount}</span>
                        <span className="staff-nav-badge-trailing" aria-hidden="true" style={{ width: 12, flexShrink: 0 }} />
                      </>
                    : item.badge && <>
                        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 20 }}>{item.badge}</span>
                        <span className="staff-nav-badge-trailing" aria-hidden="true" style={{ width: 12, flexShrink: 0 }} />
                      </>
                  }
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User card */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div className="staff-user-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, background: 'var(--surface-2)', transition: 'background .15s' }}>
          <Link
            href="/staff/profile"
            title="แก้ไขโปรไฟล์"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
              textDecoration: 'none',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            {userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: 8, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: userDocRole && DOC_ROLE_COLOR[userDocRole]
                  ? `linear-gradient(135deg, ${DOC_ROLE_COLOR[userDocRole]}cc, ${DOC_ROLE_COLOR[userDocRole]}88)`
                  : 'linear-gradient(135deg, var(--primary), #3B82F6)',
              }}>
                {initial}
              </div>
            )}
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName ?? '—'}
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{userRole?.toUpperCase()}</div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex', flexShrink: 0 }}>
              <Icon name="logout" size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}
