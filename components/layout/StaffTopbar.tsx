'use client'

import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useLang } from '@/context/LangContext'

const PAGE_TITLES: Record<string, { th: string; en: string }> = {
  '/staff/dashboard':        { th: 'แดชบอร์ดภาพรวม',              en: 'Dashboard Overview' },
  '/staff/tests':            { th: 'จัดการรายการตรวจวิเคราะห์',    en: 'Test Management' },
  '/staff/tests/categories': { th: 'หมวดหมู่การตรวจวิเคราะห์',     en: 'Test Categories' },
  '/staff/news':             { th: 'จัดการข่าวสารห้องปฏิบัติการ',  en: 'News Management' },
  '/staff/rejection':        { th: 'บันทึกการปฏิเสธตัวอย่าง',      en: 'Specimen Rejection Log' },
  '/staff/risk':             { th: 'ทะเบียนความเสี่ยง',             en: 'Risk Register' },
  '/staff/documents':        { th: 'จัดการเอกสารคุณภาพ',           en: 'Quality Documents' },
  '/staff/contracts':        { th: 'สัญญาและวัสดุ',                en: 'Contracts & Supplies' },
  '/staff/admin':            { th: 'จัดการผู้ใช้และสิทธิ์',          en: 'Users & Roles' },
  '/staff/settings':         { th: 'ตั้งค่าระบบ',                  en: 'System Settings' },
  '/kpi/dashboard':          { th: 'KPI Dashboard',                en: 'KPI Dashboard' },
  '/kpi/input':              { th: 'บันทึกข้อมูล KPI',             en: 'KPI Data Entry' },
  '/lab-workload/dashboard': { th: 'Lab Workload',                 en: 'Lab Workload' },
  '/lab-workload/input':     { th: 'บันทึกข้อมูลภาระงาน',          en: 'Workload Entry' },
  '/tat/dashboard':          { th: 'Turnaround Time',              en: 'Turnaround Time' },
  '/tat/import':             { th: 'นำเข้าข้อมูล TAT',             en: 'Import TAT Data' },
}

interface StaffTopbarProps {
  onCollapseToggle?: () => void
}

export function StaffTopbar({ onCollapseToggle }: StaffTopbarProps) {
  const pathname = usePathname()
  const { lang, setLang } = useLang()

  const title = PAGE_TITLES[pathname] ?? { th: '', en: '' }

  return (
    <header
      style={{
        height: 56, borderBottom: '1px solid var(--border)', background: 'var(--card)',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16,
        position: 'sticky', top: 0, zIndex: 30,
      }}
    >
      {onCollapseToggle && (
        <button
          onClick={onCollapseToggle}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'transparent', color: 'var(--ink)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Icon name="menu" size={18} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lang === 'th' ? title.th : title.en}
        </div>
      </div>
      <div style={{ width: 280, flexShrink: 0 }}>
        <Input
          icon="search"
          placeholder={lang === 'th' ? 'ค้นหา test, เอกสาร, ผู้ใช้…' : 'Search tests, docs, users…'}
          size="sm"
        />
      </div>
      <button
        onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
        style={{
          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
          fontSize: 10.5, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        {lang === 'th' ? 'EN' : 'TH'}
      </button>
      <button
        style={{
          width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
        }}
      >
        <Icon name="bell" size={15} />
        <span
          style={{
            position: 'absolute', top: 5, right: 5, width: 7, height: 7,
            borderRadius: '50%', background: '#DC2626', border: '2px solid var(--card)',
          }}
        />
      </button>
    </header>
  )
}
