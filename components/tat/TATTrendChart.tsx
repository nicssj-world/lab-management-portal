'use client'

import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { getThaiMonthLabel } from '@/lib/kpi-utils'

interface TrendRow {
  month: number
  avgTAT: number
  sampleCount: number
}

interface Props {
  data: TrendRow[]
  targetMinutes?: number
}

export function TATTrendChart({ data, targetMinutes = 240 }: Props) {
  const chartData = data.map(d => ({ ...d, month: getThaiMonthLabel(d.month) }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis
          yAxisId="tat"
          tick={{ fontSize: 11, fill: 'var(--muted)' }}
          label={{ value: 'นาที', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted)' }}
          width={50}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={{ fontSize: 11, fill: 'var(--muted)' }}
          label={{ value: 'ตัวอย่าง', angle: 90, position: 'insideRight', fontSize: 11, fill: 'var(--muted)' }}
          width={55}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(value, name) => {
            if (name === 'avgTAT') return [`${value as number} นาที`, 'TAT เฉลี่ย']
            if (name === 'sampleCount') return [(value as number).toLocaleString(), 'จำนวนตัวอย่าง']
            return [value as number, name as string]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === 'avgTAT' ? 'TAT เฉลี่ย (นาที)' : 'จำนวนตัวอย่าง'} />
        <ReferenceLine yAxisId="tat" y={targetMinutes} stroke="#D97706" strokeDasharray="4 4" label={{ value: `เป้า ${targetMinutes}น`, fill: '#D97706', fontSize: 10 }} />
        <Bar yAxisId="count" dataKey="sampleCount" fill="var(--primary-soft)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="tat" type="monotone" dataKey="avgTAT" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
