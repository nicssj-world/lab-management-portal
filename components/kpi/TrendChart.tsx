'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { getThaiMonthLabel } from '@/lib/kpi-utils'
import { getKpiTargetLabel } from '@/lib/kpi/annual-labels'

interface TrendRow {
  month: number
  result_pct: number | null
  numerator: number | null
}

interface Props {
  data: TrendRow[]
  targetType: 'gte' | 'lte' | 'eq'
  targetVal: number
  unit?: string | null
  isCountMetric: boolean
}

export function TrendChart({ data, targetType, targetVal, unit = '%', isCountMetric }: Props) {
  const displayUnit = unit ?? (isCountMetric ? '' : '%')
  const chartData = data.map((d) => ({
    month: getThaiMonthLabel(d.month),
    // Never fall back from a percentage to its numerator: that would mix
    // units and make a missing denominator look like a valid percentage.
    value: isCountMetric ? d.numerator : d.result_pct,
  }))
  const targetLabel = getKpiTargetLabel({ target_type: targetType, target_val: targetVal, unit: displayUnit })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit={displayUnit} width={40} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [`${v as number}${displayUnit}`, 'ผล']}
        />
        <ReferenceLine y={targetVal} stroke="var(--warning)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Target: ${targetLabel}`, fill: 'var(--warning)', fontSize: 10 }} />
        <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
