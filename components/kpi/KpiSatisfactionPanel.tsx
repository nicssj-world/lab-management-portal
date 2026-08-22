'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { SatisfactionDialog } from '@/components/satisfaction/SatisfactionDialog'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'

type Source = 'survey' | 'manual'
type SourceFilter = 'all' | Source
type ResultStatus = 'pass' | 'below' | 'missing'
type StatusFilter = 'all' | ResultStatus

interface KpiHistoryValue {
  fiscalYear: number
  value: number | null
  source: Source
  sourceNote: string | null
  responseCount: number | null
  campaignId: string | null
  publishedAt: string | null
  publishedByName: string | null
}

interface KpiCurrentValue extends KpiHistoryValue {
  campaignName: string | null
  departmentName: string | null
  surveyCode: string | null
}

interface KpiMetricDashboardRow {
  code: string
  name: string
  target: number
  isActive: boolean
  status: ResultStatus
  current: KpiCurrentValue | null
  previousValue: number | null
  delta: number | null
  history: KpiHistoryValue[]
}

interface KpiDashboardPayload {
  fiscalYear: number
  years: number[]
  summary: { activeMetrics: number; pass: number; below: number; missing: number; pendingPublication: number }
  metrics: KpiMetricDashboardRow[]
  permissions: { canViewCampaign: boolean }
}

interface MetricMasterRow {
  code: string
  name: string
  target: number
  isActive: boolean
  campaignCount: number
  valueCount: number
}

interface Props {
  canEdit: boolean
  initialFiscalYear?: number
  initialMetricCode?: string
  manageOpen?: boolean
  manualOpen?: boolean
  onManageClose?: () => void
  onManualClose?: () => void
}

const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const dateTimeFormat = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' })

function valueLabel(value: number | null): string {
  return value === null ? '—' : `${numberFormat.format(value)}%`
}

function sourceLabel(source: Source): string {
  return source === 'survey' ? 'จากแบบสำรวจ' : 'กรอกด้วยตนเอง'
}

function resultLabel(status: ResultStatus): string {
  if (status === 'pass') return 'ผ่านเป้าหมาย'
  if (status === 'below') return 'ต่ำกว่าเป้าหมาย'
  return 'ยังไม่มีผล'
}

function normalizeMetricMaster(payload: unknown): MetricMasterRow[] {
  const root = payload && typeof payload === 'object' && 'metrics' in payload ? (payload as { metrics?: unknown }).metrics : payload
  if (!Array.isArray(root)) return []
  return root.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const code = String(row.code ?? row.metric_code ?? '')
    const name = String(row.name ?? row.metric_name ?? '')
    if (!code || !name) return []
    return [{
      code,
      name,
      target: Number(row.target ?? row.target_val ?? 80),
      isActive: Boolean(row.isActive ?? row.is_active ?? true),
      campaignCount: Number(row.campaignCount ?? row.campaign_count ?? 0),
      valueCount: Number(row.valueCount ?? row.value_count ?? row.historyCount ?? row.history_count ?? 0),
    }]
  })
}

export function KpiSatisfactionPanel({
  canEdit,
  initialFiscalYear = getCurrentThaiFiscalYear(),
  initialMetricCode = '',
  manageOpen = false,
  manualOpen = false,
  onManageClose = () => undefined,
  onManualClose = () => undefined,
}: Props) {
  const [fiscalYear, setFiscalYear] = useState(initialFiscalYear)
  const [metricCode, setMetricCode] = useState(initialMetricCode)
  const [selectedMetricCode, setSelectedMetricCode] = useState(initialMetricCode)
  const [metricOptions, setMetricOptions] = useState<MetricMasterRow[]>([])
  const [source, setSource] = useState<SourceFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [data, setData] = useState<KpiDashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const load = useCallback(async (background = false) => {
    const sequence = ++requestSequence.current
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')
    const params = new URLSearchParams({ fiscalYear: String(fiscalYear) })
    if (metricCode) params.set('metricCode', metricCode)
    if (source !== 'all') params.set('source', source)
    if (status !== 'all') params.set('status', status)
    try {
      const response = await fetch(`/kpi/api/satisfaction?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'ไม่สามารถโหลด KPI ความพึงพอใจได้')
      if (sequence !== requestSequence.current) return
      setData(payload as KpiDashboardPayload)
    } catch (caught) {
      if (sequence !== requestSequence.current) return
      setError(caught instanceof Error ? caught.message : 'ไม่สามารถโหลด KPI ความพึงพอใจได้')
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [fiscalYear, metricCode, source, status])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let active = true
    fetch('/kpi/api/satisfaction/metrics', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (active) setMetricOptions(normalizeMetricMaster(payload)) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'satisfaction')
    params.set('fiscalYear', String(fiscalYear))
    if (selectedMetricCode) params.set('metricCode', selectedMetricCode)
    else params.delete('metricCode')
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [fiscalYear, selectedMetricCode])

  const selectedMetric = useMemo(
    () => data?.metrics.find((metric) => metric.code === selectedMetricCode) ?? data?.metrics[0] ?? null,
    [data, selectedMetricCode],
  )
  const years = data?.years?.length ? [...data.years].sort((a, b) => b - a) : [fiscalYear]

  return (
    <section className="kpi-satisfaction-dashboard" aria-labelledby="kpi-satisfaction-title">
      <header className="kpi-satisfaction-heading">
        <div>
          <h2 id="kpi-satisfaction-title">KPI ความพึงพอใจ</h2>
          <p>ผลที่รับรองแล้วจากแบบสำรวจและแหล่งข้อมูลอื่น พร้อมเกณฑ์เป้าหมายเดียวกันทุกปี</p>
        </div>
        <div className="kpi-satisfaction-refresh" aria-live="polite">
          {refreshing ? 'กำลังอัปเดตข้อมูล…' : 'ข้อมูลตามปีงบประมาณที่เลือก'}
          <Button variant="secondary" size="sm" icon="clock" onClick={() => void load(true)} disabled={refreshing}>รีเฟรช</Button>
        </div>
      </header>

      <div className="kpi-satisfaction-toolbar" aria-label="ตัวกรอง KPI ความพึงพอใจ">
        <label><span>ปีงบประมาณ</span><input type="number" min="2500" max="2999" value={fiscalYear} onChange={(event) => setFiscalYear(Number(event.target.value))} /></label>
        <label><span>ชุด KPI</span><select value={metricCode} onChange={(event) => { setMetricCode(event.target.value); setSelectedMetricCode(event.target.value) }}><option value="">ทุกชุด</option>{(metricOptions.length ? metricOptions : data?.metrics ?? []).map((metric) => <option key={metric.code} value={metric.code}>{metric.name}</option>)}</select></label>
        <label><span>แหล่งข้อมูล</span><select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}><option value="all">ทั้งหมด</option><option value="survey">จากแบบสำรวจ</option><option value="manual">กรอกด้วยตนเอง</option></select></label>
        <label><span>สถานะ</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">ทั้งหมด</option><option value="pass">ผ่านเป้าหมาย</option><option value="below">ต่ำกว่าเป้าหมาย</option><option value="missing">ยังไม่มีผล</option></select></label>
      </div>

      {error ? <div className="kpi-satisfaction-error" role="alert"><div><strong>โหลดข้อมูลไม่สำเร็จ</strong><span>{error}</span></div><Button variant="secondary" size="sm" onClick={() => void load()}>ลองอีกครั้ง</Button></div> : null}

      {loading && !data ? <KpiLoading /> : data ? (
        <>
          <div className="kpi-satisfaction-summary-grid" aria-label={`ภาพรวมปีงบประมาณ ${data.fiscalYear}`}>
            <SummaryButton label="KPI ที่ใช้งาน" value={data.summary.activeMetrics} active={status === 'all'} onClick={() => setStatus('all')} icon="dash" />
            <SummaryButton label="ผ่านเป้าหมาย" value={data.summary.pass} active={status === 'pass'} onClick={() => setStatus('pass')} icon="check" tone="pass" />
            <SummaryButton label="ต่ำกว่าเป้าหมาย" value={data.summary.below} active={status === 'below'} onClick={() => setStatus('below')} icon="alert" tone="below" />
            <SummaryButton label="ยังไม่มีผล" value={data.summary.missing} active={status === 'missing'} onClick={() => setStatus('missing')} icon="clock" tone="missing" />
            <div className="kpi-satisfaction-summary-item kpi-satisfaction-summary-pending"><span className="kpi-satisfaction-summary-icon"><Icon name="upload" size={17} /></span><span><strong>{data.summary.pendingPublication.toLocaleString('th-TH')}</strong><small>รอเผยแพร่</small></span></div>
          </div>

          {data.metrics.length === 0 ? (
            <div className="kpi-satisfaction-empty"><Icon name="filter" size={24} /><strong>ไม่พบข้อมูลตามตัวกรอง</strong><span>ลองเปลี่ยนปี ชุด KPI แหล่งข้อมูล หรือสถานะ</span><Button variant="secondary" size="sm" onClick={() => { setMetricCode(''); setSelectedMetricCode(''); setSource('all'); setStatus('all') }}>ล้างตัวกรอง</Button></div>
          ) : (
            <>
              <section className="kpi-satisfaction-section" aria-labelledby="kpi-target-comparison">
                <div className="kpi-satisfaction-section-heading"><div><h3 id="kpi-target-comparison">ผลเทียบเป้าหมาย</h3><p>ค่าปัจจุบันของแต่ละชุด KPI ในปีงบประมาณ {data.fiscalYear}</p></div><span className="kpi-satisfaction-legend"><i /> ค่าผลลัพธ์ <b /> เกณฑ์เป้าหมาย</span></div>
                <div className="kpi-satisfaction-bullet-list">{data.metrics.map((metric) => <MetricBullet key={metric.code} metric={metric} canViewCampaign={data.permissions.canViewCampaign} selected={selectedMetric?.code === metric.code} onSelect={() => setSelectedMetricCode(metric.code)} />)}</div>
              </section>
              {selectedMetric ? <MetricTrend metric={selectedMetric} /> : null}
              <section className="kpi-satisfaction-section" aria-labelledby="kpi-history-heading">
                <div className="kpi-satisfaction-section-heading"><div><h3 id="kpi-history-heading">ประวัติรายปี</h3><p>ปีล่าสุดอยู่ก่อน และทุกปีประเมินด้วย target ปัจจุบันของชุด KPI</p></div></div>
                <HistoryTable metrics={data.metrics} years={years} />
                <MobileHistory metrics={data.metrics} years={years} />
              </section>
            </>
          )}
        </>
      ) : null}

      {manageOpen && canEdit ? <MetricManager onClose={onManageClose} onSaved={() => void load(true)} /> : null}
      {manualOpen && canEdit ? <ManualValueDialog metrics={metricOptions.length ? metricOptions : data?.metrics ?? []} initialYear={fiscalYear} onClose={onManualClose} onSaved={() => void load(true)} /> : null}
    </section>
  )
}

function SummaryButton({ label, value, active, onClick, icon, tone = 'neutral' }: { label: string; value: number; active: boolean; onClick: () => void; icon: string; tone?: 'neutral' | 'pass' | 'below' | 'missing' }) {
  return <button type="button" className={`kpi-satisfaction-summary-item kpi-satisfaction-summary-${tone}`} aria-pressed={active} onClick={onClick}><span className="kpi-satisfaction-summary-icon"><Icon name={icon} size={17} /></span><span><strong>{value.toLocaleString('th-TH')}</strong><small>{label}</small></span></button>
}

function MetricBullet({ metric, selected, canViewCampaign, onSelect }: { metric: KpiMetricDashboardRow; selected: boolean; canViewCampaign: boolean; onSelect: () => void }) {
  const current = metric.current
  const value = current?.value ?? null
  const width = value === null ? 0 : Math.max(2, Math.min(100, value))
  const target = Math.max(0, Math.min(100, metric.target))
  const pass = value !== null && value >= metric.target
  return (
    <article className={`kpi-satisfaction-bullet${selected ? ' is-selected' : ''}`}>
      <button type="button" className="kpi-satisfaction-bullet-main" aria-pressed={selected} onClick={onSelect}>
        <span className="kpi-satisfaction-bullet-copy"><span><strong>{metric.name}</strong><code>{metric.code}</code></span><span className={`kpi-satisfaction-result kpi-satisfaction-result-${metric.status}`}><Icon name={pass ? 'check' : metric.status === 'missing' ? 'clock' : 'alert'} size={13} />{resultLabel(metric.status)}</span></span>
        <span className="kpi-satisfaction-track" aria-label={`${metric.name} ${valueLabel(value)} เป้าหมาย ${valueLabel(metric.target)}`}><span className={`kpi-satisfaction-fill ${pass ? 'is-pass' : 'is-below'}`} style={{ width: `${width}%` }} /><i className="kpi-satisfaction-target" style={{ insetInlineStart: `${target}%` }}><span>≥{numberFormat.format(metric.target)}%</span></i></span>
      </button>
      <div className="kpi-satisfaction-bullet-meta">
        <strong>{valueLabel(value)}</strong>
        {metric.delta === null ? <span>ยังไม่มีข้อมูลปีก่อน</span> : <span className={metric.delta >= 0 ? 'is-positive' : 'is-negative'}>{metric.delta >= 0 ? '+' : ''}{numberFormat.format(metric.delta)} จุดจากปีก่อน</span>}
        {current ? <span className={`kpi-satisfaction-source source-${current.source}`}>{sourceLabel(current.source)}</span> : null}
        {current?.responseCount !== null && current?.responseCount !== undefined ? <span>n = {current.responseCount.toLocaleString('th-TH')}{current.responseCount < 5 ? ' · ข้อมูลยังน้อย' : ''}</span> : null}
        {current?.departmentName ? <span>{current.departmentName}</span> : null}
        {current?.surveyCode ? <span>แบบ {current.surveyCode}</span> : null}
        {current?.publishedByName ? <span>เผยแพร่โดย {current.publishedByName}</span> : null}
        {current?.publishedAt ? <span>{dateTimeFormat.format(new Date(current.publishedAt))}</span> : null}
        {current?.campaignId && canViewCampaign ? <Link href={`/staff/satisfaction?campaignId=${encodeURIComponent(current.campaignId)}`}>{current.campaignName ?? 'ดูรอบแบบสำรวจ'}</Link> : null}
      </div>
    </article>
  )
}

function MetricTrend({ metric }: { metric: KpiMetricDashboardRow }) {
  const valuedHistory = [...metric.history].filter((row): row is KpiHistoryValue & { value: number } => row.value !== null)
  const chartData = valuedHistory.sort((a, b) => a.fiscalYear - b.fiscalYear).map((row) => {
    const previous = valuedHistory.find((candidate) => candidate.fiscalYear === row.fiscalYear - 1)
    return {
      year: row.fiscalYear,
      value: row.value,
      source: sourceLabel(row.source),
      delta: previous ? Math.round((row.value - previous.value + Number.EPSILON) * 100) / 100 : null,
    }
  })
  const useLine = chartData.length >= 4
  return (
    <section className="kpi-satisfaction-section kpi-satisfaction-trend" aria-labelledby="kpi-trend-heading">
      <div className="kpi-satisfaction-section-heading"><div><h3 id="kpi-trend-heading">แนวโน้มข้ามปี</h3><p>{metric.name} · เป้าหมาย ≥{numberFormat.format(metric.target)}%</p></div><span className={`kpi-satisfaction-result kpi-satisfaction-result-${metric.status}`}>{resultLabel(metric.status)}</span></div>
      {chartData.length === 0 ? <div className="kpi-satisfaction-chart-empty">ยังไม่มีผลลัพธ์สำหรับสร้างแนวโน้ม</div> : (
        <>
          <div className="kpi-satisfaction-chart" role="img" aria-label={`แนวโน้ม ${metric.name} เทียบเป้าหมาย ${numberFormat.format(metric.target)} เปอร์เซ็นต์`}>
            <ResponsiveContainer width="100%" height="100%">
              {useLine ? (
                <LineChart data={chartData} margin={{ top: 18, right: 20, bottom: 4, left: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={34} /><Tooltip formatter={(value) => [`${numberFormat.format(Number(value))}%`, 'ผลลัพธ์']} labelFormatter={(year) => `ปีงบประมาณ ${year}`} /><ReferenceLine y={metric.target} stroke="var(--warning)" strokeDasharray="5 4" label={{ value: `เป้าหมาย ${numberFormat.format(metric.target)}%`, fill: 'var(--muted)', fontSize: 11 }} /><Line type="linear" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--card)', strokeWidth: 2 }} activeDot={{ r: 6 }} /></LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 18, right: 20, bottom: 4, left: 0 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="year" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={34} /><Tooltip formatter={(value) => [`${numberFormat.format(Number(value))}%`, 'ผลลัพธ์']} labelFormatter={(year) => `ปีงบประมาณ ${year}`} /><ReferenceLine y={metric.target} stroke="var(--warning)" strokeDasharray="5 4" label={{ value: `เป้าหมาย ${numberFormat.format(metric.target)}%`, fill: 'var(--muted)', fontSize: 11 }} /><Bar dataKey="value" fill="var(--primary)" radius={[7, 7, 0, 0]} maxBarSize={54} /></BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <table className="satisfaction-chart-table"><caption className="satisfaction-visually-hidden">ตารางแนวโน้ม KPI ความพึงพอใจข้ามปี</caption><thead><tr><th scope="col">ปีงบประมาณ</th><th scope="col">ผลลัพธ์</th><th scope="col">เปลี่ยนจากปีก่อน</th><th scope="col">แหล่งข้อมูล</th></tr></thead><tbody>{[...chartData].reverse().map((point) => <tr key={point.year}><td>{point.year}</td><td>{valueLabel(point.value)}</td><td>{point.delta === null ? '—' : `${point.delta >= 0 ? '+' : ''}${numberFormat.format(point.delta)} จุด`}</td><td>{point.source}</td></tr>)}</tbody></table>
        </>
      )}
    </section>
  )
}

function HistoryTable({ metrics, years }: { metrics: KpiMetricDashboardRow[]; years: number[] }) {
  return <div className="kpi-satisfaction-history-wrap"><table className="kpi-satisfaction-history-table"><caption className="satisfaction-visually-hidden">ประวัติ KPI ความพึงพอใจรายปี</caption><thead><tr><th scope="col">ชุด KPI / Target</th>{years.map((year) => <th scope="col" key={year}>ปีงบ {year}</th>)}</tr></thead><tbody>{metrics.map((metric) => <tr key={metric.code}><th scope="row"><strong>{metric.name}</strong><span>≥{numberFormat.format(metric.target)}%</span></th>{years.map((year) => { const entry = metric.history.find((row) => row.fiscalYear === year); const state: ResultStatus = entry?.value === null || entry?.value === undefined ? 'missing' : entry.value >= metric.target ? 'pass' : 'below'; return <td key={year}><strong>{valueLabel(entry?.value ?? null)}</strong><span className={`kpi-satisfaction-result kpi-satisfaction-result-${state}`}>{resultLabel(state)}</span>{entry ? <small>{sourceLabel(entry.source)}</small> : null}</td> })}</tr>)}</tbody></table></div>
}

function MobileHistory({ metrics, years }: { metrics: KpiMetricDashboardRow[]; years: number[] }) {
  return <div className="kpi-satisfaction-mobile-history">{metrics.map((metric) => <article key={metric.code}><header><strong>{metric.name}</strong><span>Target ≥{numberFormat.format(metric.target)}%</span></header><dl>{years.map((year) => { const entry = metric.history.find((row) => row.fiscalYear === year); return <div key={year}><dt>ปีงบ {year}</dt><dd><strong>{valueLabel(entry?.value ?? null)}</strong>{entry ? <span>{sourceLabel(entry.source)}</span> : <span>ยังไม่มีผล</span>}</dd></div> })}</dl></article>)}</div>
}

function MetricManager({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [metrics, setMetrics] = useState<MetricMasterRow[]>([])
  const [baselineTargets, setBaselineTargets] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [target, setTarget] = useState('80')
  const [loading, setLoading] = useState(true)
  const [savingCode, setSavingCode] = useState('')
  const [error, setError] = useState('')

  const loadMetrics = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/kpi/api/satisfaction/metrics', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'โหลดชุด KPI ไม่สำเร็จ')
      const rows = normalizeMetricMaster(payload)
      setMetrics(rows)
      setBaselineTargets(Object.fromEntries(rows.map((row) => [row.code, row.target])))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'โหลดชุด KPI ไม่สำเร็จ') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void loadMetrics() }, [loadMetrics])

  async function createMetric(event: React.FormEvent) {
    event.preventDefault(); setSavingCode('new'); setError('')
    try {
      const response = await fetch('/kpi/api/satisfaction/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), target: Number(target) }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'สร้างชุด KPI ไม่สำเร็จ')
      setName(''); setTarget('80'); await loadMetrics(); onSaved()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'สร้างชุด KPI ไม่สำเร็จ') }
    finally { setSavingCode('') }
  }

  async function updateMetric(metric: MetricMasterRow, nextActive = metric.isActive) {
    if (metric.target < 0 || metric.target > 100) { setError('Target ต้องอยู่ระหว่าง 0–100'); return }
    if (baselineTargets[metric.code] !== metric.target && !window.confirm('การเปลี่ยน target จะคำนวณสถานะผ่าน/ไม่ผ่านย้อนหลังทุกปี ยืนยันการเปลี่ยนแปลงหรือไม่?')) return
    setSavingCode(metric.code); setError('')
    try {
      const response = await fetch('/kpi/api/satisfaction/metrics', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: metric.code, name: metric.name.trim(), target: metric.target, isActive: nextActive }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'แก้ไขชุด KPI ไม่สำเร็จ')
      await loadMetrics(); onSaved()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'แก้ไขชุด KPI ไม่สำเร็จ') }
    finally { setSavingCode('') }
  }

  return <SatisfactionDialog labelledBy="kpi-metric-manager-title" onClose={onClose} className="kpi-satisfaction-dialog"><div className="kpi-satisfaction-dialog-header"><div><h2 id="kpi-metric-manager-title">จัดการชุดตัวชี้วัด</h2><p>Target หนึ่งค่าใช้ประเมินผลทุกปี</p></div><button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose}><Icon name="x" size={18} /></button></div><form className="kpi-satisfaction-create-metric" onSubmit={createMetric}><label><span>ชื่อชุด KPI</span><input data-dialog-autofocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น ผู้รับบริการห้องปฏิบัติการ" /></label><label><span>Target (%)</span><input required type="number" min="0" max="100" step="0.01" value={target} onChange={(event) => setTarget(event.target.value)} /></label><Button type="submit" icon="plus" disabled={savingCode === 'new'}>{savingCode === 'new' ? 'กำลังสร้าง…' : 'สร้างชุด KPI'}</Button></form>{error ? <div className="kpi-satisfaction-dialog-error" role="alert">{error}</div> : null}<div className="kpi-satisfaction-metric-list" aria-busy={loading}>{loading ? <span>กำลังโหลดชุด KPI…</span> : metrics.map((metric, index) => <div className="kpi-satisfaction-metric-editor" key={metric.code}><div><code>{metric.code}</code><small>{metric.campaignCount.toLocaleString('th-TH')} รอบ · {metric.valueCount.toLocaleString('th-TH')} ปีข้อมูล</small></div><label><span className="satisfaction-visually-hidden">ชื่อ {metric.code}</span><input value={metric.name} onChange={(event) => setMetrics((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} /></label><label><span className="satisfaction-visually-hidden">Target {metric.code}</span><input type="number" min="0" max="100" step="0.01" value={metric.target} onChange={(event) => setMetrics((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, target: Number(event.target.value) } : row))} /></label><Button size="sm" variant="secondary" onClick={() => void updateMetric(metric)} disabled={savingCode === metric.code}>บันทึก</Button><Button size="sm" variant={metric.isActive ? 'ghost' : 'soft'} onClick={() => void updateMetric(metric, !metric.isActive)} disabled={savingCode === metric.code}>{metric.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</Button></div>)}</div></SatisfactionDialog>
}

function ManualValueDialog({ metrics, initialYear, onClose, onSaved }: { metrics: Array<Pick<MetricMasterRow, 'code' | 'name' | 'isActive'>>; initialYear: number; onClose: () => void; onSaved: () => void }) {
  const [metricCode, setMetricCode] = useState(metrics[0]?.code ?? '')
  const [fiscalYear, setFiscalYear] = useState(initialYear)
  const [value, setValue] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch('/kpi/api/satisfaction/manual-values', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metricCode, fiscalYear, value: Number(value), sourceNote: sourceNote.trim() }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error ?? 'บันทึกค่าจากแหล่งอื่นไม่สำเร็จ')
      onSaved(); onClose()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'บันทึกค่าจากแหล่งอื่นไม่สำเร็จ') }
    finally { setSaving(false) }
  }
  return <SatisfactionDialog labelledBy="kpi-manual-value-title" onClose={onClose} className="kpi-satisfaction-dialog kpi-satisfaction-manual-dialog"><div className="kpi-satisfaction-dialog-header"><div><h2 id="kpi-manual-value-title">เพิ่มค่าจากแหล่งอื่น</h2><p>ใช้ได้เฉพาะปีที่ไม่มี campaign จองชุด KPI นี้</p></div><button type="button" aria-label="ปิดหน้าต่าง" onClick={onClose}><Icon name="x" size={18} /></button></div><form className="kpi-satisfaction-manual-form" onSubmit={submit}><label><span>ชุด KPI</span><select data-dialog-autofocus required value={metricCode} onChange={(event) => setMetricCode(event.target.value)}><option value="" disabled>เลือกชุด KPI</option>{metrics.filter((metric) => metric.isActive).map((metric) => <option key={metric.code} value={metric.code}>{metric.name}</option>)}</select></label><div className="kpi-satisfaction-form-grid"><label><span>ปีงบประมาณ</span><input required type="number" min="2500" max="2999" value={fiscalYear} onChange={(event) => setFiscalYear(Number(event.target.value))} /></label><label><span>ผลลัพธ์ (%)</span><input required type="number" min="0" max="100" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} /></label></div><label><span>หมายเหตุแหล่งข้อมูล</span><textarea required maxLength={500} rows={3} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} placeholder="ระบุที่มา วิธีรวบรวม หรือเอกสารอ้างอิง" /></label>{error ? <div className="kpi-satisfaction-dialog-error" role="alert">{error}</div> : null}<div className="kpi-satisfaction-dialog-actions"><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button type="submit" icon="check" disabled={saving || !metricCode}>{saving ? 'กำลังบันทึก…' : 'บันทึกค่า'}</Button></div></form></SatisfactionDialog>
}

function KpiLoading() {
  return <div className="kpi-satisfaction-loading" aria-live="polite"><span>กำลังโหลด KPI ความพึงพอใจ…</span>{[0, 1, 2].map((item) => <i key={item} />)}</div>
}
