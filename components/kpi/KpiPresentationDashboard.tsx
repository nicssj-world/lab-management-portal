'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ResponsiveContainer, ComposedChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { getFiscalMonths, getThaiMonthLabel, isPass } from '@/lib/kpi-utils'
import { getKpiTargetLabel } from '@/lib/kpi/annual-labels'
import { getMonthlyChartTableLayout, getMonthlyXAxisCenterPadding } from '@/lib/kpi/monthly-grid'
import { getChartYMin, summarizeCountSeries } from '@/lib/kpi/presentation-rules'
import { isKpiApplicable } from '@/lib/kpi/presentation-scope'
import { createRequestGuard, type RequestGuard } from '@/lib/kpi/request-guard'
import type { AnnualKpiRow, Department, KpiDefinition } from '@/lib/supabase/types'

interface Props {
  year: number
  deptCode: string | null
}

const MONTHS = getFiscalMonths()
const GREEN = 'var(--success)'
const ORANGE = 'var(--warning)'
const RED = 'var(--danger)'
const BLUE = 'var(--primary)'

// Fine-tuning for specific KPI codes whose typical value range benefits from a
// narrower y-axis or a distinct line color. New KPI codes fall back to LineKpiCard's
// own defaults, so adding a KPI still auto-renders a reasonable chart without this.
const CHART_TUNING: Record<string, { yMin?: number; lineColor?: string }> = {
  TAT_CRITICAL: { yMin: 50 },
  RISK_NEARMISS: { yMin: 70, lineColor: BLUE },
}

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
  const [defs, setDefs] = useState<KpiDefinition[]>([])
  const [scope, setScope] = useState<{ depts: Department[]; exclusions: Set<string> } | null>(null)
  const [loading, setLoading] = useState(true)
  const requestGuard = useRef<RequestGuard | null>(null)
  if (requestGuard.current === null) requestGuard.current = createRequestGuard()

  useEffect(() => {
    Promise.all([
      fetch('/kpi/api/definitions'),
      fetch('/kpi/api/departments'),
      fetch('/kpi/api/config'),
    ])
      .then(async ([definitionRes, deptRes, configRes]) => [await definitionRes.json(), await deptRes.json(), await configRes.json()] as const)
      .then(([d, departments, config]) => {
        if (Array.isArray(d)) setDefs(d)
        if (Array.isArray(departments) && Array.isArray(config?.exclusions)) {
          const visibleDepartments = config?.canViewAll === false && Array.isArray(config?.assignedDeptIds)
            ? departments.filter((department: Department) => config.assignedDeptIds.includes(department.id))
            : departments
          setScope({ depts: visibleDepartments, exclusions: new Set(config.exclusions) })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const request = requestGuard.current!.begin()
    const params = new URLSearchParams({ year: String(year) })
    if (deptCode) params.set('dept', deptCode)
    fetch(`/kpi/api/annual?${params}`, { signal: request.signal })
      .then(r => r.json())
      .then(d => {
        if (requestGuard.current!.isCurrent(request.id) && Array.isArray(d)) setRows(d)
      })
      .catch(() => {})
      .finally(() => {
        if (requestGuard.current!.isCurrent(request.id)) setLoading(false)
      })

    return () => requestGuard.current?.cancel()
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

  const countSummary = (code: string) => {
    const row = byCode(code)
    return summarizeCountSeries(MONTHS.map((month) => ({ num: row?.months[month]?.numerator ?? null })))
  }

  const isApplicable = (code: string) => {
    if (!scope) return true
    return isKpiApplicable(code, deptCode, defs, scope.depts, scope.exclusions)
  }

  // Hero summary: for each KPI, take the most recent month with data and classify pass/fail
  let passCount = 0, failCount = 0
  for (const row of rows) {
    const latestMonth = [...MONTHS].reverse().find((m) => row.months[m]?.numerator !== null)
    const latest = latestMonth != null ? row.months[latestMonth] : undefined
    if (latest?.is_pass === true) passCount++
    else if (latest?.is_pass === false) failCount++
  }
  const totalKpis = rows.length
  const passRate = totalKpis > 0 ? Math.round((passCount / totalKpis) * 100) : 0

  // ── Build cards in KPI definition order ──────────────────────────
  // TAT_UNCROSS / ERR_REPORT / the IPSG1 trio get bespoke visualizations (bar+badge,
  // gauge, combined pie) that can't be auto-generated. Every other KPI — including any
  // new one added via Settings — renders automatically: a trend line if it has a
  // denominator (percentage KPI), or a zero-incident badge if it's count-only.
  const orderedCodes = defs.length > 0 ? defs.map(d => d.code) : rows.map(r => r.kpi_code)
  const cards: React.ReactNode[] = []
  let zeroBuf: AnnualKpiRow[] = []
  let ipsgDone = false

  const flushZero = () => {
    if (zeroBuf.length === 0) return
    cards.push(
      <div key={`zerogrid-${zeroBuf[0].kpi_code}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {zeroBuf.map(r => {
          const summary = countSummary(r.kpi_code)
          return (
            <ZeroIncidentCard
              key={r.kpi_code}
              title={r.kpi_name}
              total={summary.total}
              monthsWithData={summary.monthsWithData}
              targetType={r.target_type}
              targetVal={r.target_val}
              unit={r.unit}
            />
          )
        })}
      </div>
    )
    zeroBuf = []
  }

  for (const code of orderedCodes) {
    if (code === 'TAT_UNCROSS') {
      const definition = defs.find((def) => def.code === code)
      if (definition && definition.denominator !== null) {
        if (!isApplicable(code)) continue
        flushZero()
        cards.push(
          <UncrossCard
            key={code}
            series={monthSeries(code)}
            target={definition.target_val}
            targetType={definition.target_type}
            unit={definition.unit}
          />,
        )
        continue
      }
    }
    if (code === 'ERR_REPORT') {
      const definition = defs.find((def) => def.code === code)
      if (definition && definition.denominator !== null) {
        if (!isApplicable(code)) continue
        flushZero()
        cards.push(<ErrorRateCard key={code} series={monthSeries(code)} target={definition.target_val} targetType={definition.target_type} />)
        continue
      }
    }
    if (code === 'RISK_ID_OPD' || code === 'RISK_ID_WARD' || code === 'RISK_STICKER') {
      const ipsgDefinitions = ['RISK_ID_OPD', 'RISK_ID_WARD', 'RISK_STICKER']
        .map((ipsgCode) => defs.find((def) => def.code === ipsgCode))
      const canUseCountCard = ipsgDefinitions.every((definition) => definition?.denominator === null)
      if (canUseCountCard) {
        if (ipsgDone) continue
        ipsgDone = true
        if (!ipsgDefinitions.some((definition) => definition && isApplicable(definition.code))) continue
        flushZero()
        const defaultCountRule = { target_type: 'eq' as const, target_val: 0, unit: 'ครั้ง' }
        cards.push(
          <IpsgCard
            key="ipsg"
            opd={countSummary('RISK_ID_OPD').total} ward={countSummary('RISK_ID_WARD').total} sticker={countSummary('RISK_STICKER').total}
            opdSeries={monthSeries('RISK_ID_OPD')} wardSeries={monthSeries('RISK_ID_WARD')} stickerSeries={monthSeries('RISK_STICKER')}
            opdRule={ipsgDefinitions[0] ?? defaultCountRule}
            wardRule={ipsgDefinitions[1] ?? defaultCountRule}
            stickerRule={ipsgDefinitions[2] ?? defaultCountRule}
          />
        )
        continue
      }
    }

    const row = byCode(code)
    if (!row) continue // no data for this dept/year filter
    const hasDenominator = row.denominator_label !== null
    if (hasDenominator) {
      flushZero()
      const tuning = CHART_TUNING[code]
      cards.push(
        <LineKpiCard
          key={code} title={row.kpi_name} target={row.target_val} targetType={row.target_type} unit={row.unit}
          series={monthSeries(code)} yMin={tuning?.yMin} lineColor={tuning?.lineColor}
        />
      )
    } else {
      zeroBuf.push(row)
    }
  }
  flushZero()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero summary row — latest month snapshot */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label="ตัวชี้วัดทั้งหมด" value={totalKpis} icon="chart" color="blue" />
        <Stat label="ผ่านเป้าหมาย" value={passCount} icon="shieldCheck" color="green" />
        <Stat label="ไม่ผ่านเป้าหมาย" value={failCount} icon="alert" color="red" />
        <Stat label="อัตราผ่านล่าสุด" value={`${passRate}%`} icon="trending" color={passRate >= 80 ? 'green' : passRate >= 50 ? 'amber' : 'red'} />
      </div>

      {cards}
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
function LineKpiCard({ title, target, targetType, unit, series, yMin = 80, lineColor = GREEN }: {
  title: string
  target: number
  targetType: 'gte' | 'lte' | 'eq'
  unit?: string | null
  series: { month: string; num: number | null; den: number | null; pct: number | null }[]
  yMin?: number
  lineColor?: string
}) {
  const hasData = series.some(s => s.pct != null)
  const trend = linearTrend(series.map(s => s.pct))
  const chartData = series.map((s, i) => ({ month: s.month, pct: s.pct, trend: trend[i] }))
  const targetLabel = getKpiTargetLabel({ target_type: targetType, target_val: target, unit })
  const chartYMin = getChartYMin(target, series.flatMap((point) => point.pct == null ? [] : [point.pct]), yMin)
  const monthlyLayout = getMonthlyChartTableLayout(series.length)
  const [chartWidth, setChartWidth] = useState(0)
  const xAxisPadding = getMonthlyXAxisCenterPadding(chartWidth, monthlyLayout)

  return (
    <Card padding={20}>
      <CardHeader title={title} target={targetLabel} />
      {!hasData ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูลสำหรับแผนกนี้</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: monthlyLayout.minimumContentWidth }}>
            <ResponsiveContainer width="100%" height={220} onResize={(width) => setChartWidth(previous => previous === width ? previous : width)}>
              <ComposedChart data={chartData} margin={{ top: 10, right: monthlyLayout.chartRightGutter, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" padding={{ left: xAxisPadding, right: xAxisPadding }} tick={false} tickLine={false} axisLine={false} height={4} />
              <YAxis domain={[chartYMin, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} unit={unit ?? '%'} width={monthlyLayout.labelColumnWidth} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [`${v}${unit ?? '%'}`, name === 'pct' ? 'ผลงาน' : 'แนวโน้ม']}
              />
              <ReferenceLine y={target} stroke={ORANGE} strokeWidth={2} label={{ value: `Target ${targetLabel}`, fill: ORANGE, fontSize: 10, position: 'right' }} />
              <Line type="monotone" dataKey="pct" name="pct" stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, fill: lineColor }} connectNulls />
              <Line type="linear" dataKey="trend" name="trend" stroke={RED} strokeWidth={1.5} strokeDasharray="6 4" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <MiniTable
              series={series}
              alignWithChart
              rows={[
                { label: 'ทันเวลา', key: 'num' },
                { label: 'ทั้งหมด', key: 'den' },
                { label: 'ร้อยละ', key: 'pct', isPct: true, target, targetType },
              ]}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

// ── Uncrossmatch (bar count + 100%) ──────────────────────────────
function UncrossCard({ series, target, targetType, unit }: {
  series: { month: string; num: number | null; den: number | null; pct: number | null }[]
  target: number
  targetType: 'gte' | 'lte' | 'eq'
  unit?: string | null
}) {
  const hasData = series.some(s => s.num != null || s.den != null || s.pct != null)
  const chartData = series.map(s => ({ month: s.month, count: s.num ?? 0 }))
  const monthlyLayout = getMonthlyChartTableLayout(series.length)
  const [chartWidth, setChartWidth] = useState(0)
  const xAxisPadding = getMonthlyXAxisCenterPadding(chartWidth, monthlyLayout)
  const dataMonths = series.filter((point) => point.num != null || point.den != null || point.pct != null)
  const allPass = dataMonths.length > 0 && dataMonths.every(
    (point) => isPass(point.pct, targetType, target) === true,
  )

  return (
    <Card padding={20}>
      <CardHeader title="TAT — Uncrossmatch (เตรียม/จ่ายเลือด)" target={getKpiTargetLabel({ target_type: targetType, target_val: target, unit })} />
      {!hasData ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูลสำหรับแผนกนี้</div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: monthlyLayout.minimumContentWidth }}>
              <ResponsiveContainer width="100%" height={220} onResize={(width) => setChartWidth(previous => previous === width ? previous : width)}>
                <BarChart data={chartData} margin={{ top: 16, right: monthlyLayout.chartRightGutter, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" padding={{ left: xAxisPadding, right: xAxisPadding }} tick={false} tickLine={false} axisLine={false} height={4} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={monthlyLayout.labelColumnWidth} />
                  <Tooltip cursor={false} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} ครั้ง`, 'จำนวน']} />
                  <Bar dataKey="count" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                <Icon name="check" size={14} stroke={3} />
                {allPass ? `ผ่านเป้าหมาย ${getKpiTargetLabel({ target_type: targetType, target_val: target, unit })} ทุกเดือนที่มีข้อมูล` : 'ผลรายเดือนแสดงในตารางด้านล่าง'}
              </div>
              <MiniTable
                series={series}
                alignWithChart
                rows={[
                  { label: 'ทันเวลา', key: 'num' },
                  { label: 'ทั้งหมด', key: 'den' },
                  { label: 'ร้อยละ', key: 'pct', isPct: true, target, targetType },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </Card>
  )
}

// ── Zero-incident card ───────────────────────────────────────────
function ZeroIncidentCard({ title, total, monthsWithData, targetType, targetVal, unit }: {
  title: string
  total: number
  monthsWithData: number
  targetType: 'gte' | 'lte' | 'eq'
  targetVal: number
  unit?: string | null
}) {
  const noData = monthsWithData === 0
  const incomplete = monthsWithData > 0 && monthsWithData < MONTHS.length
  const pass = !noData && !incomplete
    ? isPass(null, targetType, targetVal, total, true)
    : null
  const color = noData ? 'var(--muted)' : incomplete ? 'var(--warning)' : pass === true ? 'var(--success)' : 'var(--danger)'
  const targetLabel = getKpiTargetLabel({ target_type: targetType, target_val: targetVal, unit: unit ?? 'ครั้ง' })
  return (
    <Card padding={24}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Icon name={noData ? 'chart' : pass === true ? 'shieldCheck' : 'alert'} size={16} style={{ color }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
      </div>
      <div style={{
        border: `2px solid ${color}`, borderRadius: 12,
        padding: '28px 16px', textAlign: 'center',
        background: noData ? 'var(--surface-2)' : incomplete ? 'rgba(217,119,6,.06)' : pass === true ? 'rgba(22,163,74,.06)' : 'rgba(220,38,38,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 38, fontWeight: 800, color, lineHeight: 1 }}>{noData ? '—' : total}</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--muted)' }}>INCIDENTS</span>
          <Icon name={noData ? 'chart' : pass === true ? 'check' : 'x'} size={32} stroke={3} style={{ color }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 12.5, color, fontWeight: 600 }}>
          {noData
            ? 'ไม่มีข้อมูลสำหรับแผนกนี้'
            : incomplete
              ? 'ข้อมูลยังไม่ครบทุกเดือน'
              : pass === true
                ? `ผ่านเป้าหมาย ${targetLabel}`
                : `ไม่ผ่านเป้าหมาย ${targetLabel} (ผล ${total})`}
        </div>
      </div>
    </Card>
  )
}

// ── Error rate card (gauge + summary) ────────────────────────────
function ErrorRateCard({ series, target, targetType }: { series: { month: string; num: number | null; den: number | null; pct: number | null }[]; target: number; targetType: 'gte' | 'lte' | 'eq' }) {
  const totalErr = series.reduce((s, m) => s + (m.num ?? 0), 0)
  const totalDen = series.reduce((s, m) => s + (m.den ?? 0), 0)
  const hasIncompleteRateData = series.some((month) =>
    (month.num != null && (month.den == null || month.den < 0 || (month.den === 0 && month.num !== 0))) ||
    (month.den != null && month.num == null),
  )
  const hasRateData = series.some((month) =>
    month.num != null && month.den != null && month.den >= 0 && !(month.den === 0 && month.num !== 0),
  ) && !hasIncompleteRateData
  const rate = hasRateData
    ? totalDen === 0
      ? totalErr === 0 ? 0 : null
      : Math.round((totalErr / totalDen) * 100 * 1000) / 1000
    : null
  const accuracy = rate === null ? null : Math.round((100 - rate) * 1000) / 1000
  const pass = rate === null ? null : isPass(rate, targetType, target)

  // Gauge geometry (semicircle), scale 0 .. 0.1 (target 0.05 at midpoint)
  const max = 0.1
  const cx = 110, cy = 100, r = 88
  const valFrac = Math.min((rate ?? 0) / max, 1)
  const tgtFrac = Math.min(Math.max(target / max, 0), 1)
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
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ORANGE, marginBottom: 12 }}>Target : {getKpiTargetLabel({ target_type: targetType, target_val: target, unit: '%' })}</div>

      {!hasRateData ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          {hasIncompleteRateData ? 'ข้อมูลยังไม่ครบทุกเดือน จึงยังคำนวณอัตราความคลาดเคลื่อนไม่ได้' : 'ไม่มีข้อมูลตัวหารสำหรับคำนวณอัตราความคลาดเคลื่อน'}
        </div>
      ) : <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
        {/* Gauge */}
        <svg width={220} height={130} viewBox="0 0 220 130">
          <path d={arc(0, tgtFrac, r)} fill="none" stroke={GREEN} strokeWidth={20} strokeLinecap="round" />
          <path d={arc(tgtFrac, 1, r)} fill="none" stroke={RED} strokeWidth={20} strokeLinecap="round" />
          <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="var(--ink)" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="var(--ink)" />
          <text x={polar(tgtFrac, r + 16).x} y={polar(tgtFrac, r + 16).y} fontSize={11} fill={RED} textAnchor="middle">{target}</text>
          <text x={cx} y={cy + 22} fontSize={15} fontWeight={700} fill={pass ? GREEN : RED} textAnchor="middle">{rate?.toFixed(3)}%</text>
        </svg>

        {/* Summary */}
        <div style={{ minWidth: 180 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>คลาดเคลื่อนรวมทั้งปี</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)' }}>{totalErr} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>ครั้ง</span></div>
          <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, background: 'rgba(22,163,74,.1)', display: 'inline-block' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: pass ? 'var(--success)' : 'var(--danger)' }}>Accuracy Rate = {accuracy?.toFixed(3)}%</span>
          </div>
        </div>
      </div>}

      <MiniTable
        series={series}
        rows={[
          { label: 'คลาดเคลื่อน (ครั้ง)', key: 'num' },
          { label: 'ส่งตรวจทั้งหมด', key: 'den' },
          { label: 'ร้อยละ', key: 'pct', isPct: true, target, targetType, pctDecimals: 3 },
        ]}
      />
    </Card>
  )
}

// ── IPSG1 pie + table ────────────────────────────────────────────
type CountKpiRule = Pick<KpiDefinition, 'target_type' | 'target_val' | 'unit'>

function IpsgCard({ opd, ward, sticker, opdSeries, wardSeries, stickerSeries, opdRule, wardRule, stickerRule }: {
  opd: number; ward: number; sticker: number
  opdSeries: { month: string; num: number | null }[]
  wardSeries: { month: string; num: number | null }[]
  stickerSeries: { month: string; num: number | null }[]
  opdRule: CountKpiRule
  wardRule: CountKpiRule
  stickerRule: CountKpiRule
}) {
  const metricSeries = [opdSeries, wardSeries, stickerSeries]
  const metricRules = [opdRule, wardRule, stickerRule]
  const monthsWithData = MONTHS.filter((month, index) => metricSeries.some((series) => series[index]?.num != null)).length
  const hasData = monthsWithData > 0
  const completeMetrics = metricSeries.every((series) => MONTHS.every((_, index) => series[index]?.num != null))
  const metricPasses = [opd, ward, sticker].map((total, index) => {
    if (!completeMetrics) return null
    const rule = metricRules[index]
    return isPass(null, rule.target_type, rule.target_val, total, true)
  })
  const overallPass = !hasData
    ? null
    : metricPasses.every((pass) => pass === true)
      ? true
      : metricPasses.some((pass) => pass === false)
        ? false
        : null
  const targetLabels = metricRules.map((rule) => getKpiTargetLabel(rule))
  const targetLabel = targetLabels.every((label) => label === targetLabels[0]) ? targetLabels[0] : 'ตาม Settings'
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
      <div style={{ fontSize: 12.5, fontWeight: 600, color: ORANGE, marginBottom: 12 }}>Target : {targetLabel} · รวมทั้งปี {hasData ? total : '—'} ครั้ง</div>

      {!hasData ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14, fontWeight: 600 }}>ไม่มีข้อมูลสำหรับแผนกนี้</div>
      ) : overallPass === null ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--warning)', fontSize: 14, fontWeight: 600 }}>ข้อมูลยังไม่ครบทุกเดือน</div>
      ) : overallPass === true ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>ผ่านเป้าหมาย ✓</div>
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
              { label: 'OPD', s: opdSeries, t: opd, rule: opdRule, pass: metricPasses[0] },
              { label: 'Ward', s: wardSeries, t: ward, rule: wardRule, pass: metricPasses[1] },
              { label: 'Sticker', s: stickerSeries, t: sticker, rule: stickerRule, pass: metricPasses[2] },
            ].map(r => (
              <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{r.label}</td>
                {r.s.map((c, i) => {
                  const cellPass = c.num == null
                    ? null
                    : isPass(null, r.rule.target_type, r.rule.target_val, c.num, true)
                  return (
                    <td key={i} style={{
                      padding: '5px 8px', textAlign: 'center',
                      color: cellPass === true ? 'var(--success)' : cellPass === false ? 'var(--danger)' : 'var(--muted)',
                    }}>{c.num ?? '—'}</td>
                  )
                })}
                <td style={{
                  padding: '5px 8px', textAlign: 'center', fontWeight: 700,
                  color: r.pass === true ? 'var(--success)' : r.pass === false ? 'var(--danger)' : 'var(--muted)',
                }}>{hasData ? r.t : '—'}</td>
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
function MiniTable({ series, rows, alignWithChart = false }: {
  series: { month: string; num: number | null; den: number | null; pct: number | null }[]
  rows: { label: string; key: 'num' | 'den' | 'pct'; isPct?: boolean; target?: number; targetType?: 'gte' | 'lte' | 'eq'; pctDecimals?: number }[]
  alignWithChart?: boolean
}) {
  const monthlyLayout = alignWithChart ? getMonthlyChartTableLayout(series.length) : null

  return (
    <div style={{ overflowX: alignWithChart ? 'visible' : 'auto', marginTop: 12 }}>
      <table style={{ width: monthlyLayout?.tableWidth ?? '100%', tableLayout: monthlyLayout ? 'fixed' : 'auto', borderCollapse: 'collapse', fontSize: 11.5 }}>
        {monthlyLayout && (
          <colgroup>
            {monthlyLayout.columns.map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
        )}
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
                  const pass = v == null || r.targetType == null
                    ? null
                    : isPass(v, r.targetType, r.target ?? 0)
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
