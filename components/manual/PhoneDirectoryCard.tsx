'use client'
import { Icon } from '@/components/ui/Icon'
import { PHONE_DIRECTORY, type PhoneEntry } from '@/app/(public)/manual/data'
import { useManualTable } from '@/app/(public)/manual/ManualTablesContext'

export function PhoneDirectoryCard({ lang }: { lang: 'th' | 'en' }) {
  const phone = useManualTable<PhoneEntry>('phoneDirectory', 'home', PHONE_DIRECTORY)
  return (
    <div className="manual-phone-dir">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>
        <Icon name="phone" size={13} style={{ color: 'var(--primary)' }} />
        {lang === 'th' ? 'เบอร์โทรภายใน' : 'Internal extensions'}
      </div>
      {phone.rows.map((row, i) => {
        const e = row as unknown as PhoneEntry
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < phone.rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span>{e.label}</span>
            <strong style={{ color: 'var(--ink)', fontFamily: '"IBM Plex Mono",monospace' }}>{e.ext}</strong>
          </div>
        )
      })}
    </div>
  )
}
