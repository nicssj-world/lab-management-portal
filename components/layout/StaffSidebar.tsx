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
  role?: string | string[]
  docRole?: string | string[]
  resource?: string
}

interface NavItem {
  href: string
  th: string
  en: string
  icon: string
  badge?: string
  role?: string | string[]
  resource?: string
  requireEdit?: boolean
  children?: NavChild[]
}

const NAV_ITEMS: (NavItem | null)[] = [
  { href: '/staff/dashboard',  th: 'แดชบอร์ด',           en: 'Dashboard',      icon: 'dash' },
  { href: '/staff/tests',      th: 'รายการตรวจ',         en: 'Tests',          icon: 'flask',    resource: 'รายการตรวจ' },
  { href: '/staff/documents/dashboard', th: 'เอกสารคุณภาพ', en: 'Documents', icon: 'doc',
    children: [
      { href: '/staff/documents/dashboard',   th: 'Dashboard',   en: 'Dashboard',   icon: 'dash',  resource: 'เอกสารคุณภาพ' },
      { href: '/staff/documents',             th: 'คลังเอกสาร',  en: 'Library',     icon: 'doc',   resource: 'เอกสารคุณภาพ' },
      { href: '/staff/documents/categories',  th: 'หมวดหมู่',    en: 'Categories',  icon: 'inbox', resource: 'เอกสารคุณภาพ' },
      { href: '/staff/documents/pending',     th: 'รออนุมัติ',   en: 'Pending',     icon: 'clock',
        role: ['Admin', 'Document Controller'], docRole: ['Document Controller', 'Reviewer'] },
      { href: '/staff/documents/master-list', th: 'Master List', en: 'Master List', icon: 'book',  resource: 'Master List' },
    ] },
  { href: '/staff/tests/categories', th: 'หมวดหมู่การตรวจ', en: 'Categories', icon: 'beaker',   resource: 'รายการตรวจ', role: 'Admin' },
  { href: '/staff/news',       th: 'จัดการข่าวสาร',        en: 'News',           icon: 'bell',     resource: 'ข่าวสาร' },
  { href: '/staff/risk',       th: 'ทะเบียนความเสี่ยง',   en: 'Risk Register',  icon: 'shield',   resource: 'ความเสี่ยง / Rejection' },
  { href: '/staff/contracts',  th: 'บริหารสัญญา',         en: 'Contracts',      icon: 'building', resource: 'สัญญา' },
  { href: '/staff/equipment',  th: 'ทะเบียนเครื่องมือ',   en: 'Equipment',      icon: 'microscope', resource: 'ทะเบียนเครื่องมือ' },
  { href: '/staff/personnel',  th: 'บุคลากร',             en: 'MT-CBH Staff',   icon: 'shieldCheck', resource: 'บุคลากร' },
  null,
  { href: '/kpi/dashboard',    th: 'KPI Dashboard',       en: 'KPI Dashboard',  icon: 'chart',    resource: 'KPI' },
  { href: '/lab-workload/dashboard', th: 'Lab Workload', en: 'Lab Workload',   icon: 'beaker',   resource: 'Workload' },
  { href: '/tat',              th: 'Turnaround Time',     en: 'TAT',            icon: 'clock',    resource: 'TAT' },
  { href: '/staff/rejection',  th: 'Rejection Log',       en: 'Rejection',      icon: 'alert',    resource: 'ความเสี่ยง / Rejection' },
  null,
  { href: '/staff/admin',      th: 'จัดการผู้ใช้',         en: 'Users & Roles',  icon: 'users',    resource: 'User Management' },
  { href: '/staff/settings',   th: 'ตั้งค่าระบบ',          en: 'Settings',       icon: 'settings', role: 'Admin' },
  { href: '/staff/activity',   th: 'กิจกรรมทั้งหมด',       en: 'Activity Log',   icon: 'inbox',    resource: 'Activity Log' },
  { href: '/staff/changelog',  th: 'บันทึกการแก้ไขระบบ',   en: 'Change Log',     icon: 'edit',     resource: 'บันทึกการแก้ไข' },
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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = userName?.charAt(0) ?? 'U'

  return (
    <>
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
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {(() => {
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

          const items = NAV_ITEMS.filter((item): item is NavItem => item !== null)
          const flat: { href: string }[] = items.flatMap(item =>
            item.children ? item.children.filter(childVisible) : [item],
          )
          const bestMatch = flat
            .filter(entry => pathname === entry.href || pathname.startsWith(entry.href + '/'))
            .sort((a, b) => b.href.length - a.href.length)[0]

          return NAV_ITEMS.map((item, i) => {
          if (item === null) return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '8px 6px' }} />
          if (item.role) {
            const allowed = Array.isArray(item.role) ? item.role : [item.role]
            if (!allowed.includes(userRole ?? '')) return null
          }
          if (item.resource) {
            const level = userPermissions?.[item.resource] ?? 'none'
            const managerDocumentProfileAccess = item.href === '/staff/admin' && userRole === 'Manager'
            if (level === 'none' && !managerDocumentProfileAccess) return null
            if (item.requireEdit && level !== 'edit') return null
          }

          // ── Submenu group ──
          if (item.children) {
            const visibleChildren = item.children.filter(childVisible)
            if (visibleChildren.length === 0) return null
            const parentHref = visibleChildren.some(c => c.href === item.href) ? item.href : visibleChildren[0].href
            const groupBase = item.href.split('/').slice(0, 3).join('/') // e.g. /staff/documents
            const groupActive = pathname === groupBase || pathname.startsWith(groupBase + '/')
            const expanded = !collapsed && groupActive
            return (
              <div key={item.href} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Link
                  href={parentHref}
                  onClick={closeMobile}
                  title={collapsed ? (lang === 'th' ? item.th : item.en) : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: collapsed ? '10px' : '9px 12px',
                    borderRadius: 8, textDecoration: 'none',
                    background: collapsed && groupActive ? 'var(--primary-soft)' : 'transparent',
                    color: collapsed && groupActive ? 'var(--primary)' : 'var(--ink)',
                    fontWeight: collapsed && groupActive ? 600 : 500, fontSize: 13,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    transition: 'background .15s',
                  }}
                >
                  <Icon name={item.icon} size={17} />
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1 }}>{lang === 'th' ? item.th : item.en}</span>
                      {docCount !== null && (
                        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>{docCount}</span>
                      )}
                      <Icon name={expanded ? 'chevDown' : 'chevRight'} size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    </>
                  )}
                </Link>
                {expanded && visibleChildren.map(child => {
                  const childActive = bestMatch?.href === child.href
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={closeMobile}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '7px 12px 7px 34px',
                        borderRadius: 8, textDecoration: 'none',
                        background: childActive ? 'var(--primary-soft)' : 'transparent',
                        color: childActive ? 'var(--primary)' : 'var(--muted)',
                        fontWeight: childActive ? 600 : 500, fontSize: 12.5,
                        transition: 'background .15s',
                      }}
                    >
                      <Icon name={child.icon} size={15} />
                      <span style={{ flex: 1 }}>{lang === 'th' ? child.th : child.en}</span>
                    </Link>
                  )
                })}
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
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px' : '9px 12px',
                borderRadius: 8, textDecoration: 'none',
                background: active ? 'var(--primary-soft)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--ink)',
                fontWeight: active ? 600 : 500, fontSize: 13,
                justifyContent: collapsed ? 'center' : 'flex-start',
                transition: 'background .15s',
              }}
            >
              <Icon name={item.icon} size={17} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{lang === 'th' ? item.th : item.en}</span>
                  {item.href === '/staff/tests' && testCount !== null
                    ? <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>{testCount}</span>
                    : item.badge && <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>{item.badge}</span>
                  }
                </>
              )}
            </Link>
          )
        })
        })()}
      </nav>

      {/* User card */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, background: 'var(--surface-2)' }}>
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
