'use client'

import { getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'

interface MonthSelectorProps {
  value: number
  onChange: (month: number) => void
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const months = getFiscalMonths()
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {months.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
            fontWeight: value === m ? 600 : 400, cursor: 'pointer', border: '1px solid',
            borderColor: value === m ? 'var(--primary)' : 'var(--border)',
            background: value === m ? 'var(--primary)' : 'var(--card)',
            color: value === m ? '#fff' : 'var(--ink)',
            transition: 'all .15s',
          }}
        >
          {getThaiMonthLabel(m)}
        </button>
      ))}
    </div>
  )
}
