'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  th: string
  en: string
  icon: string
  badge?: string
  role?: string
}

const NAV_ITEMS: (NavItem | null)[] = [
  { href: '/staff/dashboard',  th: 'แดชบอร์ด',           en: 'Dashboard',      icon: 'dash' },
  { href: '/staff/tests',      th: 'รายการตรวจ',         en: 'Tests',          icon: 'flask', badge: '575' },
  { href: '/staff/tests/categories', th: 'หมวดหมู่การตรวจ', en: 'Categories', icon: 'beaker' },
  { href: '/staff/news',       th: 'จัดการข่าวสาร',        en: 'News',           icon: 'bell' },
  { href: '/staff/rejection',  th: 'Rejection Log',       en: 'Rejection',      icon: 'alert' },
  { href: '/staff/risk',       th: 'ทะเบียนความเสี่ยง',   en: 'Risk Register',  icon: 'shield' },
  { href: '/staff/documents',  th: 'เอกสารคุณภาพ',        en: 'Documents',      icon: 'doc' },
  { href: '/staff/contracts',  th: 'สัญญา/วัสดุ',         en: 'Contracts',      icon: 'building' },
  null,
  { href: '/kpi/dashboard',    th: 'KPI Dashboard',       en: 'KPI Dashboard',  icon: 'chart' },
  { href: '/lab-workload/dashboard', th: 'Lab Workload', en: 'Lab Workload',   icon: 'beaker' },
  { href: '/tat/dashboard',    th: 'Turnaround Time',     en: 'TAT',            icon: 'clock' },
  null,
  { href: '/staff/admin',      th: 'จัดการผู้ใช้',         en: 'Users & Roles',  icon: 'users', role: 'admin' },
  { href: '/staff/settings',   th: 'ตั้งค่าระบบ',          en: 'Settings',       icon: 'settings', role: 'admin' },
]

interface StaffSidebarProps {
  userRole?: string
  userName?: string
}

export function StaffSidebar({ userRole, userName }: StaffSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { lang } = useLang()
  const [collapsed, setCollapsed] = useState(false)
  const w = collapsed ? 64 : 248

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = userName?.split(' ').slice(-1)[0]?.charAt(0) ?? 'U'

  return (
    <aside
      style={{
        width: w, flexShrink: 0, background: 'var(--card)',
        borderRight: '1px solid var(--border)', height: '100vh',
        position: 'sticky', top: 0, display: 'flex', flexDirection: 'column',
        transition: 'width .2s', zIndex: 40,
      }}
    >
      {/* Logo + collapse toggle */}
      <div style={{ padding: collapsed ? '18px 12px' : '18px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Image src="/images/logo-chonburi.png" alt="รพ.ชลบุรี" width={44} height={44} style={{ height: 44, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        {!collapsed && (
          <div style={{ lineHeight: 1.1, overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              {lang === 'th' ? 'เทคนิคการแพทย์' : 'Med-Tech Lab'}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Staff Portal</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Icon name="menu" size={14} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item, i) => {
          if (item === null) return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '8px 6px' }} />
          if (item.role && userRole !== item.role) return null
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
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
                  {item.badge && <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 500 }}>{item.badge}</span>}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User card */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: 'var(--surface-2)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            {initial}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {userName ?? '—'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{userRole?.toUpperCase()}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex' }}>
              <Icon name="logout" size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
