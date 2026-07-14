'use client'

import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

export interface WorkloadOverallTrendRow {
  year: number
  month: number
  ln_count: number
  test_rows: number
}

interface Props {
  data: WorkloadOverallTrendRow[]
}

function monthLabel(row: { year: number; month: number }) {
  return `${getThaiMonthLabel(row.month)} ${String(row.year + 543).slice(2)}`
}

function fmt(n: number) {
  return n.toLocaleString()
}

function compactFmt(n: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

// Two Y-axes plus 12 month/year ticks eat most of the plot width on a narrow
// phone — shrink the axis gutters, compact the tick labels, and skip every
// other month label so nothing overlaps below the 480px breakpoint.
function useIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 480px)')
    setIsNarrow(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isNarrow
}

export function WorkloadTrendChart({ data }: Props) {
  const isNarrow = useIsNarrow()
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey={(row: WorkloadOverallTrendRow) => monthLabel(row)}
          tick={{ fontSize: 10.5, fill: 'var(--muted)' }}
          interval={isNarrow ? 1 : 0}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} width={34} tickFormatter={compactFmt} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} width={34} tickFormatter={compactFmt} />
        <Tooltip formatter={(value, name) => [fmt(Number(value)), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
        <Bar yAxisId="left" dataKey="ln_count" name="LN" fill="#BFD7F2" radius={[5, 5, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="test_rows" name="Test rows" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
