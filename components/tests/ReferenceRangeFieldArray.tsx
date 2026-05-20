'use client'

import { Icon } from '@/components/ui/Icon'
import type { ReferenceRangeRow } from '@/lib/validations/test-schema'

interface Props {
  rows: ReferenceRangeRow[]
  onChange: (rows: ReferenceRangeRow[]) => void
}

const EMPTY_ROW: ReferenceRangeRow = {
  gender: 'All', min_age: null, max_age: null,
  lower_limit: null, upper_limit: null, unit: '', note: '', sort_order: 0,
}

const numInput: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 8px', borderRadius: 7,
  border: '1px solid var(--border)', background: 'var(--card)',
  color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit',
}
const textInput: React.CSSProperties = { ...numInput }
const sel: React.CSSProperties = { ...numInput, paddingRight: 24 }

export function ReferenceRangeFieldArray({ rows, onChange }: Props) {
  function update(i: number, patch: Partial<ReferenceRangeRow>) {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)
    onChange(next)
  }
  function remove(i: number) { onChange(rows.filter((_, idx) => idx !== i)) }
  function add() { onChange([...rows, { ...EMPTY_ROW, sort_order: rows.length }]) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 80px 90px 90px 80px 1fr 32px', gap: 6, marginBottom: 2 }}>
          {['เพศ', 'อายุต่ำสุด', 'อายุสูงสุด', 'ค่าต่ำสุด', 'ค่าสูงสุด', 'หน่วย', 'หมายเหตุ', ''].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{h}</div>
          ))}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 80px 80px 90px 90px 80px 1fr 32px', gap: 6, alignItems: 'center' }}>
          <select value={row.gender} onChange={(e) => update(i, { gender: e.target.value as 'M' | 'F' | 'All' })} style={sel}>
            <option value="All">ทั้งหมด</option>
            <option value="M">ชาย</option>
            <option value="F">หญิง</option>
          </select>
          <input type="number" placeholder="ปี" value={row.min_age ?? ''} onChange={(e) => update(i, { min_age: e.target.value ? Number(e.target.value) : null })} style={numInput} />
          <input type="number" placeholder="ปี" value={row.max_age ?? ''} onChange={(e) => update(i, { max_age: e.target.value ? Number(e.target.value) : null })} style={numInput} />
          <input type="number" placeholder="ต่ำสุด" value={row.lower_limit ?? ''} onChange={(e) => update(i, { lower_limit: e.target.value ? Number(e.target.value) : null })} style={numInput} />
          <input type="number" placeholder="สูงสุด" value={row.upper_limit ?? ''} onChange={(e) => update(i, { upper_limit: e.target.value ? Number(e.target.value) : null })} style={numInput} />
          <input type="text" placeholder="หน่วย" value={row.unit ?? ''} onChange={(e) => update(i, { unit: e.target.value })} style={textInput} />
          <input type="text" placeholder="หมายเหตุ" value={row.note ?? ''} onChange={(e) => update(i, { note: e.target.value })} style={textInput} />
          <button onClick={() => remove(i)} style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--muted)', fontFamily: 'inherit', width: 'fit-content', marginTop: 4 }}
      >
        <Icon name="plus" size={14} /> เพิ่มแถว
      </button>
    </div>
  )
}
