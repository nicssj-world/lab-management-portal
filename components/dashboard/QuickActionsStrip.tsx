import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'

const ACTIONS = [
  { href: '/staff/tests',     icon: 'plus',   accent: '#1E5FAD', th: 'เพิ่มรายการตรวจ',   en: 'Add new test item' },
  { href: '/staff/documents', icon: 'upload', accent: '#0D9488', th: 'Upload เอกสาร',     en: 'SOP / WI / Form' },
  { href: '/staff/rejection', icon: 'alert',  accent: '#DC2626', th: 'บันทึก Rejection',  en: 'Log specimen rejection' },
  { href: '/kpi/dashboard',   icon: 'chart',  accent: '#16A34A', th: 'รายงาน KPI',        en: 'Monthly report' },
] as const

export function QuickActionsStrip() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} className="dash-qa-strip">
      {ACTIONS.map(item => (
        <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
          <div className="qa-tile" style={{
            padding: '13px 14px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--card)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${item.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.accent, flexShrink: 0 }}>
              <Icon name={item.icon} size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{item.th}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.en}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
