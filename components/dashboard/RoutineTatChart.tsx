'use client'

import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { getThaiMonthLabel, getFiscalMonths } from '@/lib/kpi-utils'
import type { AnnualKpiRow } from '@/lib/supabase/types'

const TARGET = 95
const GREEN = '#166534'
const ORANGE = '#D97706'
const RED = '#DC2626'

interface Props {
  data: AnnualKpiRow[] | null
  fiscalYear: number
}

function linearTrend(values: (number | null)[]): (number | null)[] {
  const pts = values.map((v, i) => ({ x: i, y: v })).filter(p => p.y != null) as { x: number; y: number }[]
  if (pts.length < 2) return values.map(() => null)
  const n = pts.length
  const sx = pts.reduce((s, p) => s + p.x, 0)
  const sy = pts.reduce((s, p) => s + p.y, 0)
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0)
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return values.map(() => null)
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return values.map((_, i) => Math.round((intercept + slope * i) * 100) / 100)
}

export function RoutineTatChart({ data, fiscalYear }: Props) {
  const months = getFiscalMonths()
  const row = data?.find(r => r.kpi_code === 'TAT_ROUTINE')
  const series = months.map(m => ({
    month: getThaiMonthLabel(m),
    pct: row?.months[m]?.result_pct ?? null,
  }))
  const hasData = series.some(s => s.pct != null)
  const trend = linearTrend(series.map(s => s.pct))
  const chartData = series.map((s, i) => ({ month: s.month, pct: s.pct, trend: trend[i] }))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>KPI TAT — Routine LAB</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>ปีงบประมาณ {fiscalYear}</div>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: ORANGE }}>Target ≥ {TARGET}%</div>
      </div>
      {!hasData ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีข้อมูล KPI TAT — Routine LAB สำหรับปีงบนี้</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
            <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="%" width={42} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, name) => [`${v}%`, name === 'pct' ? 'ผลงาน' : 'แนวโน้ม']}
            />
            <ReferenceLine y={TARGET} stroke={ORANGE} strokeWidth={2} label={{ value: `Target ${TARGET}`, fill: ORANGE, fontSize: 10, position: 'right' }} />
            <Line type="monotone" dataKey="pct" name="pct" stroke={GREEN} strokeWidth={2.5} dot={{ r: 3, fill: GREEN }} connectNulls />
            <Line type="linear" dataKey="trend" name="trend" stroke={RED} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
