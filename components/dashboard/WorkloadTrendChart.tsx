'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

export interface WorkloadOverallTrendRow {
  month: number
  ln_count: number
}

interface Props {
  data: WorkloadOverallTrendRow[]
}

export function WorkloadTrendChart({ data }: Props) {
  const chartData = data.map(d => ({ ...d, monthLabel: getThaiMonthLabel(d.month) }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={50} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(value) => [(value as number).toLocaleString(), 'จำนวน LN']}
        />
        <Line type="monotone" dataKey="ln_count" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
