'use client'

import { getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'

interface MonthSelectorProps {
  value: number
  onChange: (month: number) => void
  isMonthDisabled?: (month: number) => boolean
}

export function MonthSelector({ value, onChange, isMonthDisabled }: MonthSelectorProps) {
  const months = getFiscalMonths()
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {months.map(m => (
        <button
          key={m}
          type="button"
          disabled={isMonthDisabled?.(m) ?? false}
          onClick={() => onChange(m)}
          title={isMonthDisabled?.(m) ? 'ยังไม่ถึงงวดเดือนนี้ ไม่สามารถกรอกล่วงหน้าได้' : undefined}
          style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontFamily: 'inherit',
            fontWeight: value === m ? 600 : 400,
            cursor: isMonthDisabled?.(m) ? 'not-allowed' : 'pointer', border: '1px solid',
            borderColor: value === m && !isMonthDisabled?.(m) ? 'var(--primary)' : 'var(--border)',
            background: value === m && !isMonthDisabled?.(m) ? 'var(--primary)' : 'var(--surface-2)',
            color: value === m && !isMonthDisabled?.(m) ? '#fff' : 'var(--muted)',
            opacity: isMonthDisabled?.(m) ? 0.65 : 1,
            transition: 'all .15s',
          }}
        >
          {getThaiMonthLabel(m)}
        </button>
      ))}
    </div>
  )
}
