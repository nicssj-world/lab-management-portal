'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts'
import type { WorkloadSummaryRow } from '@/lib/queries/workload'

interface Props { data: WorkloadSummaryRow[] }

export function DeptComparisonChart({ data }: Props) {
  const chartData = data.map((d) => ({ name: d.dept_code, pct: d.pct, color: d.dept_color }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={40} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v}%`, '% on-time']} />
        <ReferenceLine y={100} stroke="#16A34A" strokeDasharray="4 4" />
        <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
