'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Risk, RiskAction } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ModuleSubnav } from '@/components/ui/ModuleSubnav'
import { RISK_NAVIGATION } from '@/lib/navigation'
import { RiskHeatmap } from '@/components/lab/RiskHeatmap'
import {
  LAB_DEPARTMENTS,
  NEAR_MISS_EVENTS,
  REPORTER_POSITIONS,
  RISK_EVENT_TYPES,
  SMART_RM_HEADERS,
  mapIorStatusToStatus,
  normalizeIsoDate,
  requiresRca,
  reviewStatusLabel,
  riskLevel,
  riskScore,
  statusLabel,
} from '@/lib/risk-utils'

export type RiskSection = 'dashboard' | 'smart' | 'ior' | 'register'
type ImportMode = 'smart' | 'ior' | 'register'
type RiskPermission = 'none' | 'view' | 'edit'
type RiskWithActions = Risk & { actions: RiskAction[] }
type FormState = Partial<Risk>
type ActionDraft = Partial<RiskAction>
type RiskListScope = 'smart' | 'ior' | 'register'
type RiskListMeta = {
  count: number
  page: number
  pageSize: number
}

const SEVERITIES = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
const SEVERITY_FILTER_ORDER = ['ต่ำ', 'กลาง', 'ปานกลาง', 'สูง', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
const SCORE_OPTIONS = ['', '1', '2', '3', '4', '5']
const REGISTER_PAGE_SIZE = 20
const THAI_MONTHS = [
  { value: '01', label: 'ม.ค.' },
  { value: '02', label: 'ก.พ.' },
  { value: '03', label: 'มี.ค.' },
  { value: '04', label: 'เม.ย.' },
  { value: '05', label: 'พ.ค.' },
  { value: '06', label: 'มิ.ย.' },
  { value: '07', label: 'ก.ค.' },
  { value: '08', label: 'ส.ค.' },
  { value: '09', label: 'ก.ย.' },
  { value: '10', label: 'ต.ค.' },
  { value: '11', label: 'พ.ย.' },
  { value: '12', label: 'ธ.ค.' },
]
const SEVERITY_COLORS: Record<string, string> = {
  A: '#EF4444',
  B: '#F59E0B',
  C: '#3B82F6',
  D: '#10B981',
  E: '#8B5CF6',
  F: '#EC4899',
  G: '#64748B',
  H: '#475569',
  I: '#111827',
}
const RISK_PALETTE = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

const inputStyle: React.CSSProperties = {
  height: 38,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--card)',
  color: 'var(--ink)',
  fontFamily: 'inherit',
  fontSize: 13,
  padding: '0 11px',
  width: '100%',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: 88,
  padding: 11,
  resize: 'vertical',
  lineHeight: 1.45,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: 'var(--muted)',
  marginBottom: 5,
}

function fmt(n: number) {
  return n.toLocaleString()
}

function today() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateOnly(value?: string | null) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(year, month - 1, day)
}

function isOverdue(date?: string | null) {
  if (!date) return false
  const end = parseDateOnly(date)
  if (!end) return false
  end.setHours(23, 59, 59, 999)
  return end.getTime() < Date.now()
}

function riskNo(risk: Risk) {
  return risk.external_no || risk.risk_no || `R-${String(risk.id).padStart(5, '0')}`
}

function isSmartRmRisk(risk: Risk) {
  return Boolean(String(risk.external_no ?? '').trim())
}

function isRiskRegisterRisk(risk: Risk) {
  return !isSmartRmRisk(risk) && risk.event_type === 'risk_assessment'
}

function isIorRisk(risk: Risk) {
  return !isSmartRmRisk(risk) && !isRiskRegisterRisk(risk)
}

function residualTrend(risk: Risk) {
  const initial = riskScore(risk.likelihood, risk.impact)
  const residual = risk.residual_score ?? riskScore(risk.residual_likelihood, risk.residual_impact)
  if (!residual || !initial) return 'ยังไม่ประเมิน'
  if (residual < initial) return 'ลดลง'
  if (residual > initial) return 'สูงขึ้น'
  return 'เท่าเดิม'
}

function colorForLevel(level?: string | null) {
  if (level === 'high') return '#DC2626'
  if (level === 'medium') return '#D97706'
  return '#16A34A'
}

function riskLevelText(level?: string | null) {
  if (level === 'high') return 'สูง'
  if (level === 'medium') return 'กลาง'
  if (level === 'low') return 'ต่ำ'
  return ''
}

function riskAssessmentLevel(likelihood?: number | null, impact?: number | null) {
  return riskLevel(riskScore(likelihood, impact))
}

function riskAssessmentSeverity(likelihood?: number | null, impact?: number | null) {
  return riskLevelText(riskAssessmentLevel(likelihood, impact))
}

function eventYear(risk: Risk) {
  return (risk.event_date ?? risk.recorded_date ?? risk.created_at ?? '').slice(0, 4)
}

function eventMonthKey(risk: Risk) {
  return (risk.event_date ?? risk.recorded_date ?? risk.created_at ?? '').slice(0, 7)
}

function eventMonth(risk: Risk) {
  return eventMonthKey(risk).slice(5, 7)
}

function eventFiscalYear(risk: Risk) {
  const value = risk.event_date ?? risk.recorded_date ?? risk.created_at ?? ''
  const match = String(value).match(/^(\d{4})-(\d{2})/)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  if (!year || !month) return ''
  return String(month >= 10 ? year + 544 : year + 543)
}

function latestEventDateKey(risk: Risk) {
  return String(risk.event_date ?? risk.recorded_date ?? risk.created_at ?? '').slice(0, 10)
}

function isFutureDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value > today()
}

function latestExternalSortValue(risk: Risk) {
  const match = String(risk.external_no ?? '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

function compareLatestRisk(a: Risk, b: Risk) {
  const dateCompare = latestEventDateKey(b).localeCompare(latestEventDateKey(a))
  if (dateCompare !== 0) return dateCompare
  const externalCompare = latestExternalSortValue(b) - latestExternalSortValue(a)
  if (externalCompare !== 0) return externalCompare
  return b.id - a.id
}

function eventTypeGroup(risk: Risk) {
  const value = (risk.risk_type ?? '').toLowerCase()
  if (value.includes('non')) return 'Non-Clinic'
  if (value.includes('clinic')) return 'Clinic'
  return risk.risk_type || 'ไม่ระบุ'
}

function topCounts<T>(items: T[], pick: (item: T) => string | null | undefined, limit: number) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const raw = pick(item)?.trim() || 'ไม่ระบุ'
    const key = raw.length > 32 ? `${raw.slice(0, 32)}...` : raw
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

function formatThaiDate(value?: string | null) {
  if (!value) return '—'
  const d = parseDateOnly(value)
  if (!d) return value.slice(0, 10)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatRiskShortDate(value?: string | null) {
  if (!value) return '—'
  const d = parseDateOnly(value)
  if (!d) return value.slice(0, 10)
  const beYear = d.getFullYear() + 543
  return `${d.getDate()}/${d.getMonth() + 1}/${String(beYear).slice(2)}`
}

function compareSeverityFilter(a: string, b: string) {
  const ai = SEVERITY_FILTER_ORDER.indexOf(a)
  const bi = SEVERITY_FILTER_ORDER.indexOf(b)
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  return a.localeCompare(b, 'th')
}

function badgeStyle(bg: string, color = bg): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 24,
    borderRadius: 999,
    padding: '0 9px',
    background: `${bg}18`,
    color,
    fontSize: 11.5,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  }
}

function latestTypeBadgeStyle(type: string): React.CSSProperties {
  const isClinic = type === 'Clinic'
  return {
    ...badgeStyle(isClinic ? '#E0F2FE' : '#F1F5F9', isClinic ? '#0074B7' : '#334155'),
    borderRadius: 6,
    minHeight: 27,
    padding: '0 13px',
    fontSize: 16,
    fontWeight: 800,
  }
}

function latestSeverityBadgeStyle(severity?: string | null): React.CSSProperties {
  const sev = (severity ?? '').toUpperCase()
  const styles: Record<string, { bg: string; color: string }> = {
    A: { bg: '#FEE2E2', color: '#EF4444' },
    B: { bg: '#FEF3C7', color: '#F59E0B' },
    C: { bg: '#DBEAFE', color: '#3B82F6' },
    D: { bg: '#D1FAE5', color: '#10B981' },
    E: { bg: '#EDE9FE', color: '#8B5CF6' },
    F: { bg: '#FCE7F3', color: '#EC4899' },
    G: { bg: '#F1F5F9', color: '#64748B' },
    H: { bg: '#E2E8F0', color: '#475569' },
    I: { bg: '#E5E7EB', color: '#111827' },
  }
  const cfg = styles[sev] ?? { bg: '#E2E8F0', color: '#475569' }
  return {
    ...badgeStyle(cfg.bg, cfg.color),
    borderRadius: 7,
    minHeight: 28,
    minWidth: 34,
    justifyContent: 'center',
    padding: '0 9px',
    fontSize: 16,
    fontWeight: 900,
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

export function RiskClient({ permission, canReview, activeSection }: { permission: RiskPermission; canReview: boolean; activeSection: RiskSection }) {
  const canEdit = permission === 'edit'
  const tab = activeSection
  const [risks, setRisks] = useState<RiskWithActions[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [department, setDepartment] = useState('')
  const [editing, setEditing] = useState<RiskWithActions | null>(null)
  const [previewing, setPreviewing] = useState<RiskWithActions | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('smart')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/risks?view=dashboard')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      const actions = (json.actions ?? []) as RiskAction[]
      setRisks((json.data ?? []).map((risk: Risk) => ({
        ...risk,
        actions: actions.filter(action => action.risk_id === risk.id),
      })))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function refreshRiskData() {
    setRefreshKey(value => value + 1)
    void load()
  }

  async function openPreview(risk: RiskWithActions) {
    if (risk.event_detail) {
      setPreviewing(risk)
      return
    }
    try {
      const res = await fetch(`/api/admin/risks/${risk.id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดรายละเอียดไม่สำเร็จ')
      setPreviewing({
        ...json.data,
        actions: json.actions ?? [],
      })
    } catch {
      setPreviewing(risk)
    }
  }

  const dashboardRisks = useMemo(() => risks.filter(r => !isFutureDateKey(latestEventDateKey(r))), [risks])
  const riskRegisterDashboardRisks = useMemo(() => dashboardRisks.filter(isRiskRegisterRisk), [dashboardRisks])

  const dashboard = useMemo(() => {
    const open = dashboardRisks.filter(r => r.status !== 'closed')
    const actionWait = dashboardRisks.filter(r => r.status === 'mitigating')
    const followWait = dashboardRisks.filter(r => r.status === 'monitoring')
    const closed = dashboardRisks.filter(r => r.status === 'closed')
    const residualHigh = dashboardRisks.filter(r => r.residual_level === 'high')
    const overdue = dashboardRisks.filter(r => isOverdue(r.due_date) || isOverdue(r.follow_up_date) || r.actions.some(a => a.status !== 'done' && isOverdue(a.due_date)))
    const needsRca = dashboardRisks.filter(r => r.requires_rca && !r.root_cause)
    const followItems = dashboardRisks.filter(r => r.status !== 'closed' && (isOverdue(r.due_date) || isOverdue(r.follow_up_date) || r.actions.some(a => a.status !== 'done' && isOverdue(a.due_date)))).slice(0, 8)
    return { open, actionWait, followWait, closed, residualHigh, overdue, needsRca, followItems }
  }, [dashboardRisks])

  const heatInitial = riskRegisterDashboardRisks.map(r => ({
    id: riskNo(r),
    name: r.name,
    likelihood: r.likelihood ?? 1,
    impact: r.impact ?? 1,
    level: r.level ?? 'low',
    status: r.status ?? 'open',
  }))

  const heatResidual = riskRegisterDashboardRisks
    .filter(r => r.residual_likelihood && r.residual_impact)
    .map(r => ({
      id: riskNo(r),
      name: r.name,
      likelihood: r.residual_likelihood ?? 1,
      impact: r.residual_impact ?? 1,
      level: r.residual_level ?? 'low',
      status: r.status ?? 'open',
    }))

  return (
    <div className="risk-page" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .risk-page{width:100%;max-width:none;margin:0;padding:0;box-sizing:border-box}
        .risk-tabs{display:flex;gap:5px;overflow-x:auto;padding:5px;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;scrollbar-width:thin}
        .risk-tab{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:700;padding:10px 14px;border-radius:10px;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;cursor:pointer;transition:background .18s,color .18s,box-shadow .18s}
        .risk-tab:hover{color:var(--ink);background:color-mix(in srgb,var(--card) 78%,var(--primary-soft))}
        .risk-tab[aria-selected="true"]{color:var(--primary);background:var(--card);box-shadow:0 2px 7px rgba(15,23,42,.08)}
        .risk-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 30%,transparent);outline-offset:2px}
        @media(max-width:767px){.risk-tabs{margin-inline:-4px}.risk-tab{padding:9px 12px}}
        @media(prefers-reduced-motion:reduce){.risk-tab{transition:none}}
      `}</style>
      <PageHeader
        eyebrow="RISK MANAGEMENT"
        title="ทะเบียนความเสี่ยง"
        subtitle="ติดตาม action plan, follow-up และ Residual Risk ตาม WI-G-OV06"
        marginBottom={0}
        actions={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && tab !== 'dashboard' && (
            <Button variant="secondary" icon="upload" onClick={() => { setImportMode(tab === 'smart' ? 'smart' : tab === 'ior' ? 'ior' : 'register'); setShowImport(true) }}>Import</Button>
          )}
          {canEdit && (tab === 'ior' || tab === 'register') && (
            <Button variant="primary" icon="plus" onClick={() => setShowCreate(true)}>เพิ่มรายการ</Button>
          )}
        </div>}
      />

      <ModuleSubnav items={RISK_NAVIGATION} label="เมนูทะเบียนความเสี่ยง" />

      {error && <div style={{ padding: 13, borderRadius: 10, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลดทะเบียนความเสี่ยง...</div>}

      {!loading && tab === 'dashboard' && (
        <Dashboard risks={risks} dashboard={dashboard} heatInitial={heatInitial} heatResidual={heatResidual} onOpen={(risk) => { void openPreview(risk) }} />
      )}

      {!loading && tab === 'smart' && (
        <RegisterTable
          title="ความเสี่ยงจาก Smart-RM"
          scope="smart"
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          severity={severity}
          setSeverity={setSeverity}
          department={department}
          setDepartment={setDepartment}
          onOpen={setPreviewing}
          onMutated={refreshRiskData}
          canEdit={canEdit}
          refreshKey={refreshKey}
        />
      )}

      {!loading && tab === 'ior' && (
        <RegisterTable
          title="รายงานอุบัติการณ์ (IOR)"
          scope="ior"
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          severity={severity}
          setSeverity={setSeverity}
          department={department}
          setDepartment={setDepartment}
          onOpen={canReview ? setEditing : setPreviewing}
          onMutated={refreshRiskData}
          canEdit={canEdit}
          refreshKey={refreshKey}
        />
      )}

      {!loading && tab === 'register' && (
        <RegisterTable
          title="ทะเบียนความเสี่ยงในห้องปฏิบัติการ (Risk Register)"
          scope="register"
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          severity={severity}
          setSeverity={setSeverity}
          department={department}
          setDepartment={setDepartment}
          onOpen={canReview ? setEditing : setPreviewing}
          onMutated={refreshRiskData}
          canEdit={canEdit}
          refreshKey={refreshKey}
        />
      )}

      {canEdit && showCreate && <RiskFormModal initialEventType={tab === 'register' ? 'risk_assessment' : 'near_miss'} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); refreshRiskData() }} />}
      {previewing && <RiskEventPreviewModal risk={previewing} onClose={() => setPreviewing(null)} />}
      {canReview && editing && <RiskDetailModal risk={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refreshRiskData() }} />}
      {canEdit && showImport && <RiskImportModal mode={importMode} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); refreshRiskData() }} />}
    </div>
  )
}

function Dashboard({ risks, dashboard, heatInitial, heatResidual, onOpen }: {
  risks: RiskWithActions[]
  dashboard: ReturnType<typeof RiskClientDashboardShape>
  heatInitial: { id: string; name: string; likelihood: number; impact: number; level: string; status: string }[]
  heatResidual: { id: string; name: string; likelihood: number; impact: number; level: string; status: string }[]
  onOpen: (risk: RiskWithActions) => void
}) {
  const [year, setYear] = useState('')
  const [type, setType] = useState('')

  const years = Array.from(new Set(risks.map(eventFiscalYear).filter(Boolean))).sort()
  const scoped = risks.filter(risk => {
    if (year && eventFiscalYear(risk) !== year) return false
    if (type && eventTypeGroup(risk) !== type) return false
    return true
  })

  const historicalScoped = scoped.filter(risk => !isFutureDateKey(latestEventDateKey(risk)))

  const monthly = Object.entries(historicalScoped.reduce<Record<string, number>>((acc, r) => {
    const key = eventMonthKey(r) || 'ไม่ระบุ'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([name, value]) => ({ name, value }))
  const clinic = historicalScoped.filter(risk => eventTypeGroup(risk) === 'Clinic').length
  const nonClinic = historicalScoped.filter(risk => eventTypeGroup(risk) === 'Non-Clinic').length
  const severe = historicalScoped.filter(risk => ['E', 'F', 'G', 'H', 'I'].includes((risk.severity_level ?? '').toUpperCase())).length
  const monthCount = new Set(historicalScoped.map(eventMonthKey).filter(Boolean)).size
  const avgMonth = monthCount ? Math.round(historicalScoped.length / monthCount) : historicalScoped.length
  const typeData = [
    { name: 'Clinic', value: clinic, color: '#0EA5E9' },
    { name: 'Non-Clinic', value: nonClinic, color: '#F59E0B' },
  ].filter(item => item.value > 0)
  const locationData = topCounts(historicalScoped, risk => risk.department_found, 10)
  const categoryData = topCounts(historicalScoped, risk => risk.event_main_category ?? risk.event_category, 8)
  const latest = historicalScoped
    .slice()
    .sort(compareLatestRisk)
    .slice(0, 10)
  const severityCounts = SEVERITIES.filter(Boolean).map(sev => ({
    sev,
    value: historicalScoped.filter(risk => (risk.severity_level ?? '').toUpperCase() === sev).length,
    color: SEVERITY_COLORS[sev] ?? '#94A3B8',
  }))
  const maxSeverity = Math.max(1, ...severityCounts.map(item => item.value))
  const levelCounts = [
    ['Initial High', historicalScoped.filter(r => r.level === 'high').length, '#DC2626'],
    ['Residual High', historicalScoped.filter(r => r.residual_level === 'high').length, '#B91C1C'],
    ['Residual Medium', historicalScoped.filter(r => r.residual_level === 'medium').length, '#D97706'],
    ['Residual Low', historicalScoped.filter(r => r.residual_level === 'low').length, '#16A34A'],
  ] as const

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: '#0EA5E9', color: '#fff', fontWeight: 900 }}>LR</div>
          <div>
            <div style={{ color: 'var(--ink)', fontWeight: 900 }}>LAB Risk Dashboard</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>โรงพยาบาลชลบุรี - กลุ่มงานเทคนิคการแพทย์</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={year} onChange={e => setYear(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="">ทุกปีงบ</option>
            {years.map(y => <option key={y} value={y}>ปีงบ {y}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, width: 150 }}>
            <option value="">ทุกประเภท</option>
            <option value="Clinic">Clinic</option>
            <option value="Non-Clinic">Non-Clinic</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#10B981', display: 'inline-block' }} />
            อัปเดต {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: 10 }}>
        <Kpi label="ทั้งหมด" value={historicalScoped.length} sub="เหตุการณ์" icon="inbox" tone="#0EA5E9" />
        <Kpi label="Clinic" value={clinic} sub={historicalScoped.length ? `${Math.round(clinic / historicalScoped.length * 100)}% จากทั้งหมด` : '—'} icon="flask" tone="#10B981" />
        <Kpi label="Non-Clinic" value={nonClinic} sub={historicalScoped.length ? `${Math.round(nonClinic / historicalScoped.length * 100)}% จากทั้งหมด` : '—'} icon="building" tone="#F59E0B" />
        <Kpi label="รุนแรง E-I" value={severe} sub="ต้องติดตาม" icon="alert" tone="#EF4444" />
        <Kpi label="เฉลี่ย/เดือน" value={avgMonth} sub="เหตุการณ์" icon="chart" tone="#8B5CF6" />
        <Kpi label="เกินกำหนด" value={dashboard.overdue.filter(r => scoped.some(s => s.id === r.id)).length} sub="review/action" icon="clock" tone="#B91C1C" />
        <Kpi label="Residual สูง" value={dashboard.residualHigh.filter(r => scoped.some(s => s.id === r.id)).length} sub="หลังแก้ไข" icon="trending" tone="#7F1D1D" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 12 }}>
        <Panel title="แนวโน้มรายเดือน">
          <div style={{ height: 280, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthly} margin={{ top: 8, right: 18, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} width={34} />
                <Tooltip formatter={(value) => [fmt(Number(value)), 'เหตุการณ์']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                <Area type="monotone" dataKey="value" stroke="#0EA5E9" fill="#0EA5E922" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Clinic vs Non-Clinic">
          <div style={{ height: 280, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={3}>
                  {typeData.map(item => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [fmt(Number(value)), String(name)]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
            {typeData.map(item => <span key={item.name}><span style={{ width: 9, height: 9, display: 'inline-block', borderRadius: 3, background: item.color, marginRight: 5 }} />{item.name}</span>)}
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="Top 10 สถานที่เกิดเหตุ">
          <RiskBarChart data={locationData} color="#06B6D4" />
        </Panel>
        <Panel title="ประเภทเหตุการณ์หลัก">
          <RiskBarChart data={categoryData} palette />
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.4fr', gap: 12 }}>
        <Panel title="ระดับความรุนแรง (RM)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {severityCounts.map(item => (
              <div key={item.sev} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, color: item.color, fontWeight: 900 }}>{item.sev}</div>
                <div style={{ flex: 1, height: 10, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round(item.value / maxSeverity * 100)}%`, background: item.color, borderRadius: 999 }} />
                </div>
                <div style={{ width: 38, textAlign: 'right', color: 'var(--muted)', fontSize: 12 }}>{fmt(item.value)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {levelCounts.map(([label, value, color]) => (
              <div key={label} style={{ padding: 10, borderRadius: 9, background: `${color}10`, border: `1px solid ${color}22` }}>
                <div style={{ color, fontWeight: 900, fontSize: 20 }}>{fmt(value)}</div>
                <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="10 เหตุการณ์ล่าสุด">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18, minWidth: 920, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 130 }} />
                <col style={{ width: 300 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 105 }} />
                <col />
              </colgroup>
              <thead>
                <tr style={{ background: '#EEF2F7' }}>
                  {['วันที่', 'สถานที่', 'ประเภท', 'ระดับ', 'สถานะ'].map(h => (
                    <th key={h} style={{
                      padding: '15px 20px',
                      textAlign: 'left',
                      color: '#64748B',
                      fontSize: 16,
                      fontWeight: 900,
                      borderBottom: '1px solid #D8E0EA',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latest.map(risk => (
                  <tr key={risk.id} onClick={() => onOpen(risk)} style={{ cursor: 'pointer', borderBottom: '1px solid #D8E0EA' }}>
                    <td style={latestTd}>{formatRiskShortDate(latestEventDateKey(risk))}</td>
                    <td style={{ ...latestTd, color: '#0F172A' }}>{risk.department_found ?? '—'}</td>
                    <td style={latestTd}><span style={latestTypeBadgeStyle(eventTypeGroup(risk))}>{eventTypeGroup(risk)}</span></td>
                    <td style={latestTd}><span style={latestSeverityBadgeStyle(risk.severity_level)}>{risk.severity_level ?? '—'}</span></td>
                    <td style={{ ...latestTd, color: '#475569' }}>{risk.ior_status ?? statusLabel(risk.status)}</td>
                  </tr>
                ))}
                {latest.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูล</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="Heatmap ก่อนแก้ไข">
          <RiskHeatmap risks={heatInitial.filter(h => historicalScoped.some(r => riskNo(r) === h.id))} />
        </Panel>
        <Panel title="Heatmap หลังแก้ไข (Residual)">
          <RiskHeatmap risks={heatResidual.filter(h => historicalScoped.some(r => riskNo(r) === h.id))} />
        </Panel>
      </div>
    </>
  )
}

function RiskClientDashboardShape() {
  return {
    open: [] as RiskWithActions[],
    actionWait: [] as RiskWithActions[],
    followWait: [] as RiskWithActions[],
    closed: [] as RiskWithActions[],
    residualHigh: [] as RiskWithActions[],
    overdue: [] as RiskWithActions[],
    needsRca: [] as RiskWithActions[],
    followItems: [] as RiskWithActions[],
  }
}

function currentThaiFiscalYear() {
  const now = new Date()
  const thaiYear = now.getFullYear() + 543
  return now.getMonth() + 1 >= 10 ? thaiYear + 1 : thaiYear
}

function riskYearOptions(selectedYear: string) {
  const current = currentThaiFiscalYear()
  return Array.from(new Set([
    current,
    current - 1,
    current - 2,
    current - 3,
    selectedYear ? Number(selectedYear) : 0,
  ].filter(Boolean))).sort((a, b) => b - a)
}

function RegisterTable({ title, scope, query, setQuery, status, setStatus, severity, setSeverity, department, setDepartment, onOpen, onMutated, canEdit, refreshKey }: {
  title: string
  scope: RiskListScope
  query: string
  setQuery: (v: string) => void
  status: string
  setStatus: (v: string) => void
  severity: string
  setSeverity: (v: string) => void
  department: string
  setDepartment: (v: string) => void
  onOpen: (risk: RiskWithActions) => void
  onMutated: () => void
  canEdit: boolean
  refreshKey: number
}) {
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [page, setPage] = useState(1)
  const [risks, setRisks] = useState<RiskWithActions[]>([])
  const [meta, setMeta] = useState<RiskListMeta>({ count: 0, page: 1, pageSize: REGISTER_PAGE_SIZE })
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const years = useMemo(() => riskYearOptions(year), [year])
  const severityOptions = useMemo(() => Array.from(new Set(SEVERITY_FILTER_ORDER)).sort(compareSeverityFilter), [])
  const totalPages = Math.max(1, Math.ceil(meta.count / meta.pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = meta.count ? (safePage - 1) * meta.pageSize + 1 : 0
  const pageEnd = Math.min(safePage * meta.pageSize, meta.count)
  const visibleRisks = risks
  const visibleIds = visibleRisks.map(r => r.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
  const someVisibleSelected = visibleIds.some(id => selected.has(id))

  const loadList = useCallback(async () => {
    setListLoading(true)
    setListError('')
    try {
      const params = new URLSearchParams({
        view: 'list',
        scope,
        page: String(page),
        pageSize: String(REGISTER_PAGE_SIZE),
      })
      if (query.trim()) params.set('q', query.trim())
      if (year) params.set('year', year)
      if (month) params.set('month', month)
      if (status) params.set('status', status)
      if (severity) params.set('severity', severity)
      if (department) params.set('department', department)

      const res = await fetch(`/api/admin/risks?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      const actions = (json.actions ?? []) as RiskAction[]
      setRisks((json.data ?? []).map((risk: Risk) => ({
        ...risk,
        actions: actions.filter(action => action.risk_id === risk.id),
      })))
      setMeta({
        count: Number(json.count ?? 0),
        page: Number(json.page ?? page),
        pageSize: Number(json.pageSize ?? REGISTER_PAGE_SIZE),
      })
    } catch (err) {
      setRisks([])
      setMeta({ count: 0, page, pageSize: REGISTER_PAGE_SIZE })
      setListError((err as Error).message)
    } finally {
      setListLoading(false)
    }
  }, [department, month, page, query, scope, severity, status, year])

  useEffect(() => { setPage(1) }, [department, month, query, severity, status, year])
  useEffect(() => { setSelected(new Set()) }, [year, month, status, severity, department, query])
  useEffect(() => {
    if (severity && !severityOptions.includes(severity)) setSeverity('')
  }, [severity, severityOptions, setSeverity])
  useEffect(() => { void loadList() }, [loadList, refreshKey])

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id))
      } else {
        visibleIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function toggleOne(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function doDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      const ids = Array.from(selected)
      const res = await fetch('/api/admin/risks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'ลบไม่สำเร็จ')
      setSelected(new Set())
      setConfirmDelete(false)
      onMutated()
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Panel title={title}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) 120px 120px 150px 120px minmax(180px, 220px)', gap: 8, marginBottom: 12 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาเลขที่ / เหตุการณ์ / หน่วยงาน" style={inputStyle} />
        <select value={year} onChange={e => setYear(e.target.value)} style={inputStyle}>
          <option value="">ทุกปีงบ</option>
          {years.map(y => <option key={y} value={y}>ปีงบ {y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)} style={inputStyle}>
          <option value="">ทุกเดือน</option>
          {THAI_MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
          <option value="">ทุกสถานะ</option>
          <option value="open">เปิดอยู่</option>
          <option value="mitigating">รอแก้ไข</option>
          <option value="monitoring">รอติดตาม</option>
          <option value="closed">ปิดแล้ว</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={inputStyle}>
          <option value="">ทุกระดับ</option>
          {severityOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle}>
          <option value="">ทุกหน่วยงาน</option>
          {LAB_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>
            แสดง {fmt(pageStart)}-{fmt(pageEnd)} จาก {fmt(meta.count)} เหตุการณ์
          </div>
          {canEdit && selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#B91C1C' }}>เลือก {fmt(selected.size)} รายการ</span>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: '#DC2626', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Icon name="trash" size={12} /> ลบที่เลือก
              </button>
              <button
                onClick={() => setSelected(new Set())}
                style={{ border: 'none', background: 'transparent', color: '#B91C1C', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700 }}
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}>ก่อนหน้า</Button>
          <span style={{ minWidth: 92, textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontWeight: 800 }}>
            หน้า {fmt(safePage)} / {fmt(totalPages)}
          </span>
          <Button variant="secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>ถัดไป</Button>
        </div>
      </div>

      {listError && (
        <div style={{ marginBottom: 10, padding: 11, borderRadius: 9, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: 12.5 }}>
          {listError}
        </div>
      )}

      <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120, fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {canEdit && (
                <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--primary)' }}
                  />
                </th>
              )}
              {['เลขที่', 'วันที่', 'เหตุการณ์', 'หน่วยงาน', 'RM', 'Initial', 'Residual', 'Trend', 'Owner', 'สถานะ'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontSize: 11, fontWeight: 900, borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listLoading && (
              <tr>
                <td colSpan={canEdit ? 11 : 10} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลดข้อมูล...</td>
              </tr>
            )}
            {!listLoading && visibleRisks.map(risk => {
              const initial = riskScore(risk.likelihood, risk.impact)
              const residual = risk.residual_score ?? riskScore(risk.residual_likelihood, risk.residual_impact)
              const isSelected = selected.has(risk.id)
              return (
                <tr
                  key={risk.id}
                  onClick={() => onOpen(risk)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'var(--primary-soft)' : 'transparent', transition: 'background .1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'var(--primary-soft)' : 'transparent' }}
                >
                  {canEdit && (
                    <td style={{ ...td, width: 40 }} onClick={e => toggleOne(risk.id, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--primary)' }}
                      />
                    </td>
                  )}
                  <td style={td}>{riskNo(risk)}</td>
                  <td style={td}>{formatThaiDate(risk.event_date ?? risk.recorded_date)}</td>
                  <td style={{ ...td, maxWidth: 340 }}>
                    <div style={{ fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.name}</div>
                    <div style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{risk.event_detail ?? risk.event_sub_category ?? '—'}</div>
                  </td>
                  <td style={td}>{risk.department_found ?? '—'}</td>
                  <td style={td}><span style={badgeStyle(colorForLevel(risk.level))}>{risk.severity_level ?? '—'}</span></td>
                  <td style={td}>{initial ?? '—'}</td>
                  <td style={td}>{residual ?? '—'}</td>
                  <td style={td}>{residualTrend(risk)}</td>
                  <td style={td}>{risk.owner ?? '—'}</td>
                  <td style={td}><span style={badgeStyle(risk.status === 'closed' ? '#16A34A' : risk.status === 'monitoring' ? '#2563EB' : '#D97706')}>{statusLabel(risk.status)}</span></td>
                </tr>
              )
            })}
            {!listLoading && visibleRisks.length === 0 && <tr><td colSpan={canEdit ? 11 : 10} style={{ padding: 34, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูล</td></tr>}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 900, color: '#DC2626', fontSize: 15 }}>ยืนยันการลบข้อมูล</div>
              <button onClick={() => { setConfirmDelete(false); setDeleteError('') }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="x" /></button>
            </div>
            <div style={{ padding: '20px 20px 8px' }}>
              <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>
                คุณกำลังจะ <strong>ลบถาวร {fmt(selected.size)} รายการ</strong> ออกจากระบบ
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 12px' }}>
                การลบนี้ไม่สามารถกู้คืนได้ และจะลบ action plan ที่เกี่ยวข้องทั้งหมดด้วย
              </div>
              {deleteError && <div style={{ marginTop: 8, fontSize: 12, color: '#B91C1C' }}>{deleteError}</div>}
            </div>
            <div style={{ padding: '12px 20px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => { setConfirmDelete(false); setDeleteError('') }} disabled={deleting}>ยกเลิก</Button>
              <Button variant="danger" icon="trash" onClick={doDelete} disabled={deleting}>
                {deleting ? 'กำลังลบ...' : `ลบ ${fmt(selected.size)} รายการ`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  )
}

const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'top' }
const latestTd: React.CSSProperties = {
  padding: '12px 20px',
  color: '#475569',
  verticalAlign: 'middle',
  fontSize: 18,
  lineHeight: 1.45,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

function RiskEventPreviewModal({ risk, onClose }: { risk: RiskWithActions; onClose: () => void }) {
  const number = riskNo(risk).replace(/^#/, '')
  const detail = risk.event_detail?.trim() || risk.impact_summary?.trim() || 'ไม่มีรายละเอียด'
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.48)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 8, overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 560, background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(15,23,42,.3)', overflow: 'hidden', marginTop: 0 }}>
        <div style={{ background: 'linear-gradient(135deg, #0EA5E9, #1AAFE8)', color: '#fff', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '.01em' }}>เหตุการณ์ #{number}</div>
          <button onClick={onClose} aria-label="ปิด" style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,.22)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: 20, background: '#fff' }}>
          <PreviewSection title="ข้อมูลทั่วไป">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <PreviewField label="วันที่เกิดเหตุ" value={formatRiskShortDate(risk.event_date)} />
              <PreviewField label="วันที่บันทึก" value={formatRiskShortDate(risk.recorded_date)} />
            </div>
            <PreviewField label="สถานที่เกิดเหตุ" value={risk.department_found} />
            <PreviewField label="หน่วยงานที่ต้องการส่งถึง" value={risk.department_target} />
          </PreviewSection>

          <PreviewSection title="ประเภทเหตุการณ์">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <PreviewField label="ประเภทความเสี่ยง" value={eventTypeGroup(risk)} />
              <PreviewField label="ระดับความรุนแรง RM" value={risk.severity_level} tone="#BAE6FD" />
            </div>
            <PreviewField label="หัวข้อหลัก" value={risk.event_main_category ?? risk.event_category} />
            <PreviewField label="หัวข้อย่อย" value={risk.event_sub_category} />
            <PreviewField label="สถานะ IOR" value={risk.ior_status ?? statusLabel(risk.status)} muted />
          </PreviewSection>

          <PreviewSection title="">
            <div style={{ border: '1px solid #BAE6FD', borderRadius: 10, overflow: 'hidden', background: '#E0F2FE' }}>
              <div style={{ padding: '10px 13px', color: '#0074B7', fontSize: 12, fontWeight: 900, background: '#D8EFFC' }}>เกิดเหตุการณ์อย่างไร</div>
              <div style={{ padding: '14px 13px', color: '#155E85', fontSize: 14, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{detail}</div>
            </div>
          </PreviewSection>
        </div>
      </div>
    </div>
  )
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: title ? '1px solid #BAE6FD' : 'none', paddingTop: title ? 16 : 0, marginTop: title ? 16 : 0 }}>
      {title && <div style={{ color: '#0074B7', fontSize: 12, fontWeight: 900, marginBottom: 10 }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  )
}

function PreviewField({ label, value, tone = '#E0F2FE', muted = false }: { label: string; value?: string | null; tone?: string; muted?: boolean }) {
  return (
    <div style={{ background: muted ? '#EFF6FB' : tone, borderRadius: 9, padding: '10px 13px', minHeight: 58 }}>
      <div style={{ color: '#0074B7', fontSize: 12, fontWeight: 900, marginBottom: 5 }}>{label}</div>
      <div style={{ color: '#155E85', fontSize: 15, lineHeight: 1.35, fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

function RiskFormModal({ initialEventType = 'near_miss', onClose, onSaved }: { initialEventType?: string; onClose: () => void; onSaved: () => void }) {
  const isRiskAssessment = initialEventType === 'risk_assessment'
  const [form, setForm] = useState<FormState>(() => {
    const initial: FormState = { event_date: today(), event_type: initialEventType, likelihood: 1, impact: 1, status: 'open' }
    return isRiskAssessment
      ? { ...initial, level: 'low', severity_level: riskAssessmentSeverity(1, 1) }
      : initial
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true)
    setError('')
    try {
      const payload = form.event_type === 'risk_assessment'
        ? {
          ...form,
          level: riskAssessmentLevel(form.likelihood, form.impact) ?? form.level,
          severity_level: riskAssessmentSeverity(form.likelihood, form.impact),
        }
        : form
      const res = await fetch('/api/admin/risks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal title="เพิ่มรายการความเสี่ยง" onClose={onClose} width={820}>
      <RiskFields form={form} setForm={setForm} />
      {error && <div style={{ color: '#B91C1C', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
        <Button variant="primary" icon="check" onClick={save} disabled={saving}>บันทึก</Button>
      </div>
    </Modal>
  )
}

function RiskDetailModal({ risk, onClose, onSaved }: { risk: RiskWithActions; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(risk)
  const [action, setAction] = useState<ActionDraft>({ action_type: 'corrective', status: 'open' })
  const [error, setError] = useState('')

  async function patch(body: Record<string, unknown>) {
    setError('')
    const res = await fetch(`/api/admin/risks/${risk.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'บันทึกไม่สำเร็จ')
  }

  async function saveMain() {
    try { await patch(form as Record<string, unknown>); onSaved() } catch (err) { setError((err as Error).message) }
  }

  async function addAction() {
    if (!action.description) return
    setError('')
    const res = await fetch(`/api/admin/risks/${risk.id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'เพิ่ม action ไม่สำเร็จ'); return }
    onSaved()
  }

  async function markDone(item: RiskAction) {
    const res = await fetch(`/api/admin/risks/${risk.id}/actions`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status: 'done', effectiveness_note: item.effectiveness_note }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'อัปเดต action ไม่สำเร็จ'); return }
    onSaved()
  }

  async function saveResidual() {
    const res = await fetch(`/api/admin/risks/${risk.id}/residual-risk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      residual_likelihood: Number(form.residual_likelihood),
      residual_impact: Number(form.residual_impact),
      risk_accepted_by: form.risk_accepted_by,
      effectiveness_result: form.effectiveness_result,
    }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'บันทึก Residual Risk ไม่สำเร็จ'); return }
    onSaved()
  }

  async function closeRisk() {
    const res = await fetch(`/api/admin/risks/${risk.id}/close`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'ปิดประเด็นไม่สำเร็จ'); return }
    onSaved()
  }

  return (
    <Modal title={`${riskNo(risk)} · ${risk.name}`} onClose={onClose} width={980}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 16 }}>
        <div>
          <SectionTitle text="ข้อมูลเหตุการณ์ / Review / RCA" />
          <RiskFields form={form} setForm={setForm} compact />
          <Field label="ผู้ได้รับผลกระทบ / Impact Summary">
            <textarea value={form.impact_summary ?? ''} onChange={e => setForm({ ...form, impact_summary: e.target.value })} style={textareaStyle} />
          </Field>
          <Field label="Root Cause">
            <textarea value={form.root_cause ?? ''} onChange={e => setForm({ ...form, root_cause: e.target.value })} style={textareaStyle} />
          </Field>
          <Field label="มาตรการเพิ่มเติม / Review Note">
            <textarea value={form.review_note ?? ''} onChange={e => setForm({ ...form, review_note: e.target.value })} style={textareaStyle} />
          </Field>
          <Field label="เอกสารอ้างอิง / Evidence">
            <textarea value={form.evidence_note ?? ''} onChange={e => setForm({ ...form, evidence_note: e.target.value })} style={textareaStyle} />
          </Field>
          <Field label="ผลการติดตามประสิทธิผล">
            <textarea value={form.effectiveness_result ?? ''} onChange={e => setForm({ ...form, effectiveness_result: e.target.value })} style={textareaStyle} />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="secondary" icon="check" onClick={saveMain}>บันทึกข้อมูลหลัก</Button>
            <Button variant="primary" icon="shieldCheck" onClick={closeRisk}>ปิดประเด็น</Button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Residual Risk">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Residual Likelihood">
                <select value={form.residual_likelihood ?? ''} onChange={e => setForm({ ...form, residual_likelihood: Number(e.target.value) })} style={inputStyle}>{SCORE_OPTIONS.map(v => <option key={v} value={v}>{v || '-'}</option>)}</select>
              </Field>
              <Field label="Residual Impact">
                <select value={form.residual_impact ?? ''} onChange={e => setForm({ ...form, residual_impact: Number(e.target.value) })} style={inputStyle}>{SCORE_OPTIONS.map(v => <option key={v} value={v}>{v || '-'}</option>)}</select>
              </Field>
            </div>
            <Field label="ผู้ยอมรับความเสี่ยง">
              <input value={form.risk_accepted_by ?? ''} onChange={e => setForm({ ...form, risk_accepted_by: e.target.value })} style={inputStyle} />
            </Field>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...badgeStyle(colorForLevel(riskLevel(riskScore(form.residual_likelihood, form.residual_impact)))) }}>
                Score {riskScore(form.residual_likelihood, form.residual_impact) ?? '-'} · {riskLevel(riskScore(form.residual_likelihood, form.residual_impact)) ?? 'ยังไม่ประเมิน'}
              </span>
              <Button variant="secondary" icon="check" onClick={saveResidual}>บันทึก Residual</Button>
            </div>
          </Panel>
          <Panel title="Action Plan / Follow-up">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {risk.actions.map(item => (
                <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 12.5, color: 'var(--ink)' }}>{item.description}</strong>
                    <span style={badgeStyle(item.status === 'done' ? '#16A34A' : '#D97706')}>{item.status}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>{item.action_type} · {item.owner ?? 'ไม่ระบุ'} · due {item.due_date ?? '-'}</div>
                  {item.status !== 'done' && <button onClick={() => markDone(item)} style={{ marginTop: 8, border: 'none', background: 'transparent', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer' }}>mark done</button>}
                </div>
              ))}
              <select value={action.action_type ?? 'corrective'} onChange={e => setAction({ ...action, action_type: e.target.value as RiskAction['action_type'] })} style={inputStyle}>
                <option value="correction">Correction</option>
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
                <option value="follow_up">Follow-up</option>
              </select>
              <textarea value={action.description ?? ''} onChange={e => setAction({ ...action, description: e.target.value })} placeholder="รายละเอียด action/follow-up" style={textareaStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={action.owner ?? ''} onChange={e => setAction({ ...action, owner: e.target.value })} placeholder="owner" style={inputStyle} />
                <input type="date" value={action.due_date ?? ''} onChange={e => setAction({ ...action, due_date: e.target.value })} style={inputStyle} />
              </div>
              <Button variant="secondary" icon="plus" onClick={addAction}>เพิ่ม Action</Button>
            </div>
          </Panel>
        </div>
      </div>
      {error && <div style={{ marginTop: 12, color: '#B91C1C', fontSize: 12 }}>{error}</div>}
    </Modal>
  )
}

function RiskFields({ form, setForm, compact = false }: { form: FormState; setForm: (form: FormState) => void; compact?: boolean }) {
  const isRiskAssessment = form.event_type === 'risk_assessment'
  const currentLevel = riskAssessmentLevel(form.likelihood, form.impact)
  const currentSeverity = riskLevelText(currentLevel) || '-'
  const updateForm = (patch: FormState) => {
    const next = { ...form, ...patch }
    if (next.event_type === 'risk_assessment') {
      const nextLevel = riskAssessmentLevel(next.likelihood, next.impact)
      setForm({
        ...next,
        level: nextLevel ?? next.level,
        severity_level: riskLevelText(nextLevel) || next.severity_level,
      })
      return
    }
    setForm(next)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
      <Field label="รหัสความเสี่ยง"><input value={form.risk_no ?? ''} onChange={e => updateForm({ risk_no: e.target.value })} style={inputStyle} /></Field>
      <Field label={isRiskAssessment ? 'วันที่ประเมิน' : 'วันที่เกิดเหตุ'}><input type="date" max={today()} value={form.event_date ?? ''} onChange={e => updateForm({ event_date: e.target.value })} style={inputStyle} /></Field>
      <Field label="ประเภท"><select value={form.event_type ?? ''} onChange={e => updateForm({ event_type: e.target.value })} style={inputStyle}>{RISK_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
      {isRiskAssessment ? (
        <Field label="ระดับความเสี่ยง">
          <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
            <span>{currentSeverity}</span>
            <span style={badgeStyle(colorForLevel(currentLevel))}>Score {riskScore(form.likelihood, form.impact) ?? '-'}</span>
          </div>
        </Field>
      ) : (
        <Field label="RM Severity"><select value={form.severity_level ?? ''} onChange={e => updateForm({ severity_level: e.target.value, requires_rca: requiresRca(e.target.value) })} style={inputStyle}>{SEVERITIES.map(s => <option key={s} value={s}>{s || '-'}</option>)}</select></Field>
      )}
      <Field label="ผู้รายงาน"><input value={form.reporter_name ?? ''} onChange={e => updateForm({ reporter_name: e.target.value })} style={inputStyle} /></Field>
      <Field label="ตำแหน่ง"><select value={form.reporter_position ?? ''} onChange={e => updateForm({ reporter_position: e.target.value })} style={inputStyle}><option value="">-</option>{REPORTER_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select></Field>
      <Field label={isRiskAssessment ? 'หน่วยงาน' : 'หน่วยงานที่พบ'}><select value={form.department_found ?? ''} onChange={e => updateForm({ department_found: e.target.value })} style={inputStyle}><option value="">-</option>{LAB_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}</select></Field>
      <Field label="ส่งถึง"><input value={form.department_target ?? ''} onChange={e => updateForm({ department_target: e.target.value })} style={inputStyle} /></Field>
      <Field label="Likelihood"><select value={form.likelihood ?? ''} onChange={e => updateForm({ likelihood: Number(e.target.value) })} style={inputStyle}>{SCORE_OPTIONS.map(v => <option key={v} value={v}>{v || '-'}</option>)}</select></Field>
      <Field label="Impact"><select value={form.impact ?? ''} onChange={e => updateForm({ impact: Number(e.target.value) })} style={inputStyle}>{SCORE_OPTIONS.map(v => <option key={v} value={v}>{v || '-'}</option>)}</select></Field>
      <Field label="Owner"><input value={form.owner ?? ''} onChange={e => updateForm({ owner: e.target.value })} style={inputStyle} /></Field>
      <Field label="Due Date"><input type="date" value={form.due_date ?? ''} onChange={e => updateForm({ due_date: e.target.value })} style={inputStyle} /></Field>
      <Field label="Follow-up Date"><input type="date" value={form.follow_up_date ?? ''} onChange={e => updateForm({ follow_up_date: e.target.value })} style={inputStyle} /></Field>
      <div style={{ gridColumn: compact ? '1 / -1' : 'span 2' }}>
        <Field label={isRiskAssessment ? 'กิจกรรม/ความเสี่ยง' : 'เหตุการณ์'}>
          {isRiskAssessment ? (
            <input value={form.event_category ?? ''} onChange={e => updateForm({ event_category: e.target.value, name: e.target.value })} style={inputStyle} />
          ) : (
            <select value={form.event_category ?? ''} onChange={e => updateForm({ event_category: e.target.value, name: e.target.value })} style={inputStyle}><option value="">-</option>{NEAR_MISS_EVENTS.map(e => <option key={e} value={e}>{e}</option>)}</select>
          )}
        </Field>
      </div>
      <div style={{ gridColumn: '1 / -1' }}><Field label={isRiskAssessment ? 'Risk statement' : 'รายละเอียดเหตุการณ์'}><textarea value={form.event_detail ?? ''} onChange={e => updateForm({ event_detail: e.target.value, name: form.name || e.target.value.slice(0, 120) })} style={textareaStyle} /></Field></div>
      <div style={{ gridColumn: '1 / -1' }}><Field label={isRiskAssessment ? 'Existing controls' : 'การแก้ไขเฉพาะหน้า'}><textarea value={form.immediate_correction ?? ''} onChange={e => updateForm({ immediate_correction: e.target.value })} style={textareaStyle} /></Field></div>
    </div>
  )
}

function RiskImportModal({ mode, onClose, onImported }: { mode: ImportMode; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<{ inserted: number; updated: number; skipped: number; total?: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function pick(file: File | null) {
    if (!file) return
    setError('')
    setStatus('กำลังอ่านไฟล์...')
    setResult(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
      const ws = wb.Sheets['All Risk'] ?? wb.Sheets[wb.SheetNames[0]]
      const mapWs = wb.Sheets['Sheet1']
      const departmentMap = new Map<string, string>()
      if (mapWs) {
        const mapRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(mapWs, { defval: '' })
        for (const row of mapRows) {
          const full = String(row['คอลัมน์1'] ?? '').trim()
          const short = String(row['คอลัมน์2'] ?? '').trim()
          if (full && short) departmentMap.set(full, short)
        }
      }
      const normalizeDept = (value: unknown) => {
        const text = String(value ?? '').trim()
        return departmentMap.get(text) ?? text
      }
      const cell = (row: Record<string, unknown>, ...keys: string[]) => {
        for (const key of keys) {
          const value = row[key]
          if (value !== undefined && value !== null && String(value).trim() !== '') return value
        }
        return ''
      }
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      if (mode === 'ior') {
        const mapped = raw.map(row => ({
          external_no: '',
          event_type: cell(row, 'event_type', 'ประเภท') || 'near_miss',
          event_date: normalizeIsoDate(cell(row, 'event_date', 'วันที่เกิดเหตุ', 'Date')),
          department_found: normalizeDept(cell(row, 'department_found', 'หน่วยงานที่พบ', 'สถานที่เกิดเหตุ', 'Department')),
          department_target: normalizeDept(cell(row, 'department_target', 'ส่งถึง', 'หน่วยงานที่ต้องการส่งถึง')),
          risk_type: cell(row, 'risk_type', 'ประเภทความเสี่ยง'),
          event_main_category: cell(row, 'event_main_category', 'หัวข้อหลัก'),
          event_sub_category: cell(row, 'event_sub_category', 'หัวข้อย่อย'),
          event_category: cell(row, 'event_category', 'เหตุการณ์'),
          severity_level: cell(row, 'severity_level', 'RM Severity', 'ระดับความรุนแรง RM'),
          event_detail: cell(row, 'event_detail', 'รายละเอียดเหตุการณ์', 'เกิดเหตุการณ์อย่างไร'),
          immediate_correction: cell(row, 'immediate_correction', 'การแก้ไขเฉพาะหน้า'),
          reporter_name: cell(row, 'reporter_name', 'ผู้รายงาน'),
          reporter_position: cell(row, 'reporter_position', 'ตำแหน่ง'),
          owner: cell(row, 'owner', 'Owner'),
          due_date: normalizeIsoDate(cell(row, 'due_date', 'Due Date')),
          follow_up_date: normalizeIsoDate(cell(row, 'follow_up_date', 'Follow-up Date')),
          likelihood: cell(row, 'likelihood', 'Likelihood'),
          impact: cell(row, 'impact', 'Impact'),
          recorded_date: normalizeIsoDate(cell(row, 'recorded_date', 'วันที่บันทึก')),
        })).filter(row => row.event_detail)
        setRows(mapped)
        setStatus(`อ่านไฟล์สำเร็จ พร้อมนำเข้า ${mapped.length.toLocaleString()} rows`)
        return
      }
      if (mode === 'register') {
        const mapped = raw.map(row => ({
          external_no: '',
          risk_no: cell(row, 'risk_no', 'รหัสความเสี่ยง (เช่น BIO-01)'),
          event_type: 'risk_assessment',
          event_date: normalizeIsoDate(cell(row, 'event_date', 'วันที่ประเมิน', 'วันที่เกิดเหตุ')) ?? today(),
          department_found: normalizeDept(cell(row, 'department_found', 'หน่วยงาน', 'หน่วยงานที่พบ', 'สถานที่เกิดเหตุ')),
          risk_type: cell(row, 'risk_type', 'หมวดอันตราย (A–H)', 'หมวดอันตราย (A-H)', 'ประเภทความเสี่ยง'),
          event_main_category: cell(row, 'event_main_category', 'กิจกรรมที่อาจเป็นความเสี่ยงที่ก่อให้เกิดความไม่ปลอดภัย', 'หัวข้อหลัก'),
          event_sub_category: cell(row, 'event_sub_category', 'กระบวนการ/จุดงาน (เช่น รับสิ่งส่งตรวจ, ปั่นเหวี่ยง, ย้อมสไลด์, ทิ้งขยะ)', 'หัวข้อย่อย'),
          event_category: cell(row, 'event_category', 'กิจกรรมที่อาจเป็นความเสี่ยงที่ก่อให้เกิดความไม่ปลอดภัย', 'เหตุการณ์'),
          severity_level: cell(row, 'severity_level', 'ระดับความเสี่ยง (ต่ำ/กลาง/สูง)', 'RM Severity', 'ระดับความรุนแรง RM'),
          event_detail: cell(row, 'event_detail', 'เหตุการณ์ความเสี่ยงที่อาจเกิด (Risk statement) (ตัวอย่าง: “ถ้า…จะทำให้…”)', 'Risk statement', 'รายละเอียดเหตุการณ์'),
          impact_summary: cell(row, 'impact_summary', 'ผู้ได้รับผลกระทบ: เจ้าหน้าที่/ผู้ป่วย/ผู้มาเยี่ยม/สิ่งแวดล้อม'),
          root_cause: cell(row, 'root_cause', 'สาเหตุหลัก (causes)'),
          immediate_correction: cell(row, 'immediate_correction', 'มาตรการที่มีอยู่ (Existing controls)', 'Existing controls'),
          review_note: cell(row, 'review_note', 'มาตรการเพิ่มเติมที่ต้องทำ (Additional controls)', 'Additional controls'),
          evidence_note: cell(row, 'evidence_note', 'เอกสารอ้างอิง (SOP/WI/แบบฟอร์ม/บันทึกอบรม/SDS)'),
          effectiveness_result: cell(row, 'effectiveness_result', 'ความเสี่ยงคงเหลือ (Residual risk) หลังทำมาตรการ (L’×S’)'),
          owner: cell(row, 'owner', 'ผู้รับผิดชอบ', 'Owner'),
          likelihood: cell(row, 'likelihood', 'L = โอกาสเกิด (1–5)', 'Likelihood'),
          impact: cell(row, 'impact', 'S = ความรุนแรง (1–5)', 'Impact'),
          recorded_date: normalizeIsoDate(cell(row, 'recorded_date', 'วันที่บันทึก')) ?? today(),
        })).filter(row => row.event_detail)
        setRows(mapped)
        setStatus(`อ่านไฟล์สำเร็จ พร้อมนำเข้า ${mapped.length.toLocaleString()} rows`)
        return
      }
      const mapped = raw.map(row => ({
        external_no: String(row['หมายเลข'] ?? '').trim(),
        event_date: normalizeIsoDate(row['วันที่เกิดเหตุ']),
        department_found: normalizeDept(row['สถานที่เกิดเหตุ']),
        department_target: normalizeDept(row['หน่วยงานที่ต้องการส่งถึง']),
        risk_type: row['ประเภทความเสี่ยง'],
        event_main_category: row['ประเภทของเหตุการณ์ หัวข้อหลัก'],
        event_sub_category: row['ประเภทของเหตุการณ์ หัวข้อย่อย'],
        severity_level: row['ระดับความรุนแรง RM'],
        event_detail: row['เกิดเหตุการณ์อย่างไร'],
        ior_status: row['สถานะ IOR'],
        recorded_date: normalizeIsoDate(row['วันที่บันทึก']),
      })).filter(row => row.event_detail)
      setRows(mapped)
      setStatus(`อ่านไฟล์สำเร็จ พร้อมนำเข้า ${mapped.length.toLocaleString()} rows`)
    } catch (err) {
      setError((err as Error).message)
      setStatus('')
    }
  }

  async function commit() {
    setUploading(true)
    setError('')
    setStatus(`กำลังนำเข้า ${rows.length.toLocaleString()} rows... กรุณารอสักครู่`)
    try {
      const res = await fetch('/api/admin/risks/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? json.errors?.join(', ') ?? 'Import ไม่สำเร็จ')
      setResult({ inserted: Number(json.inserted ?? 0), updated: Number(json.updated ?? 0), skipped: Number(json.skipped ?? 0), total: Number(json.total ?? rows.length) })
      setStatus(`นำเข้าสำเร็จ ${Number(json.total ?? rows.length).toLocaleString()} rows`)
      setTimeout(onImported, 900)
    } catch (err) {
      setError((err as Error).message)
      setStatus('นำเข้าไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title={mode === 'smart' ? 'Import Smart-RM' : mode === 'register' ? 'Import Risk Register' : 'Import IOR'} onClose={onClose} width={760}>
      <div onClick={() => inputRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 12, padding: 26, textAlign: 'center', cursor: 'pointer', background: 'var(--surface-2)' }}>
        <Icon name="upload" size={24} />
        <div style={{ marginTop: 8, fontWeight: 800, color: 'var(--ink)' }}>{mode === 'smart' ? 'เลือกไฟล์ .xlsx / .csv จาก template Smart-RM' : mode === 'register' ? 'เลือกไฟล์ Risk Register ตาม template วิเคราะห์ความเสี่ยงและความไม่ปลอดภัย' : 'เลือกไฟล์ .xlsx / .csv ที่ใช้หัวคอลัมน์เหมือนฟอร์มเพิ่มรายการ'}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{mode === 'smart' ? 'อ่าน sheet `All Risk` และใช้ `Sheet1` เพื่อย่อชื่อหน่วยงาน' : mode === 'register' ? 'อ่านรหัสความเสี่ยง หมวดอันตราย กิจกรรม Risk statement L S Existing/Additional controls และ Residual risk' : 'รองรับ event_date, department_found, event_detail, likelihood, impact, due_date และชื่อคอลัมน์ภาษาไทยในฟอร์ม'}</div>
        {mode === 'smart' && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{SMART_RM_HEADERS.join(' · ')}</div>}
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => void pick(e.target.files?.[0] ?? null)} />
      </div>
      {rows.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Preview {fmt(rows.length)} rows</div>
          <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720, fontSize: 12 }}>
              <tbody>
                {rows.slice(0, 8).map((row, i) => <tr key={i}><td style={td}>{String(row.external_no ?? '')}</td><td style={td}>{String(row.event_date ?? '')}</td><td style={td}>{String(row.severity_level ?? '')}</td><td style={td}>{String(row.event_detail ?? '').slice(0, 120)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {error && <div style={{ marginTop: 12, color: '#B91C1C', fontSize: 12 }}>{error}</div>}
      {status && (
        <div style={{ marginTop: 12, padding: 11, borderRadius: 9, background: uploading ? '#EFF6FF' : result ? '#F0FDF4' : 'var(--surface-2)', color: uploading ? '#1D4ED8' : result ? '#15803D' : 'var(--muted)', fontSize: 12.5, fontWeight: 700 }}>
          {uploading && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, border: '2px solid #BFDBFE', borderTopColor: '#2563EB', marginRight: 8, verticalAlign: -1 }} />}
          {status}
          {result && <span> · เพิ่มใหม่ {result.inserted.toLocaleString()} · ข้ามข้อมูลซ้ำ {result.skipped.toLocaleString()}</span>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={onClose} disabled={uploading}>ยกเลิก</Button>
        <Button variant="primary" icon="upload" onClick={commit} disabled={rows.length === 0 || uploading}>{uploading ? 'กำลัง Import...' : 'Import'}</Button>
      </div>
    </Modal>
  )
}

function RiskBarChart({ data, color = '#0EA5E9', palette = false }: { data: { name: string; value: number }[]; color?: string; palette?: boolean }) {
  return (
    <div style={{ height: 280, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart layout="vertical" data={data} margin={{ top: 2, right: 24, bottom: 0, left: 8 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
          <Tooltip formatter={(value) => [fmt(Number(value)), 'เหตุการณ์']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
          <Bar dataKey="value" radius={[0, 5, 5, 0]}>
            {data.map((_, i) => <Cell key={i} fill={palette ? RISK_PALETTE[i % RISK_PALETTE.length] : color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Kpi({ label, value, icon, tone, sub }: { label: string; value: number; icon: string; tone: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800 }}>{label}</div>
          <div style={{ color: tone, fontSize: 25, fontWeight: 900, marginTop: 6 }}>{fmt(value)}</div>
          {sub && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 3 }}>{sub}</div>}
        </div>
        <div style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, background: `${tone}14`, color: tone }}>
          <Icon name={icon} size={16} />
        </div>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, minWidth: 0 }}>
      <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 900, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  )
}

function SectionTitle({ text }: { text: string }) {
  return <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 900, marginBottom: 10 }}>{text}</div>
}

function Modal({ title, onClose, width, children }: { title: string; onClose: () => void; width: number; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.48)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: width, background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(15,23,42,.25)' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 900, color: 'var(--ink)', fontSize: 15 }}>{title}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="x" /></button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  )
}
