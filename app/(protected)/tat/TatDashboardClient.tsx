'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { getPreviousThaiFiscalMonth, getThaiFiscalYearForMonth, getThaiMonthLabel } from '@/lib/kpi-utils'

interface KpiData {
  avg_tat: number
  median_tat: number
  pct_within_target: number
  total_count: number
  sample_count: number
  blood_sample_count?: number
  target_count?: number
  target_coverage_pct?: number
  busiest_hour: string
  avg_phleb_wait: number
  pipeline_avg_phleb_wait?: number
  pipeline_avg_phleb_draw?: number
  avg_transport: number
  avg_total_tat: number
  median_total_tat: number
  avg_total_tat_cut_720?: number
  median_total_tat_cut_720?: number
  total_tat_cut_720_count?: number
  total_tat_outlier_720_count?: number
  phleb_match_rate: number
  pct_total_within_target: number
  pct_phleb_within_target: number
}
interface LabRow { lab_section: string; avg_tat: number; count: number }
interface DistRow { bin: string; count: number; cumulative_pct: number }
interface HeatCell { dow: number; hour: number; count: number }
interface TrendRow { year: number; month: number; avg_tat: number; pct_within_target: number }
interface MatchBreakdown { exact: number; ambiguous: number; no_match: number }
interface StageRow { stage: string; avg_minutes: number }
interface LabzoneRow { labzone_name: string; count: number; avg_wait: number }
interface LabzonePhleb { labzone_name: string; count: number }
interface FilterOptions { lab_sections: string[]; wards: string[]; test_names: string[]; labzone_names: string[]; phleb_labzone_names: string[] }

interface SummaryData {
  has_phleb_data: boolean
  hn_null_count: number
  phleb_record_count: number
  phleb_hn_count: number
  kpi: KpiData
  match_breakdown: MatchBreakdown
  stage_breakdown: StageRow[]
  by_labzone: LabzoneRow[]
  by_labzone_phleb: LabzonePhleb[]
  by_lab_section: LabRow[]
  tat_distribution: DistRow[]
  heatmap: HeatCell[]
  phleb_heatmap: HeatCell[]
  trend: TrendRow[]
  filter_options: FilterOptions
}
type SummaryView = 'overview' | 'phlebotomy' | 'lab'

const DOW_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const HIDDEN_ZONES = new Set(['ช่อง 21', 'ช่อง 2', 'ช่อง 5', 'ช่อง 7', 'ช่อง 3', 'ช่อง 8', 'ช่อง 9'])
const CAR_BED_LABZONE = 'ช่องรถนั่ง-นอน'
const CAR_BED_SOURCE_ZONES = ['ช่อง 10', 'ช่อง 11']
const PHLEB_ALLOWED_LABZONES = [
  'ห้องปฏิบัติการ ชั้น G',
  'ห้องปฏิบัติการ เมือง',
  'ห้องปฏิบัติการ นอกรพ.Central',
  'ห้องปฏิบัติการ สูติ-นรีเวชกรรม',
  'ห้องเจาะเลือด ชั้น 3',
  CAR_BED_LABZONE,
]
const LABZONE_DISPLAY: Record<string, string> = {}
const MATCH_COLORS: Record<string, string> = {
  'จับคู่แน่นอน': '#16A34A',
  'จับคู่ไม่แน่นอน': '#D97706',
  'ไม่พบคู่': '#CBD5E1',
}

function displayLabzone(name: string) { return LABZONE_DISPLAY[name] ?? name }
function toPhlebLabzoneOptions(names: string[]) {
  const sourceSet = new Set(names)
  return PHLEB_ALLOWED_LABZONES.filter(name =>
    name === CAR_BED_LABZONE
      ? CAR_BED_SOURCE_ZONES.some(z => sourceSet.has(z))
      : sourceSet.has(name)
  )
}

function aggregatePhlebLabzones(rows: LabzonePhleb[]) {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const key = CAR_BED_SOURCE_ZONES.includes(row.labzone_name)
      ? CAR_BED_LABZONE
      : row.labzone_name
    counts.set(key, (counts.get(key) ?? 0) + row.count)
  }

  return PHLEB_ALLOWED_LABZONES
    .map(labzone_name => ({ labzone_name, count: counts.get(labzone_name) ?? 0 }))
    .filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count)
}

function formatTrendLabel(year: number, month: number) {
  return `${getThaiMonthLabel(month)} ${String(getThaiFiscalYearForMonth(year, month)).slice(2)}`
}

function formatDuration(minutes: number) {
  if (!minutes) return '—'
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h} hr ${m} min`
  if (h > 0) return `${h} hr`
  return `${m} min`
}

// ── Design Components ─────────────────────────────────────────────────────

function KpiRingStat({ label, pct, avgValue, avgUnit, color }: {
  label: string; pct: number; avgValue?: number; avgUnit?: string; color: string
}) {
  const r = 32
  const circ = 2 * Math.PI * r
  const safePct = Number.isFinite(pct) ? pct : 0
  const clamped = Math.max(0, Math.min(100, safePct))
  const offset = circ * (1 - clamped / 100)
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12, lineHeight: 1.5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width={80} height={80} style={{ flexShrink: 0 }}>
          <circle cx={40} cy={40} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={7} />
          <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeDasharray={`${circ}`} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)' }}
          />
          <text x={40} y={44} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>{clamped}%</text>
        </svg>
        {avgValue != null && (
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-0.02em' }}>{avgValue}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{avgUnit ?? ''}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiBigStat({ label, value, sub, iconBg, icon }: {
  label: string; value: string | number; sub?: string; iconBg?: string; icon?: string
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', lineHeight: 1.5, maxWidth: '78%' }}>
          {label}
        </div>
        {icon && iconBg && (
          <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={icon} size={14} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ title, subtitle, accentColor = 'var(--primary)', children, style }: {
  title: string; subtitle?: string; accentColor?: string; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', ...style }}>
      <div style={{
        padding: '13px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        borderLeft: `3px solid ${accentColor}`,
      }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function PipelineViz({ stages, total }: { stages: StageRow[]; total: number }) {
  const STAGE_CFG = [
    { key: 'รอเจาะเลือด',    color: '#1E5FAD', label: 'รอเจาะเลือด' },
    { key: 'เจาะเลือด',      color: '#9333EA', label: 'เจาะเลือด' },
    { key: 'ขนส่งตัวอย่าง', color: '#D97706', label: 'ขนส่งตัวอย่าง' },
    { key: 'วิเคราะห์ในแลป', color: '#16A34A', label: 'วิเคราะห์ในแลป' },
  ]
  const values = STAGE_CFG.map(s => stages.find(r => r.stage === s.key)?.avg_minutes ?? 0)
  const sumVals = values.reduce((a, b) => a + b, 0)

  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
        ลงทะเบียน → ยืนยันคิว → เจาะเสร็จ → รับ specimen → รายงานผล
      </div>
      <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', gap: 2, marginBottom: 14, background: 'var(--surface-2)' }}>
        {values.map((val, i) => (
          <div key={i} style={{
            flex: sumVals > 0 ? val : 1,
            background: STAGE_CFG[i].color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9.5, color: '#fff', fontWeight: 700,
            minWidth: val > 0 ? 30 : 0,
            transition: 'flex 1.2s ease',
          }}>
            {sumVals > 0 && val > 0 ? `${Math.round(val / sumVals * 100)}%` : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {STAGE_CFG.map((s, i) => (
          <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', borderLeft: `3px solid ${s.color}` }}>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>{s.label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
              {formatDuration(values[i])}
            </div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <div style={{ marginTop: 10, padding: '9px 14px', borderRadius: 8, background: 'rgba(30,95,173,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Total TAT เฉลี่ยต่อ LN</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--primary)' }}>{formatDuration(total)}</span>
        </div>
      )}
    </div>
  )
}

function LabTatPipeline({ avgTat }: { avgTat: number }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8 }}>
        รับ specimen → รายงานผล
      </div>
      <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: 'var(--surface-2)' }}>
        <div style={{
          flex: 1,
          background: '#16A34A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9.5,
          color: '#fff',
          fontWeight: 700,
        }}>
          วิเคราะห์ในแลป
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg)', borderLeft: '3px solid #16A34A' }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 3 }}>รับ specimen → รายงานผล</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
            {formatDuration(avgTat)}
          </div>
        </div>
      </div>
    </div>
  )
}

function TatHeatmap({ cells, tooltipLabel = 'ตัวอย่าง' }: { cells: HeatCell[]; tooltipLabel?: string }) {
  const grid = new Map<string, number>()
  let maxCount = 0
  for (const c of cells) {
    const key = `${c.dow}-${c.hour}`
    grid.set(key, c.count)
    if (c.count > maxCount) maxCount = c.count
  }

  function getCellBg(count: number) {
    if (count === 0 || maxCount === 0) return 'var(--surface-2)'
    const t = count / maxCount
    const r = Math.round(219 + (30 - 219) * t)
    const g = Math.round(234 + (95 - 234) * t)
    const b = Math.round(254 + (173 - 254) * t)
    return `rgb(${r},${g},${b})`
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 2, minWidth: 280 }}>
        <div />
        {DOW_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, paddingBottom: 3 }}>{d}</div>
        ))}
        {Array.from({ length: 24 }, (_, hour) => (
          <React.Fragment key={hour}>
            <div style={{ fontSize: 9.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
              {String(hour).padStart(2, '0')}
            </div>
            {Array.from({ length: 7 }, (_, dow) => {
              const count = grid.get(`${dow}-${hour}`) ?? 0
              return (
                <div
                  key={`${dow}-${hour}`}
                  title={count > 0 ? `${DOW_LABELS[dow]} ${String(hour).padStart(2, '0')}:00 — ${count} ${tooltipLabel}` : undefined}
                  style={{ background: getCellBg(count), border: '1px solid var(--border)', borderRadius: 2, height: 14 }}
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>น้อย</span>
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const r = Math.round(219 + (30 - 219) * t)
          const g = Math.round(234 + (95 - 234) * t)
          const b = Math.round(254 + (173 - 254) * t)
          return (
            <div key={t} style={{
              width: 14, height: 14, borderRadius: 2,
              border: t === 0 ? '1px solid var(--border)' : 'none',
              background: t === 0 ? 'var(--surface-2)' : `rgb(${r},${g},${b})`,
            }} />
          )
        })}
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>มาก</span>
      </div>
    </div>
  )
}

// ── Filter Select ─────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          padding: '6px 28px 6px 11px', borderRadius: 8,
          border: value ? '1.5px solid var(--primary)' : '1px solid var(--border)',
          fontSize: 12.5, fontFamily: 'inherit',
          background: value ? 'rgba(30,95,173,.05)' : 'var(--card)',
          color: value ? 'var(--primary)' : 'var(--ink)',
          cursor: 'pointer', minWidth: 130,
          fontWeight: value ? 600 : 400,
          outline: 'none', transition: 'border-color .15s, background .15s',
        }}
      >
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        width={11} height={11} viewBox="0 0 12 12">
        <path d="M2 4l4 4 4-4" stroke={value ? '#1E5FAD' : '#64748B'} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'phlebotomy' | 'lab'
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',   label: 'ภาพรวม',            icon: 'chart'   },
  { id: 'phlebotomy', label: 'TAT Phlebotomy',     icon: 'syringe' },
  { id: 'lab',        label: 'TAT ห้องปฏิบัติการ', icon: 'beaker'  },
]

// ── Main ──────────────────────────────────────────────────────────────────

const TAT_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000

function readTatClientCache(key: string): SummaryData | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { expiresAt: number; data: SummaryData }
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeTatClientCache(key: string, data: SummaryData) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      expiresAt: Date.now() + TAT_CLIENT_CACHE_TTL_MS,
      data,
    }))
  } catch {}
}

export function TatDashboardClient({ canEdit }: { canEdit: boolean }) {
  const defaultMonth = getPreviousThaiFiscalMonth()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [fiscalYear, setFiscalYear] = useState(defaultMonth.fiscalYear)
  const [month, setMonth]           = useState(defaultMonth.month)
  const [labSection, setLabSection] = useState('')
  const [ward, setWard]           = useState('')
  const [priority, setPriority]   = useState('')
  const [testName, setTestName]   = useState('')
  const [labzone, setLabzone]     = useState('')
  const [allLabzones, setAllLabzones] = useState<string[]>([])

  const gregorianYear = month >= 10 ? fiscalYear - 543 - 1 : fiscalYear - 543

  const [data, setData]     = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [urgentLabTrend, setUrgentLabTrend] = useState<TrendRow[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (
    view: SummaryView, y: number, m: number, ls: string, w: string, p: string, tn: string, lz: string
  ) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let usedCache = false
    try {
      const params = new URLSearchParams({ year: String(y), month: String(m) })
      params.set('view', view)
      if (ls) params.set('lab_section', ls)
      if (w)  params.set('ward', w)
      if (p)  params.set('priority', p)
      if (tn) params.set('test_name', tn)
      if (lz) params.set('labzone_name', lz)
      const cacheKey = `tat-summary:v5:${params.toString()}`
      const cached = readTatClientCache(cacheKey)
      if (cached) {
        usedCache = true
        setData(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }
      const res = await fetch(`/api/admin/tat/summary?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json() as SummaryData
      writeTatClientCache(cacheKey, json)
      setData(json)
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && !usedCache) setData(null)
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }, [])

  const requestView: SummaryView =
    activeTab === 'lab' && (labSection || ward || priority || testName) ? 'lab' :
    activeTab === 'phlebotomy' && labzone ? 'phlebotomy' :
    'overview'

  useEffect(() => {
    fetchData(requestView, gregorianYear, month, labSection, ward, priority, testName, labzone)
  }, [requestView, gregorianYear, month, labSection, ward, priority, testName, labzone, fetchData])

  useEffect(() => {
    if (activeTab !== 'overview') {
      setUrgentLabTrend([])
      return
    }

    const ctrl = new AbortController()
    const params = new URLSearchParams({ year: String(gregorianYear), month: String(month), priority: 'ด่วน' })
    params.set('view', 'overview')
    if (labSection) params.set('lab_section', labSection)
    if (ward) params.set('ward', ward)
    if (testName) params.set('test_name', testName)

    fetch(`/api/admin/tat/summary?${params}`, { signal: ctrl.signal })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text())
        return res.json() as Promise<SummaryData>
      })
      .then(json => setUrgentLabTrend(json.trend ?? []))
      .catch(err => {
        if ((err as Error).name !== 'AbortError') setUrgentLabTrend([])
      })

    return () => ctrl.abort()
  }, [activeTab, gregorianYear, month, labSection, ward, testName])

  useEffect(() => {
    if (data && !labzone) {
      const src = activeTab === 'phlebotomy'
        ? (data.filter_options?.phleb_labzone_names ?? [])
        : (data.filter_options?.labzone_names ?? [])
      setAllLabzones(activeTab === 'phlebotomy'
        ? toPhlebLabzoneOptions(src)
        : src.filter(lz => !HIDDEN_ZONES.has(lz))
      )
    }
  }, [data, labzone, activeTab])

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    setAllLabzones([])
    if (tab === 'phlebotomy') { setLabSection(''); setWard(''); setPriority(''); setTestName('') }
    else if (tab === 'lab')   { setLabzone('') }
    else                      { setWard(''); setTestName('') }
  }

  const handleLabSectionChange = (value: string) => {
    setLabSection(value)
    setTestName('')
    setData(null)
    setAllLabzones([])
    setLoading(true)
  }

  const handleWardChange = (value: string) => {
    setWard(value)
    setTestName('')
    setData(null)
    setLoading(true)
  }

  const kpi     = data?.kpi
  const isEmpty = !loading && (kpi?.total_count ?? 0) === 0
  const hasPhleb = !loading && (data?.has_phleb_data ?? false)
  const canShowPhlebOnly = activeTab === 'phlebotomy' && hasPhleb
  const currentFiscalYear = getThaiFiscalYearForMonth(new Date().getFullYear(), new Date().getMonth() + 1)
  const yearOptions = [currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2]

  const labzoneOptions = allLabzones.length > 0
    ? allLabzones
    : activeTab === 'phlebotomy'
      ? toPhlebLabzoneOptions(data?.filter_options?.phleb_labzone_names ?? [])
      : (data?.filter_options?.labzone_names ?? []).filter(lz => !HIDDEN_ZONES.has(lz))

  const labzoneData = (data?.by_labzone ?? []).filter(r => !HIDDEN_ZONES.has(r.labzone_name))
  const phlebLabzoneData = aggregatePhlebLabzones(data?.by_labzone_phleb ?? [])

  const stageBarData = data?.stage_breakdown
    ? [{
        name: 'Pipeline',
        'รอเจาะเลือด':   data.stage_breakdown.find(s => s.stage === 'รอเจาะเลือด')?.avg_minutes   ?? 0,
        'เจาะเลือด':     data.stage_breakdown.find(s => s.stage === 'เจาะเลือด')?.avg_minutes     ?? 0,
        'ขนส่งตัวอย่าง': data.stage_breakdown.find(s => s.stage === 'ขนส่งตัวอย่าง')?.avg_minutes ?? 0,
        'วิเคราะห์ในแลป':data.stage_breakdown.find(s => s.stage === 'วิเคราะห์ในแลป')?.avg_minutes ?? 0,
      }]
    : []
  const totalStageMin = stageBarData[0]
    ? stageBarData[0]['รอเจาะเลือด'] + stageBarData[0]['เจาะเลือด'] + stageBarData[0]['ขนส่งตัวอย่าง'] + stageBarData[0]['วิเคราะห์ในแลป']
    : 0

  const mb = data?.match_breakdown
  const matchedBloodSamples = mb ? mb.exact + mb.ambiguous : 0
  const overviewHasTotalTat = (kpi?.avg_total_tat ?? 0) > 0
  const overviewAvgTatAll = overviewHasTotalTat ? (kpi?.avg_total_tat ?? 0) : (kpi?.avg_tat ?? 0)
  const overviewMedianTatAll = overviewHasTotalTat ? (kpi?.median_total_tat ?? 0) : (kpi?.median_tat ?? 0)
  const overviewAvgTatCut = kpi?.avg_total_tat_cut_720 ?? overviewAvgTatAll
  const overviewMedianTatCut = kpi?.median_total_tat_cut_720 ?? overviewMedianTatAll
  const totalTatCutCount = kpi?.total_tat_cut_720_count ?? matchedBloodSamples
  const totalTatOutlierCount = kpi?.total_tat_outlier_720_count ?? 0
  const overviewPctWithinTarget = overviewHasTotalTat ? (kpi?.pct_total_within_target ?? 0) : (kpi?.pct_within_target ?? 0)
  const overviewTatLabel = overviewHasTotalTat ? 'Total TAT เฉลี่ย' : 'TAT เฉลี่ย (รับ specimen → รายงานผล)'
  const showPhlebPipeline = overviewHasTotalTat && matchedBloodSamples > 0
  const matchPieData = mb
    ? [
        { name: 'จับคู่แน่นอน',   value: mb.exact },
        { name: 'จับคู่ไม่แน่นอน', value: mb.ambiguous },
        { name: 'ไม่พบคู่',        value: mb.no_match },
      ]
    : []

  const sectionData   = data?.by_lab_section ?? []
  const sectionMedIdx = Math.floor(sectionData.length / 2)
  const sectionMedian = [...sectionData.map(s => s.avg_tat)].sort((a, b) => a - b)[sectionMedIdx] ?? 0

  const hasActiveFilter =
    activeTab === 'phlebotomy' ? !!labzone :
    activeTab === 'lab'        ? !!(labSection || ward || priority || testName) :
                                 !!(labSection || priority || labzone)

  const clearFilters = () => {
    if (activeTab === 'phlebotomy')   { setLabzone('') }
    else if (activeTab === 'lab')     { setLabSection(''); setWard(''); setPriority(''); setTestName('') }
    else                              { setLabSection(''); setPriority(''); setLabzone('') }
  }

  const activeFilterCount = [labSection, ward, priority, testName, labzone].filter(Boolean).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        @keyframes tatFadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .tat-panel { animation: tatFadeIn .22s ease both; }
        @keyframes tatSkeletonPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: .5; }
        }
        .tat-skeleton { animation: tatSkeletonPulse 1.5s ease-in-out infinite; }
      `}</style>

      <PageHeader
        eyebrow="TAT"
        title="Turnaround Time"
        subtitle="วิเคราะห์ระยะเวลารายงานผล"
        marginBottom={0}
        actions={(
          <>
            <Link href="/tat/annual">
              <Button variant="secondary" icon="chart">ภาพรวมทั้งปี</Button>
            </Link>
          </>
        )}
      />

      {/* ── Segmented tab control ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', padding: 3, borderRadius: 28, gap: 2 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '8px 20px', borderRadius: 24, border: 'none',
                background: activeTab === tab.id ? 'var(--card)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .2s',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,.10)' : 'none',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        padding: '11px 14px', background: 'var(--card)',
        border: '1px solid var(--border)', borderRadius: 12,
      }}>
        <span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginRight: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="filter" size={11} />
          กรอง
        </span>

        <div style={{ position: 'relative', display: 'inline-block' }}>
          <select
            value={fiscalYear}
            onChange={e => setFiscalYear(Number(e.target.value))}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              padding: '6px 28px 6px 11px', borderRadius: 8,
              border: '1px solid var(--border)', fontSize: 12.5,
              fontFamily: 'inherit', background: 'var(--card)',
              color: 'var(--ink)', cursor: 'pointer', outline: 'none',
            }}
          >
            {yearOptions.map(fy => <option key={fy} value={fy}>ปีงบ {fy}</option>)}
          </select>
          <svg style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width={11} height={11} viewBox="0 0 12 12">
            <path d="M2 4l4 4 4-4" stroke="#64748B" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <MonthSelector value={month} onChange={setMonth} />

        {activeTab !== 'phlebotomy' && (
          <FilterSelect value={labSection} onChange={handleLabSectionChange}>
            <option value="">แผนก Lab ทั้งหมด</option>
            {(data?.filter_options?.lab_sections ?? []).map(s => <option key={s} value={s}>{s}</option>)}
          </FilterSelect>
        )}

        {activeTab === 'lab' && (
          <FilterSelect value={ward} onChange={handleWardChange}>
            <option value="">หอผู้ป่วยทั้งหมด</option>
            {(data?.filter_options?.wards ?? []).map(w => <option key={w} value={w}>{w}</option>)}
          </FilterSelect>
        )}

        {activeTab !== 'phlebotomy' && (
          <FilterSelect value={priority} onChange={setPriority}>
            <option value="">ทุกความเร่งด่วน</option>
            <option value="ด่วน">ด่วน</option>
            <option value="ปกติ">ปกติ</option>
          </FilterSelect>
        )}

        {activeTab === 'lab' && (
          <FilterSelect value={testName} onChange={setTestName}>
            <option value="">ทุกประเภทการตรวจ</option>
            {(data?.filter_options?.test_names ?? []).map(t => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
        )}

        {activeTab !== 'lab' && labzoneOptions.length > 0 && (
          <FilterSelect value={labzone} onChange={setLabzone}>
            <option value="">หน่วยเจาะเลือดทั้งหมด</option>
            {labzoneOptions.map(lz => <option key={lz} value={lz}>{displayLabzone(lz)}</option>)}
          </FilterSelect>
        )}

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            style={{
              padding: '5px 11px', borderRadius: 16,
              border: '1.5px solid var(--danger)',
              background: 'rgba(220,38,38,.05)', color: 'var(--danger)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
              transition: 'background .15s',
            }}
          >
            <Icon name="x" size={11} />
            ล้าง {activeFilterCount > 1 ? `(${activeFilterCount})` : ''}
          </button>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="tat-skeleton" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              <div style={{ height: 10, borderRadius: 4, background: 'var(--surface-2)', width: 90, marginBottom: 14 }} />
              <div style={{ height: 28, borderRadius: 6, background: 'var(--surface-2)', width: 70 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && isEmpty && !canShowPhlebOnly && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <EmptyState
            icon="clock"
            title="ยังไม่มีข้อมูล TAT สำหรับเดือนนี้"
            hint={canEdit ? 'รัน npm run tat:local บนเครื่องเพื่อสร้าง cache ของเดือนนี้' : undefined}
          />
        </div>
      )}

      {!loading && (!isEmpty || canShowPhlebOnly) && kpi && (
        <>
          {/* ════════ TAB 1: ภาพรวม ════════ */}
          {activeTab === 'overview' && (
            <div key="overview" className="tat-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <KpiBigStat
                  label={`${overviewTatLabel} (ตัด >12 hr)`}
                  value={overviewAvgTatCut > 0 ? formatDuration(overviewAvgTatCut) : '—'}
                  sub={overviewMedianTatCut > 0
                    ? (overviewHasTotalTat
                      ? `คิด ${totalTatCutCount.toLocaleString()} LN • ตัดออก ${totalTatOutlierCount.toLocaleString()} • มัธยฐาน ${formatDuration(overviewMedianTatCut)}`
                      : `ใช้ TAT ห้องปฏิบัติการ • มัธยฐาน ${formatDuration(overviewMedianTatCut)}`)
                    : (overviewHasTotalTat
                      ? `LN เจาะเลือด ${(kpi.blood_sample_count ?? matchedBloodSamples).toLocaleString()}`
                      : 'ไม่มี LN เจาะเลือดที่จับคู่ได้ในตัวกรองนี้')
                  }
                  iconBg="rgba(30,95,173,.12)"
                  icon="clock"
                />
                <KpiBigStat
                  label={`${overviewTatLabel} (ไม่ตัด)`}
                  value={overviewAvgTatAll > 0 ? formatDuration(overviewAvgTatAll) : '—'}
                  sub={overviewMedianTatAll > 0
                    ? `ข้อมูลทั้งหมด • มัธยฐาน ${formatDuration(overviewMedianTatAll)}`
                    : 'ข้อมูลทั้งหมด'}
                  iconBg="rgba(217,119,6,.12)"
                  icon="clock"
                />
                <KpiRingStat
                  label={overviewHasTotalTat ? '% Total TAT ≤2 hr' : `% ตามเป้าหมายราย test (${(kpi.target_count ?? 0).toLocaleString()} มี target)`}
                  pct={overviewPctWithinTarget}
                  color="#16A34A"
                />
                <KpiRingStat
                  label="% ไม่ผ่านตามเป้าหมาย"
                  pct={Math.max(0, +(100 - overviewPctWithinTarget).toFixed(1))}
                  color="#D97706"
                />
              </div>

              {showPhlebPipeline ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
                  <SectionCard title="Pipeline เวลา" subtitle="ลงทะเบียน → ยืนยันคิว → เจาะเสร็จ → รับ specimen → รายงานผล" accentColor="var(--primary)">
                    <PipelineViz stages={data?.stage_breakdown ?? []} total={overviewAvgTatCut} />
                  </SectionCard>

                  <SectionCard title="คุณภาพการจับคู่ข้อมูล" subtitle="ระดับ LN เฉพาะตัวอย่างเจาะเลือด" accentColor="#9333EA">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <PieChart width={130} height={130}>
                        <Pie data={matchPieData} cx={60} cy={60} innerRadius={38} outerRadius={58}
                          dataKey="value" startAngle={90} endAngle={-270}>
                          {matchPieData.map(entry => (
                            <Cell key={entry.name} fill={MATCH_COLORS[entry.name] ?? '#CBD5E1'} />
                          ))}
                        </Pie>
                      </PieChart>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {matchPieData.map(entry => (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                            <div style={{ width: 9, height: 9, borderRadius: 2, background: MATCH_COLORS[entry.name] ?? '#CBD5E1', flexShrink: 0 }} />
                            <span style={{ color: 'var(--muted)' }}>{entry.name}</span>
                            <span style={{ fontWeight: 700, color: 'var(--ink)', marginLeft: 'auto' }}>{entry.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {(data?.match_breakdown.ambiguous ?? 0) > 0 && (
                      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--warning)', padding: '7px 10px', background: 'rgba(217,119,6,.08)', borderRadius: 7, borderLeft: '3px solid var(--warning)' }}>
                        จับคู่ไม่แน่นอน {data?.match_breakdown.ambiguous.toLocaleString()} LN (ผู้ป่วยมาเจาะหลายครั้ง/วัน)
                      </div>
                    )}
                  </SectionCard>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <SectionCard title="Pipeline เวลา" subtitle="รับ specimen → รายงานผล" accentColor="var(--primary)">
                    <LabTatPipeline avgTat={kpi.avg_tat} />
                  </SectionCard>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                <SectionCard title="Trend รายเดือนภาพรวม" accentColor="var(--primary)">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={data?.trend ?? []} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey={({ year: y, month: m }: TrendRow) => formatTrendLabel(y, m)} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                      <YAxis yAxisId="left"  tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit=" min" width={50} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" width={36} domain={[0, 100]} />
                      <Tooltip
                        formatter={(val, name) => name === 'TAT เฉลี่ย' ? [formatDuration(Number(val)), name] : [`${val}%`, name]}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine yAxisId="right" y={95} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target 95%', fill: '#D97706', fontSize: 10, position: 'insideTopRight' }} />
                      <Line yAxisId="left"  type="monotone" dataKey="avg_tat"          name="TAT เฉลี่ย" stroke="#1E5FAD" strokeWidth={2.5} dot={{ r: 3, fill: '#1E5FAD' }} />
                      <Line yAxisId="right" type="monotone" dataKey="pct_within_target" name="% ตามเป้า"  stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="การกระจาย TAT" accentColor="var(--warning)">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={data?.tat_distribution ?? []} margin={{ top: 4, right: 36, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="bin" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                      <YAxis yAxisId="left"  tick={{ fontSize: 10.5, fill: 'var(--muted)' }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={36} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar  yAxisId="left"  dataKey="count"          name="จำนวน"  fill="var(--primary)" opacity={0.85} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" dataKey="cumulative_pct" name="% สะสม" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3, fill: '#D97706' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </SectionCard>
              </div>

              <SectionCard title="Trend รายเดือน Lab ด่วน" subtitle="Target 100% ตามเป้าหมายราย test" accentColor="#DC2626">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={urgentLabTrend} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey={({ year: y, month: m }: TrendRow) => formatTrendLabel(y, m)} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit=" min" width={50} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" width={36} domain={[0, 100]} />
                    <Tooltip
                      formatter={(val, name) => name === 'TAT เฉลี่ย' ? [formatDuration(Number(val)), name] : [`${val}%`, name]}
                      labelFormatter={(label) => String(label)}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine yAxisId="right" y={100} stroke="#DC2626" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target 100%', fill: '#DC2626', fontSize: 10, position: 'insideTopRight' }} />
                    <Line yAxisId="left"  type="monotone" dataKey="avg_tat" name="TAT เฉลี่ย" stroke="#1E5FAD" strokeWidth={2.5} dot={{ r: 3, fill: '#1E5FAD' }} />
                    <Line yAxisId="right" type="monotone" dataKey="pct_within_target" name="% ตามเป้า" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 3, fill: '#DC2626' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </SectionCard>
            </div>
          )}

          {/* ════════ TAB 2: TAT Phlebotomy ════════ */}
          {activeTab === 'phlebotomy' && (
            <div key="phlebotomy" className="tat-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!hasPhleb ? (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <EmptyState
                    icon="syringe"
                    title="ยังไม่มีข้อมูลการเจาะเลือดสำหรับเดือนนี้"
                    hint={canEdit ? 'รัน npm run tat:local พร้อมไฟล์ TAT และ Phlebotomy เพื่อสร้าง cache ของเดือนนี้' : undefined}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    <KpiBigStat
                      label="จำนวนคนมาเจาะเลือด"
                      value={(data?.phleb_hn_count ?? 0).toLocaleString()}
                      sub="HN ไม่ซ้ำ"
                      iconBg="rgba(30,95,173,.12)"
                      icon="syringe"
                    />
                    <KpiBigStat
                      label="เวลาเจาะเลือดเฉลี่ย"
                      value={kpi.avg_phleb_wait > 0 ? formatDuration(kpi.avg_phleb_wait) : '—'}
                      iconBg="rgba(217,119,6,.12)"
                      icon="clock"
                    />
                    <KpiRingStat
                      label="% ตามเป้าหมาย (เจาะ ≤30 min)"
                      pct={kpi.pct_phleb_within_target}
                      color="#16A34A"
                    />
                    <KpiRingStat
                      label="% ไม่ผ่านตามเป้าหมาย"
                      pct={Math.max(0, +(100 - kpi.pct_phleb_within_target).toFixed(2))}
                      color="#D97706"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                    <SectionCard title="Heatmap เวลายืนยันคิวเจาะเลือด" accentColor="var(--primary)">
                      <TatHeatmap cells={data?.phleb_heatmap ?? []} tooltipLabel="คน" />
                    </SectionCard>

                    {phlebLabzoneData.length > 0 && (
                      <SectionCard title="Workload หน่วยเจาะเลือด" accentColor="#9333EA">
                        <ResponsiveContainer width="100%" height={Math.max(180, phlebLabzoneData.length * 75)}>
                          <BarChart layout="vertical" data={phlebLabzoneData} margin={{ top: 0, right: 80, bottom: 0, left: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                            <YAxis
                              type="category"
                              dataKey="labzone_name"
                              tick={{ fontSize: 11, fill: 'var(--muted)' }}
                              width={130}
                              tickFormatter={displayLabzone}
                            />
                            <Tooltip
                              formatter={(val, name) => [Number(val).toLocaleString(), String(name)]}
                              labelFormatter={(label) => displayLabzone(String(label))}
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="count" name="จำนวนคน" fill="var(--primary)" opacity={0.85} radius={[0, 4, 4, 0]}
                              label={{ position: 'right', fontSize: 11, fill: 'var(--muted)', formatter: (v: unknown) => Number(v).toLocaleString() }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </SectionCard>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════ TAB 3: TAT ห้องปฏิบัติการ ════════ */}
          {activeTab === 'lab' && (
            <div key="lab" className="tat-panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                <KpiBigStat
                  label="จำนวนตัวอย่าง (LN)"
                  value={(kpi.sample_count ?? kpi.total_count ?? 0).toLocaleString()}
                  iconBg="rgba(147,51,234,.12)"
                  icon="beaker"
                />
                <KpiBigStat
                  label="TAT เฉลี่ย (รับ→ผล)"
                  value={formatDuration(kpi.avg_tat ?? 0)}
                  sub={(kpi.median_tat ?? 0) > 0 ? `มัธยฐาน ${formatDuration(kpi.median_tat)}` : undefined}
                  iconBg="rgba(30,95,173,.12)"
                  icon="clock"
                />
                <KpiRingStat
                  label={`% ตามเป้าหมายราย test (${(kpi.target_count ?? 0).toLocaleString()} มี target)`}
                  pct={kpi.pct_within_target ?? 0}
                  color="#16A34A"
                />
                <KpiRingStat
                  label="% ไม่ผ่านตามเป้าหมาย"
                  pct={Math.max(0, +(100 - (kpi.pct_within_target ?? 0)).toFixed(1))}
                  color="#DC2626"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                <SectionCard title="Trend รายเดือน" accentColor="var(--primary)">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={data?.trend ?? []} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey={({ year: y, month: m }: TrendRow) => formatTrendLabel(y, m)} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                      <YAxis yAxisId="left"  tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit=" min" width={50} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" width={36} domain={[0, 100]} />
                      <Tooltip
                        formatter={(val, name) => name === 'TAT เฉลี่ย' ? [formatDuration(Number(val)), name] : [`${val}%`, name]}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <ReferenceLine yAxisId="right" y={95} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target 95%', fill: '#D97706', fontSize: 10, position: 'insideTopRight' }} />
                      <Line yAxisId="left"  type="monotone" dataKey="avg_tat"           name="TAT เฉลี่ย" stroke="#1E5FAD" strokeWidth={2.5} dot={{ r: 3, fill: '#1E5FAD' }} />
                      <Line yAxisId="right" type="monotone" dataKey="pct_within_target"  name="% ตามเป้า"  stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="TAT เฉลี่ยต่อแผนก" subtitle="แดง = เกินมัธยฐาน" accentColor="var(--danger)">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart layout="vertical" data={sectionData} margin={{ top: 0, right: 20, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit=" min" />
                      <YAxis type="category" dataKey="lab_section" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} width={80} />
                      <Tooltip formatter={(val) => [formatDuration(Number(val)), 'TAT เฉลี่ย']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                      <Bar dataKey="avg_tat" name="TAT เฉลี่ย" radius={[0, 4, 4, 0]}>
                        {sectionData.map((entry, i) => (
                          <Cell key={i} fill={entry.avg_tat > sectionMedian ? '#DC2626' : '#1E5FAD'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                <SectionCard title="การกระจาย TAT" accentColor="var(--warning)">
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={data?.tat_distribution ?? []} margin={{ top: 4, right: 36, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="bin" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                      <YAxis yAxisId="left"  tick={{ fontSize: 10.5, fill: 'var(--muted)' }} allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={36} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar  yAxisId="left"  dataKey="count"          name="จำนวน"  fill="var(--primary)" opacity={0.85} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" dataKey="cumulative_pct" name="% สะสม" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3, fill: '#D97706' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="Heatmap เวลารับตัวอย่าง" accentColor="var(--primary)">
                  <TatHeatmap cells={data?.heatmap ?? []} />
                </SectionCard>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
