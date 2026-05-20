import type { TestReferenceRange } from '@/lib/supabase/types'

const GENDER_LABEL: Record<string, string> = { M: 'ชาย', F: 'หญิง', All: 'ทั้งหมด' }

interface Props { ranges: TestReferenceRange[] }

export function ReferenceRangeTable({ ranges }: Props) {
  if (ranges.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--muted)' }}>ไม่มีข้อมูลค่าอ้างอิง</div>
  }

  const isSimple = ranges.length === 1 && ranges[0].gender === 'All'
  if (isSimple) {
    const r = ranges[0]
    const val = [r.lower_limit, r.upper_limit].filter((v) => v != null).join(' – ')
    return (
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
        {val} {r.unit && <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 13 }}>{r.unit}</span>}
        {r.note && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontWeight: 400 }}>{r.note}</div>}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: 'var(--surface-2)' }}>
          {['เพศ', 'อายุ', 'ค่าอ้างอิง', 'หน่วย', 'หมายเหตุ'].map((h) => (
            <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ranges.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
            <td style={{ padding: '8px 10px' }}>{GENDER_LABEL[r.gender] ?? r.gender}</td>
            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>
              {r.min_age != null || r.max_age != null
                ? `${r.min_age ?? '0'} – ${r.max_age ?? '∞'} ปี`
                : '—'}
            </td>
            <td style={{ padding: '8px 10px', fontWeight: 600 }}>
              {[r.lower_limit, r.upper_limit].filter((v) => v != null).join(' – ') || '—'}
            </td>
            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{r.unit ?? '—'}</td>
            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{r.note ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
