'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

interface TrendRow {
  month: number
  result_pct: number | null
  numerator: number | null
}

interface Props {
  data: TrendRow[]
  targetType: string
  targetVal: number
  unit?: string
}

export function TrendChart({ data, targetType, targetVal, unit = '%' }: Props) {
  const chartData = data.map((d) => ({
    month: getThaiMonthLabel(d.month),
    value: d.result_pct ?? d.numerator ?? null,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit={unit} width={40} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${v as number}${unit}`, 'ผล']}
        />
        <ReferenceLine y={targetVal} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Target: ${targetVal}${unit}`, fill: '#D97706', fontSize: 10 }} />
        <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
