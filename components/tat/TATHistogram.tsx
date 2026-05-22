'use client'

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

interface BucketRow {
  bucket: string
  count: number
}

interface Props {
  data: BucketRow[]
}

const BUCKET_LABELS: Record<string, string> = {
  '<30': '<30 นาที',
  '30-60': '30–60 นาที',
  '1-2h': '1–2 ชม.',
  '2-4h': '2–4 ชม.',
  '4-8h': '4–8 ชม.',
  '>8h': '>8 ชม.',
}

export function TATHistogram({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0)
  let cumulative = 0
  const chartData = data.map(d => {
    cumulative += d.count
    return {
      label: BUCKET_LABELS[d.bucket] ?? d.bucket,
      count: d.count,
      cumPct: total > 0 ? Math.round(cumulative / total * 100 * 10) / 10 : 0,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
        <YAxis
          yAxisId="count"
          tick={{ fontSize: 11, fill: 'var(--muted)' }}
          width={45}
        />
        <YAxis
          yAxisId="pct"
          orientation="right"
          tick={{ fontSize: 11, fill: 'var(--muted)' }}
          unit="%"
          domain={[0, 100]}
          width={40}
        />
        <Tooltip
          contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          formatter={(v, name) => {
            if (name === 'count') return [(v as number).toLocaleString(), 'จำนวนตัวอย่าง']
            if (name === 'cumPct') return [`${v as number}%`, 'สะสม %']
            return [v as number, name as string]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === 'count' ? 'จำนวนตัวอย่าง' : 'สะสม %'} />
        <Bar yAxisId="count" dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="pct" type="monotone" dataKey="cumPct" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
