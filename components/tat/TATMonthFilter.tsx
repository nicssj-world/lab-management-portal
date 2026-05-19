'use client'

import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { MonthSelector } from '@/components/ui/MonthSelector'

interface Props {
  year: number
  month: number
  dept?: string
  depts?: { code: string; name: string }[]
  onYearChange: (y: number) => void
  onMonthChange: (m: number) => void
  onDeptChange?: (d: string) => void
}

export function TATMonthFilter({ year, month, dept, depts, onYearChange, onMonthChange, onDeptChange }: Props) {
  const curYear = getCurrentThaiFiscalYear()
  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={year} onChange={e => onYearChange(Number(e.target.value))} style={selectStyle}>
        {[curYear, curYear - 1].map(y => (
          <option key={y} value={y}>ปีงบ {y}</option>
        ))}
      </select>
      <MonthSelector value={month} onChange={onMonthChange} />
      {depts && onDeptChange && (
        <select value={dept ?? ''} onChange={e => onDeptChange(e.target.value)} style={selectStyle}>
          <option value="">ทุกแผนก</option>
          {depts.map(d => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
