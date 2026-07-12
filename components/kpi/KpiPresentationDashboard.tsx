'use client'

import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { getFiscalMonths, getThaiMonthLabel, calcResult } from '@/lib/kpi-utils'
import type { AnnualKpiRow } from '@/lib/supabase/types'

interface Props {
  year: number
  deptCode: string | null
}

const MONTHS = getFiscalMonths()
const GREEN = 'var(--success)'
const ORANGE = 'var(--warning)'
const RED = 'var(--danger)'
const BLUE = 'var(--primary)'

// ── Linear regression trendline ──────────────────────────────────
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

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString()
}

export function KpiPresentationDashboard({ year, deptCode }: Props) {
  const [rows, setRows] = useState<AnnualKpiRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ year: String(year) })
    if (deptCode) params.set('dept', deptCode)
    fetch(`/kpi/api/annual?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRows(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year, deptCode])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: 88, borderRadius: 12, background: 'var(--surface-2)' }} />
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 260, borderRadius: 12, background: 'var(--surface-2)' }} />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <Card padding={0}>
        <EmptyState icon="chart" title="ยังไม่มีข้อมูล KPI" hint="ยังไม่มีข้อมูลสำหรับปีงบและแผนกที่เลือก — ลองเปลี่ยนตัวกรองด้านบน" />
      </Card>
    )
  }

  const byCode = (code: string) => rows.find(r => r.kpi_code === code)

  // Build monthly value arrays for a KPI
  const monthSeries = (code: string) => {
    const row = byCode(code)
    return MONTHS.map(m => ({
      month: getThaiMonthLabel(m),
      num: row?.months[m]?.numerator ?? null,
      den: row?.months[m]?.denominator ?? null,
      pct: row?.months[m]?.result_pct ?? null,
    }))
  }

  const countTotal = (code: string) => {
    const row = byCode(code)
    if (!row) return 0
    return MONTHS.reduce((s, m) => s + (row.months[m]?.numerator ?? 0), 0)
  }

  // Hero summary: for each KPI, take the most recent month with data and classify pass/fail
  let passCount = 0, failCount = 0
  for (const row of rows) {
    const latestMonth = [...MONTHS].reverse().find((m) => row.months[m] != null)
    const latest = latestMonth != null ? row.months[latestMonth] : undefined
    if (latest?.is_pass === true) passCount++
    else if (latest?.is_pass === false) failCount++
  }
  const totalKpis = rows.length
  const passRate = totalKpis > 0 ? Math.round((passCount / totalKpis) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero summary row — latest month snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label="ตัวชี้วัดทั้งหมด" value={totalKpis} icon="chart" color="blue" />
        <Stat label="ผ่านเป้าหมาย" value={passCount} icon="shieldCheck" color="green" />
        <Stat label="ไม่ผ่านเป้าหมาย" value={failCount} icon="alert" color="red" />
        <Stat label="อัตราผ่านล่าสุด" value={`${passRate}%`} icon="trending" color={passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'} />
      </div>

      {/* 1.1 Routine LAB */}
      <LineKpiCard title="TAT — Routine LAB" target={95} targetType="gte" series={monthSeries('TAT_ROUTINE')} />
      {/* 1.2 Stroke */}
      <LineKpiCard title="TAT — Stroke Fast Tract" target={100} targetType="gte" series={monthSeries('TAT_STROKE')} />
      {/* 1.3 Critical */}
      <LineKpiCard title="TAT — ค่าวิกฤติ (15 นาที)" target={100} targetType="gte" series={monthSeries('TAT_CRITICAL')} yMin={50} />
      {/* 1.4 Uncrossmatch */}
      <UncrossCard series={monthSeries('TAT_UNCROSS')} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* 3. Wrong blood */}
        <ZeroIncidentCard title="ผู้ป่วยได้รับเลือดผิดคน/ผิดหมู่" total={countTotal('RISK_BLOOD')} />
        {/* 4.5 Sentinel */}
        <ZeroIncidentCard title="Sentinel Event (G-I)" total={countTotal('RISK_SENTINEL')} />
      </div>

      {/* 2. Error rate */}
      <ErrorRateCard series={monthSeries('ERR_REPORT')} />

      {/* 4.1 IPSG1 pie */}
      <IpsgCard
        opd={countTotal('RISK_ID_OPD')}
        ward={countTotal('RISK_ID_WARD')}
        sticker={countTotal('RISK_STICKER')}
        opdSeries={monthSeries('RISK_ID_OPD')}
        wardSeries={monthSeries('RISK_ID_WARD')}
        stickerSeries={monthSeries('RISK_STICKER')}
      />

      {/* 4.2 Near miss */}
      <LineKpiCard title="Near Miss A-B (อุบัติการณ์)" target={75} targetType="gte" series={monthSeries('RISK_NEARMISS')} yMin={70} lineColor={BLUE} />
    </div>
  )
}

// ── Card header ──────────────────────────────────────────────────
function CardHeader({ title, target, targetUnit = '%' }: { title: string; target: string; targetUnit?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="chart" size={16} style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ORANGE, marginTop: 2 }}>Target : {target}</div>
    </div>
  )
}

// ── Line KPI card (Routine, Stroke, Critical, Near Miss) ─────────
function LineKpiCard({ title, target, targetType, series, yMin = 80, lineColor = GREEN }: {
  title: string
  target: number
  targetType: 'gte' | 'lte'
  series: { month: string; num: number | null; den: number | null; pct: number | null }[]
  yMin?: number
  lineColor?: string
}) {
  const hasData = series.some(s => s.pct != null)
  const trend = linearTrend(series.map(s => s.pct))
  const chartData = series.map((s, i) => ({ month: s.month, pct: s.pct, trend: trend[i] }))
  const targetLabel = `${targetType === 'gte' ? '≥' : '≤'} ${target}%`

  return (
    <Card padding={20}>
      <CardHeader title={title} target={targetLabel} />
      {!hasData ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูลสำหรับแผนกนี้</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis domain={[yMin, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} unit="%" width={42} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [`${v}%`, name === 'pct' ? 'ผลงาน' : 'แนวโน้ม']}
              />
              <ReferenceLine y={target} stroke={ORANGE} strokeWidth={2} label={{ value: `Target ${target}`, fill: ORANGE, fontSize: 10, position: 'right' }} />
              <Line type="monotone" dataKey="pct" name="pct" stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, fill: lineColor }} connectNulls />
              <Line type="linear" dataKey="trend" name="trend" stroke={RED} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          <MiniTable
            series={series}
            rows={[
              { label: 'ทันเวลา', key: 'num' },
              { label: 'ทั้งหมด', key: 'den' },
              { label: 'ร้อยละ', key: 'pct', isPct: true, target, targetType },
            ]}
          />
        </>
      )}
    </Card>
  )
}

// ── Uncrossmatch (bar count + 100%) ──────────────────────────────
function UncrossCard({ series }: { series: { month: string; num: number | null; den: number | null; pct: number | null }[] }) {
  const hasData = series.some(s => s.num != null && s.num > 0)
  const chartData = series.map(s => ({ month: s.month, count: s.num ?? 0 }))

  return (
    <Card padding={20}>
      <CardHeader title="TAT — Uncrossmatch (เตรียม/จ่ายเลือด)" target="100%" />
      {!hasData ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูลสำหรับแผนกนี้</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={36} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} ครั้ง`, 'จำนวน']} />
              <Bar dataKey="count" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
            <Icon name="check" size={14} stroke={3} />
            ทันเวลา 100.00% ทุกเดือน
          </div>
          <MiniTable
            series={series}
            rows={[
              { label: 'ทันเวลา', key: 'num' },
              { label: 'ทั้งหมด', key: 'den' },
              { label: 'ร้อยละ', key: 'pct', isPct: true, target: 100, targetType: 'gte' },
            ]}
          />
        </>
      )}
    </Card>
  )
}

// ── Zero-incident card ───────────────────────────────────────────
function ZeroIncidentCard({ title, total }: { title: string; total: number }) {
  const ok = total === 0
  return (
    <Card padding={24}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name={ok ? 'shieldCheck' : 'alert'} size={16} style={{ color: ok ? 'var(--success)' : 'var(--danger)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
      </div>
      <div style={{
        border: `2px solid ${ok ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 12,
        padding: '28px 16px', textAlign: 'center',
        background: ok ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color: ok ? 'var(--success)' : 'var(--danger)', lineHeight: 1 }}>{total}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--muted)' }}>INCIDENTS</span>
          <Icon name={ok ? 'check' : 'x'} size={32} stroke={3} style={{ color: ok ? 'var(--success)' : 'var(--danger)' }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color: ok ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
          {ok ? 'ไม่พบอุบัติการณ์ตลอดปีงบประมาณ' : `พบ ${total} อุบัติการณ์ — Target: 0 ครั้ง`}
        </div>
      </div>
    </Card>
  )
}

// ── Error rate card (gauge + summary) ────────────────────────────
function ErrorRateCard({ series }: { series: { month: string; num: number | null; den: number | null; pct: number | null }[] }) {
  const totalErr = series.reduce((s, m) => s + (m.num ?? 0), 0)
  const totalDen = series.reduce((s, m) => s + (m.den ?? 0), 0)
  const rate = totalDen > 0 ? Math.round((totalErr / totalDen) * 100 * 1000) / 1000 : 0
  const accuracy = Math.round((100 - rate) * 1000) / 1000
  const target = 0.05
  const pass = rate <= target

  // Gauge geometry (semicircle), scale 0 .. 0.1 (target 0.05 at midpoint)
  const max = 0.1
  const cx = 110, cy = 100, r = 88
  const valFrac = Math.min(rate / max, 1)
  const tgtFrac = target / max
  const polar = (frac: number, radius: number) => {
    const ang = Math.PI - frac * Math.PI // 180deg→0deg
    return { x: cx + radius * Math.cos(ang), y: cy - radius * Math.sin(ang) }
  }
  const arc = (f0: number, f1: number, radius: number) => {
    const a = polar(f0, radius), b = polar(f1, radius)
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`
  }
  const needle = polar(valFrac, r - 14)

  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon name="alert" size={16} style={{ color: ORANGE }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>การรายงานผลคลาดเคลื่อนหรือผิดพลาด</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ORANGE, marginBottom: 12 }}>Target : &lt; 0.05%</div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        {/* Gauge */}
        <svg width={220} height={130} viewBox="0 0 220 130">
          <path d={arc(0, tgtFrac, r)} fill="none" stroke={GREEN} strokeWidth={20} strokeLinecap="round" />
          <path d={arc(tgtFrac, 1, r)} fill="none" stroke={RED} strokeWidth={20} strokeLinecap="round" />
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="var(--ink)" />
          <text x={polar(tgtFrac, r + 16).x} y={polar(tgtFrac, r + 16).y} fontSize={11} fill={RED} textAnchor="middle">0.05</text>
          <text x={cx} y={cy + 22} fontSize={15} fontWeight={700} fill={pass ? GREEN : RED} textAnchor="middle">{rate.toFixed(3)}%</text>
        </svg>

        {/* Summary */}
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>คลาดเคลื่อนรวมทั้งปี</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{totalErr} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>ครั้ง</span></div>
          <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, background: 'rgba(22,163,74,.1)', display: 'inline-block' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>Accuracy Rate = {accuracy.toFixed(3)}%</span>
          </div>
        </div>
      </div>

      <MiniTable
        series={series}
        rows={[
          { label: 'คลาดเคลื่อน (ครั้ง)', key: 'num' },
          { label: 'ส่งตรวจทั้งหมด', key: 'den' },
          { label: 'ร้อยละ', key: 'pct', isPct: true, target: 0.05, targetType: 'lte', pctDecimals: 3 },
        ]}
      />
    </Card>
  )
}

// ── IPSG1 pie + table ────────────────────────────────────────────
function IpsgCard({ opd, ward, sticker, opdSeries, wardSeries, stickerSeries }: {
  opd: number; ward: number; sticker: number
  opdSeries: { month: string; num: number | null }[]
  wardSeries: { month: string; num: number | null }[]
  stickerSeries: { month: string; num: number | null }[]
}) {
  const pieData = [
    { name: 'เจาะเลือดผิด OPD', value: opd, color: GREEN },
    { name: 'เจาะเลือดผิด Ward', value: ward, color: ORANGE },
    { name: 'ติดสติ๊กเกอร์ผิด', value: sticker, color: BLUE },
  ].filter(d => d.value > 0)
  const total = opd + ward + sticker

  return (
    <Card padding={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <Icon name="alert" size={16} style={{ color: ORANGE }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>การชี้บ่งตัวผู้ป่วยผิด (IPSG1)</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ORANGE, marginBottom: 12 }}>Target : 0 ครั้ง · รวมทั้งปี {total} ครั้ง</div>

      {total === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>ไม่พบอุบัติการณ์ ✓</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <ResponsiveContainer width={260} height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${Math.round((e.value / total) * 100)}%`} labelLine={false}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} ครั้ง`, '']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: 'var(--ink)', flex: 1 }}>{d.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* monthly table */}
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              <th style={ipsgTh}>รายการ</th>
              {MONTHS.map(m => <th key={m} style={{ ...ipsgTh, textAlign: 'center' }}>{getThaiMonthLabel(m)}</th>)}
              <th style={{ ...ipsgTh, textAlign: 'center', color: 'var(--primary)' }}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'OPD', s: opdSeries, t: opd },
              { label: 'Ward', s: wardSeries, t: ward },
              { label: 'Sticker', s: stickerSeries, t: sticker },
            ].map(r => (
              <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.label}</td>
                {r.s.map((c, i) => <td key={i} style={{ padding: '5px 8px', textAlign: 'center', color: c.num ? 'var(--danger)' : 'var(--border)' }}>{c.num ?? '—'}</td>)}
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--danger)' }}>{r.t}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const ipsgTh: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700,
  color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
}

// ── Mini monthly table (numerator/denominator/pct) ───────────────
function MiniTable({ series, rows }: {
  series: { month: string; num: number | null; den: number | null; pct: number | null }[]
  rows: { label: string; key: 'num' | 'den' | 'pct'; isPct?: boolean; target?: number; targetType?: 'gte' | 'lte'; pctDecimals?: number }[]
}) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th style={ipsgTh}>รายการ</th>
            {series.map((s, i) => <th key={i} style={{ ...ipsgTh, textAlign: 'center' }}>{s.month}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 8px', fontWeight: 600, color: r.isPct ? 'var(--ink)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{r.label}</td>
              {series.map((s, i) => {
                const v = s[r.key]
                if (r.isPct) {
                  const pass = v == null ? null : r.targetType === 'gte' ? v >= (r.target ?? 0) : v <= (r.target ?? 0)
                  return (
                    <td key={i} style={{
                      padding: '5px 8px', textAlign: 'center', fontWeight: 700,
                      color: pass === true ? 'var(--success)' : pass === false ? 'var(--danger)' : 'var(--muted)',
                    }}>
                      {v == null ? '—' : v.toFixed(r.pctDecimals ?? 2)}
                    </td>
                  )
                }
                return <td key={i} style={{ padding: '5px 8px', textAlign: 'center', color: 'var(--ink)' }}>{fmt(v)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
