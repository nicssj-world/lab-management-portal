'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { useSidebar } from '@/context/SidebarContext'

const PAGE_TITLES: Record<string, { th: string; en: string }> = {
  '/staff/dashboard':        { th: 'แดชบอร์ดภาพรวม',              en: 'Dashboard Overview' },
  '/staff/tests':            { th: 'จัดการรายการตรวจวิเคราะห์',    en: 'Test Management' },
  '/staff/tests/categories': { th: 'หมวดหมู่การตรวจวิเคราะห์',     en: 'Test Categories' },
  '/staff/news':             { th: 'จัดการข่าวสารห้องปฏิบัติการ',  en: 'News Management' },
  '/staff/rejection':        { th: 'บันทึกการปฏิเสธตัวอย่าง',      en: 'Specimen Rejection Log' },
  '/staff/risk':             { th: 'ทะเบียนความเสี่ยง',             en: 'Risk Register' },
  '/staff/documents':        { th: 'คลังเอกสารคุณภาพ',             en: 'Quality Documents Library' },
  '/staff/documents/dashboard':   { th: 'แดชบอร์ดเอกสารคุณภาพ',    en: 'Documents Dashboard' },
  '/staff/documents/categories':  { th: 'หมวดหมู่เอกสารคุณภาพ',    en: 'Document Categories' },
  '/staff/documents/pending':     { th: 'เอกสารรออนุมัติ',          en: 'Pending Approval' },
  '/staff/documents/read-report': { th: 'รายงานการอ่านเอกสาร',      en: 'Read Compliance' },
  '/staff/documents/master-list': { th: 'จัดการทะเบียนเอกสารคุณภาพ', en: 'Documents Master List' },
  '/staff/contracts':        { th: 'บริหารสัญญา',                en: 'Contracts Management' },
  '/staff/equipment':        { th: 'ทะเบียนเครื่องมือ',           en: 'Equipment Registry' },
  '/staff/personnel':            { th: 'ทะเบียนบุคลากร',          en: 'MT-CBH Staff' },
  '/staff/personnel/compliance': { th: 'รายงานคุณภาพบุคลากร',     en: 'Personnel Quality Report' },
  '/staff/personnel/workforce':  { th: 'Dashboard อัตรากำลัง',     en: 'Workforce Dashboard' },
  '/staff/personnel/org':        { th: 'ผังองค์กร',               en: 'Organization Chart' },
  '/staff/admin':            { th: 'จัดการผู้ใช้และสิทธิ์',          en: 'Users & Roles' },
  '/staff/settings':         { th: 'ตั้งค่าระบบ',                  en: 'System Settings' },
  '/staff/changelog':        { th: 'บันทึกการแก้ไขระบบ',           en: 'System Change Log' },
  '/staff/activity':         { th: 'กิจกรรมทั้งหมด',               en: 'Activity Log' },
  '/kpi/dashboard':          { th: 'KPI Dashboard',                en: 'KPI Dashboard' },
  '/kpi/input':              { th: 'บันทึกข้อมูล KPI',             en: 'KPI Data Entry' },
  '/lab-workload/dashboard': { th: 'Lab Workload',                 en: 'Lab Workload' },
  '/lab-workload/annual':    { th: 'ภาพรวมภาระงานทั้งปี',          en: 'Annual Workload Overview' },
  '/lab-workload/input':     { th: 'บันทึกข้อมูลภาระงาน',          en: 'Workload Entry' },
  '/tat':                    { th: 'Turnaround Time (TAT)',         en: 'Turnaround Time (TAT)' },
  '/tat/annual':             { th: 'ภาพรวม TAT ทั้งปี',             en: 'Annual TAT Overview' },
  '/tat/upload':             { th: 'อัพโหลดข้อมูล TAT',            en: 'Upload TAT Data' },
  '/tat/dashboard':          { th: 'Turnaround Time',              en: 'Turnaround Time' },
  '/tat/import':             { th: 'นำเข้าข้อมูล TAT',             en: 'Import TAT Data' },
}

const BTN: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--ink)',
  cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, textDecoration: 'none',
}

export function StaffTopbar() {
  const pathname = usePathname()
  const { lang, setLang } = useLang()
  const { toggle, toggleMobile } = useSidebar()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme') === 'dark'
    setDark(saved)
    document.documentElement.setAttribute('data-theme', saved ? 'dark' : 'light')
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const title = PAGE_TITLES[pathname] ?? { th: '', en: '' }
  function handleMenuClick() {
    if (window.matchMedia('(max-width: 767px)').matches) toggleMobile()
    else toggle()
  }

  return (
    <header
      className="staff-topbar"
      style={{
        height: 56, borderBottom: '1px solid var(--border)', background: 'var(--card)',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10,
        position: 'sticky', top: 0, zIndex: 30,
      }}
    >
      {/* Hamburger + title */}
      <button onClick={handleMenuClick} style={{ ...BTN, flexShrink: 0 }} title="ย่อ/ขยาย sidebar">
        <Icon name="menu" size={15} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lang === 'th' ? title.th : title.en}
        </div>
      </div>

      {/* Lang toggle */}
      <button
        onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
        style={{ ...BTN, fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit' }}
      >
        {lang === 'th' ? 'EN' : 'TH'}
      </button>

      {/* Dark mode toggle */}
      <button onClick={toggleDark} style={BTN} title={dark ? 'Light mode' : 'Dark mode'}>
        <Icon name={dark ? 'sun' : 'moon'} size={15} />
      </button>

      {/* Home — public page */}
      <Link href="/" style={BTN} title="หน้าแรก">
        <Icon name="home" size={15} />
      </Link>
    </header>
  )
}
