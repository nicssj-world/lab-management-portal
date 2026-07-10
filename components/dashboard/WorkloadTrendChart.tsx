'use client'

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

export function WorkloadTrendChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey={(row: WorkloadOverallTrendRow) => monthLabel(row)} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <Tooltip formatter={(value, name) => [fmt(Number(value)), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
        <Bar yAxisId="left" dataKey="ln_count" name="LN" fill="#BFD7F2" radius={[5, 5, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="test_rows" name="Test rows" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
