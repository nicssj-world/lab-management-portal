'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { getThaiMonthLabel, getFiscalMonths } from '@/lib/kpi-utils'
import type { WorkloadTrendRow } from '@/lib/queries/workload'

interface Props {
  data: WorkloadTrendRow[]
  departments: { code: string; color: string }[]
}

export function MonthlyTrendChart({ data, departments }: Props) {
  const months = getFiscalMonths()
  const chartData = months.map((m) => {
    const row: Record<string, number | string> = { month: getThaiMonthLabel(m) }
    for (const dept of departments) {
      const entry = data.find((d) => d.month === m && d.dept_code === dept.code)
      row[dept.code] = entry?.pct ?? 0
    }
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={40} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {departments.map((dept) => (
          <Line key={dept.code} type="monotone" dataKey={dept.code} stroke={dept.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
