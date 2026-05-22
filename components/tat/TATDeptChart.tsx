'use client'

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, LabelList } from 'recharts'

interface DeptRow {
  deptCode: string
  avgTAT: number
  sampleCount: number
}

interface Props {
  data: DeptRow[]
  targetMinutes?: number
}

export function TATDeptChart({ data, targetMinutes = 240 }: Props) {
  const chartData = data.map(d => ({ name: d.deptCode, avgTAT: d.avgTAT, count: d.sampleCount }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="น" width={45} />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v, name) => name === 'avgTAT' ? [`${v as number} นาที`, 'TAT เฉลี่ย'] : [(v as number).toLocaleString(), 'ตัวอย่าง']}
        />
        <ReferenceLine y={targetMinutes} stroke="#D97706" strokeDasharray="4 4" />
        <Bar dataKey="avgTAT" radius={[6, 6, 0, 0]}>
          <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: 'var(--muted)' }} formatter={(v: unknown) => (v as number).toLocaleString()} />
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.avgTAT <= targetMinutes ? '#16A34A' : '#DC2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
