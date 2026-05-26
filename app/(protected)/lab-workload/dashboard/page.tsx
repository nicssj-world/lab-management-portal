'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { getCurrentThaiFiscalYear, getThaiMonthLabel } from '@/lib/kpi-utils'

const DOW_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const COLORS = ['#1E5FAD', '#16A34A', '#D97706', '#9333EA', '#0F766E', '#DC2626', '#475569', '#2563EB']
const OPD_TAB = 'งานบริการผู้ป่วยนอก'

interface MonthRef { year: number; month: number }
interface Kpi { total_ln: number; total_test_rows: number; department_count: number; opd_hn: number }
interface DepartmentRow { section: string; ln_count: number; test_rows: number; test_count: number }
interface TrendRow { year: number; month: number; ln_count: number; test_rows: number }
interface HeatCell { dow: number; hour: number; count: number }
interface PhlebZone { labzone_name: string; hn_count: number }
interface OpdRow { labzone_name: string; months: Record<string, number>; total: number }
type MetricMode = 'ln' | 'rows'
interface TestMonth { in_time: number; total: number; row_in_time: number; row_total: number }
interface TestWorkloadRow {
  test_name: string
  code: string | null
  price: number | null
  current_total: number
  current_test_rows: number
  fiscal_total: number
  fiscal_test_rows: number
  months: Record<string, TestMonth>
}
interface WorkloadData {
  fiscal_year: number
  selected_year: number
  selected_month: number
  months: MonthRef[]
  kpi: Kpi
  departments: DepartmentRow[]
  trend: TrendRow[]
  heatmap: HeatCell[]
  phlebotomy_zones: PhlebZone[]
  opd_rows: OpdRow[]
  phleb_heatmap: HeatCell[]
  section_details: Record<string, TestWorkloadRow[]>
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

function fmt(n: number) {
  return n.toLocaleString()
}

function StatCard({ label, value, sub, icon, color }: {
  label: string
  value: string
  sub?: string
  icon: string
  color: string
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
          <div style={{ fontSize: 28, color: 'var(--ink)', fontWeight: 800, marginTop: 8, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: color, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={17} />
        </div>
      </div>
    </div>
  )
}

function Panel({ title, subtitle, children, accent = 'var(--primary)' }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  )
}

function Heatmap({ cells, tooltipLabel }: { cells: HeatCell[]; tooltipLabel: string }) {
  const map = new Map(cells.map(c => [`${c.dow}-${c.hour}`, c.count]))
  const max = Math.max(1, ...cells.map(c => c.count))
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px repeat(7, minmax(34px, 1fr))', gap: 2, minWidth: 360 }}>
        <div />
        {DOW_LABELS.map(d => <div key={d} style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center', fontWeight: 700 }}>{d}</div>)}
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} style={{ display: 'contents' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right', paddingRight: 4 }}>{String(hour).padStart(2, '0')}</div>
            {Array.from({ length: 7 }, (_, dow) => {
              const count = map.get(`${dow}-${hour}`) ?? 0
              const t = count / max
              const r = Math.round(241 + (30 - 241) * t)
              const g = Math.round(245 + (95 - 245) * t)
              const b = Math.round(249 + (173 - 249) * t)
              return (
                <div
                  key={`${dow}-${hour}`}
                  title={count ? `${DOW_LABELS[dow]} ${String(hour).padStart(2, '0')}:00 - ${fmt(count)} ${tooltipLabel}` : undefined}
                  style={{ height: 15, borderRadius: 3, border: '1px solid var(--border)', background: count ? `rgb(${r},${g},${b})` : 'var(--surface-2)' }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function metricValue(row: TestWorkloadRow, key: string, mode: MetricMode) {
  const value = row.months[key] ?? { in_time: 0, total: 0, row_in_time: 0, row_total: 0 }
  return mode === 'ln' ? value.total : value.row_total
}

function rowFiscalTotal(row: TestWorkloadRow, months: MonthRef[], mode: MetricMode) {
  return months.reduce((sum, m) => sum + metricValue(row, monthKey(m.year, m.month), mode), 0)
}

function exportSectionCsv(section: string, rows: TestWorkloadRow[], months: MonthRef[], mode: MetricMode) {
  const metricLabel = mode === 'ln' ? 'Total LN' : 'Test rows'
  const headers = ['รายการตรวจ', ...months.map(m => `${getThaiMonthLabel(m.month)} ${metricLabel}`), 'Total']
  const lines = [
    headers,
    ...rows.map(row => [
      row.test_name,
      ...months.map(m => metricValue(row, monthKey(m.year, m.month), mode)),
      rowFiscalTotal(row, months, mode),
    ]),
    ['Total', ...months.map(m => rows.reduce((sum, row) => sum + metricValue(row, monthKey(m.year, m.month), mode), 0)), rows.reduce((sum, row) => sum + rowFiscalTotal(row, months, mode), 0)],
  ]
  const csv = lines
    .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lab-workload-${section}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportOpdCsv(rows: OpdRow[], months: MonthRef[]) {
  const headers = ['หน่วยเจาะเลือด', ...months.map(m => `${getThaiMonthLabel(m.month)} ครั้งบริการ`), 'Total']
  const lines = [
    headers,
    ...rows.map(row => [
      row.labzone_name,
      ...months.map(m => row.months[monthKey(m.year, m.month)] ?? 0),
      row.total,
    ]),
    ['Total', ...months.map(m => rows.reduce((sum, row) => sum + (row.months[monthKey(m.year, m.month)] ?? 0), 0)), rows.reduce((sum, row) => sum + row.total, 0)],
  ]
  const csv = lines
    .map(line => line.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lab-workload-opd.csv'
  a.click()
  URL.revokeObjectURL(url)
}

async function exportSectionXlsx(section: string, rows: TestWorkloadRow[], months: MonthRef[], mode: MetricMode) {
  const XLSX = await import('xlsx')
  const metricLabel = mode === 'ln' ? 'Total LN' : 'Test rows'
  const aoa: (string | number)[][] = [
    [`ตารางปริมาณงาน: ${section}`],
    ['รายการตรวจ', ...months.map(m => getThaiMonthLabel(m.month)), 'Total'],
    ['', ...months.map(() => metricLabel), ''],
    ...rows.map(row => [
      row.test_name,
      ...months.map(m => metricValue(row, monthKey(m.year, m.month), mode)),
      rowFiscalTotal(row, months, mode),
    ]),
    ['Total', ...months.map(m => rows.reduce((sum, row) => sum + metricValue(row, monthKey(m.year, m.month), mode), 0)), rows.reduce((sum, row) => sum + rowFiscalTotal(row, months, mode), 0)],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: months.length + 1 } },
    ...months.map((_, i) => ({ s: { r: 1, c: i + 1 }, e: { r: 1, c: i + 1 } })),
  ]
  ws['!cols'] = [{ wch: 42 }, ...months.map(() => ({ wch: 12 })), { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, section.slice(0, 31))
  XLSX.writeFile(wb, `lab-workload-${section}-${mode}.xlsx`)
}

async function exportOpdXlsx(rows: OpdRow[], months: MonthRef[]) {
  const XLSX = await import('xlsx')
  const aoa: (string | number)[][] = [
    ['ตารางงานบริการผู้ป่วยนอก'],
    ['หน่วยเจาะเลือด', ...months.map(m => getThaiMonthLabel(m.month)), 'Total'],
    ['', ...months.map(() => 'ครั้งบริการ'), ''],
    ...rows.map(row => [
      row.labzone_name,
      ...months.map(m => row.months[monthKey(m.year, m.month)] ?? 0),
      row.total,
    ]),
    ['Total', ...months.map(m => rows.reduce((sum, row) => sum + (row.months[monthKey(m.year, m.month)] ?? 0), 0)), rows.reduce((sum, row) => sum + row.total, 0)],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: months.length + 1 } }]
  ws['!cols'] = [{ wch: 42 }, ...months.map(() => ({ wch: 12 })), { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'OPD Workload')
  XLSX.writeFile(wb, 'lab-workload-opd.xlsx')
}

function buildOverviewRows(data: WorkloadData) {
  const sectionRows = Object.entries(data.section_details)
    .map(([section, rows]) => {
      const values = Object.fromEntries(data.months.map(m => {
        const key = monthKey(m.year, m.month)
        return [key, rows.reduce((sum, row) => sum + metricValue(row, key, 'ln'), 0)]
      }))
      return {
        section,
        months: values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
      }
    })
    .filter(row => row.total > 0)

  const opdValues = Object.fromEntries(data.months.map(m => {
    const key = monthKey(m.year, m.month)
    return [key, (data.opd_rows ?? []).reduce((sum, row) => sum + (row.months[key] ?? 0), 0)]
  }))
  const opdTotal = Object.values(opdValues).reduce((sum, value) => sum + value, 0)

  return [
    ...sectionRows.sort((a, b) => b.total - a.total),
    ...(opdTotal > 0 ? [{ section: 'งานบริการผู้ป่วยนอก (HN)', months: opdValues, total: opdTotal }] : []),
  ]
}

async function exportOverviewXlsx(data: WorkloadData) {
  const XLSX = await import('xlsx')
  const rows = buildOverviewRows(data)
  const monthTotals = data.months.map(m => rows.reduce((sum, row) => sum + (row.months[monthKey(m.year, m.month)] ?? 0), 0))
  const grandTotal = monthTotals.reduce((sum, value) => sum + value, 0)
  const aoa: (string | number)[][] = [
    [`สรุปรวมภาระงานห้องปฏิบัติการ ปีงบ ${data.fiscal_year}`],
    ['งาน', ...data.months.map(m => getThaiMonthLabel(m.month)), 'Total'],
    ...rows.map(row => [
      row.section,
      ...data.months.map(m => row.months[monthKey(m.year, m.month)] ?? 0),
      row.total,
    ]),
    ['Total', ...monthTotals, grandTotal],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: data.months.length + 1 } }]
  ws['!cols'] = [{ wch: 34 }, ...data.months.map(() => ({ wch: 12 })), { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Workload Summary')
  XLSX.writeFile(wb, `lab-workload-summary-${data.fiscal_year}.xlsx`)
}

const WORKLOAD_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000

function readWorkloadClientCache(key: string): WorkloadData | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { expiresAt: number; data: WorkloadData }
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeWorkloadClientCache(key: string, data: WorkloadData) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      expiresAt: Date.now() + WORKLOAD_CLIENT_CACHE_TTL_MS,
      data,
    }))
  } catch {}
}

async function readJsonResponse(res: Response) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 300) || `HTTP ${res.status}` }
  }
}

export default function WorkloadDashboardPage() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [activeTab, setActiveTab] = useState('ภาพรวม')
  const metricMode: MetricMode = 'ln'
  const [data, setData] = useState<WorkloadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError('')
    let usedCache = false
    try {
      const cacheKey = `lab-workload-summary:v13:${year}:${month}`
      const cached = readWorkloadClientCache(cacheKey)
      if (cached) {
        usedCache = true
        setData(cached)
        setLoading(false)
      } else {
        setLoading(true)
      }
      const res = await fetch(`/api/admin/lab-workload/summary?year=${year}&month=${month}`, { signal: ctrl.signal })
      const json = await readJsonResponse(res)
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      const nextData = json as WorkloadData
      writeWorkloadClientCache(cacheKey, nextData)
      setData(nextData)
      setActiveTab(prev => prev === 'ภาพรวม' || prev === OPD_TAB || json.departments.some((d: DepartmentRow) => d.section === prev) ? prev : 'ภาพรวม')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message)
        if (!usedCache) setData(null)
      }
    } finally {
      if (abortRef.current === ctrl) setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  const tabs = useMemo(() => ['ภาพรวม', OPD_TAB, ...(data?.departments.map(d => d.section) ?? [])], [data])
  const currentSection = activeTab === 'ภาพรวม' ? null : activeTab
  const currentRows = currentSection && currentSection !== OPD_TAB ? (data?.section_details[currentSection] ?? []) : []
  const currentDept = currentSection && currentSection !== OPD_TAB ? data?.departments.find(d => d.section === currentSection) : null
  const monthTotals = data?.months.map(m => currentRows.reduce((sum, row) => sum + metricValue(row, monthKey(m.year, m.month), metricMode), 0)) ?? []
  const grandTotal = monthTotals.reduce((sum, value) => sum + value, 0)
  const opdMonthTotals = data?.months.map(m => (data.opd_rows ?? []).reduce((sum, row) => sum + (row.months[monthKey(m.year, m.month)] ?? 0), 0)) ?? []
  const opdGrandTotal = opdMonthTotals.reduce((sum, value) => sum + value, 0)
  const overviewRows = data ? buildOverviewRows(data) : []
  const overviewMonthTotals = data?.months.map(m => overviewRows.reduce((sum, row) => sum + (row.months[monthKey(m.year, m.month)] ?? 0), 0)) ?? []
  const overviewGrandTotal = overviewMonthTotals.reduce((sum, value) => sum + value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="Lab Workload"
        title="ภาระงานห้องปฏิบัติการ"
        subtitle="ใช้ข้อมูลจากไฟล์ TAT และไฟล์เจาะเลือดที่อัพโหลดไว้แล้ว"
        actions={<Button
          variant="secondary"
          icon="download"
          onClick={() => {
            if (!data) return
            if (activeTab === 'ภาพรวม') void exportOverviewXlsx(data)
            else if (activeTab === OPD_TAB) void exportOpdXlsx(data.opd_rows ?? [], data.months)
            else if (currentSection) void exportSectionXlsx(currentSection, currentRows, data.months, metricMode)
          }}
          disabled={!data || (activeTab === OPD_TAB ? (data.opd_rows ?? []).length === 0 : activeTab === 'ภาพรวม' ? overviewRows.length === 0 : currentRows.length === 0)}
        >Export</Button>}
      />

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Icon name="filter" size={14} style={{ color: 'var(--muted)' }} />
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12 }}
        >
          {[getCurrentThaiFiscalYear(), getCurrentThaiFiscalYear() - 1, getCurrentThaiFiscalYear() - 2].map(y => <option key={y} value={y}>ปีงบ {y}</option>)}
        </select>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 14px', borderRadius: 999, border: '1px solid var(--border)',
                background: activeTab === tab ? 'var(--primary)' : 'var(--card)',
                color: activeTab === tab ? '#fff' : 'var(--ink)',
                fontWeight: activeTab === tab ? 700 : 600,
                fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลดข้อมูล workload...</div>}
      {!loading && error && <div style={{ padding: 18, borderRadius: 12, border: '1px solid #fecaca', background: '#fef2f2', color: 'var(--danger)' }}>{error}</div>}

      {!loading && data && activeTab === 'ภาพรวม' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatCard label="จำนวนตัวอย่าง" value={fmt(data.kpi.total_ln)} sub="LN ไม่ซ้ำ" icon="flask" color="rgba(30,95,173,.12)" />
            <StatCard label="จำนวนรายการตรวจ" value={fmt(data.kpi.total_test_rows)} sub="test rows หลังแยกรายการตรวจ" icon="beaker" color="rgba(147,51,234,.12)" />
            <StatCard label="จำนวนงาน" value={fmt(data.kpi.department_count)} sub="ตาม lab section" icon="building" color="rgba(22,163,74,.12)" />
            <StatCard label="บริการผู้ป่วยนอก" value={fmt(data.kpi.opd_hn)} sub="ครั้งบริการเจาะเลือด" icon="syringe" color="rgba(217,119,6,.12)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 12 }}>
            <Panel title="Trend รายเดือน" subtitle="จำนวนตัวอย่าง LN ไม่ซ้ำ และจำนวนรายการตรวจ">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={data.trend} margin={{ top: 6, right: 32, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey={(row: TrendRow) => `${getThaiMonthLabel(row.month)} ${String(row.year + 543).slice(2)}`} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted)' }} width={55} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} width={55} />
                  <Tooltip formatter={(value, name) => [fmt(Number(value)), String(name)]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="ln_count" name="LN ไม่ซ้ำ" fill="#1E5FAD" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="test_rows" name="รายการตรวจ" stroke="#D97706" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="แยกตามหน่วยงาน" subtitle="จำนวน LN ไม่ซ้ำในเดือนที่เลือก" accent="#9333EA">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={data.departments.slice(0, 10)} margin={{ top: 0, right: 50, bottom: 0, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis type="category" dataKey="section" width={118} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                  <Tooltip formatter={(value) => [fmt(Number(value)), 'LN']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Bar dataKey="ln_count" name="LN" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10.5, fill: 'var(--muted)', formatter: (v: unknown) => fmt(Number(v)) }}>
                    {data.departments.slice(0, 10).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Panel title="Heatmap ปริมาณตัวอย่าง" subtitle="นับ LN ไม่ซ้ำตามเวลารับ specimen">
              <Heatmap cells={data.heatmap} tooltipLabel="LN" />
            </Panel>
            <Panel title="งานบริการผู้ป่วยนอก" subtitle="จำนวนครั้งบริการตามหน่วยเจาะเลือดหลัก" accent="#D97706">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={data.phlebotomy_zones} margin={{ top: 0, right: 50, bottom: 0, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis type="category" dataKey="labzone_name" width={145} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                  <Tooltip formatter={(value) => [fmt(Number(value)), 'ครั้งบริการ']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Bar dataKey="hn_count" name="ครั้งบริการ" fill="#1E5FAD" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10.5, fill: 'var(--muted)', formatter: (v: unknown) => fmt(Number(v)) }} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel title="ตารางสรุปรวม" subtitle="ปริมาณ workload รวม แยกตามงานและเดือน ปีงบประมาณ" accent="#FBBF24">
            <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980, fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={thStyle({ background: '#FFF4CC', minWidth: 260 })}>งาน</th>
                    {data.months.map(m => (
                      <th key={monthKey(m.year, m.month)} style={thStyle({ background: '#DCEBFA', textAlign: 'right', minWidth: 88 })}>
                        {getThaiMonthLabel(m.month)}
                      </th>
                    ))}
                    <th style={thStyle({ background: '#FFF4CC', textAlign: 'right', minWidth: 110 })}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewRows.map(row => (
                    <tr key={row.section}>
                      <td style={tdStyle({ fontWeight: 800, background: '#FFFFFF' })}>{row.section}</td>
                      {data.months.map(m => (
                        <td key={`${row.section}-${monthKey(m.year, m.month)}`} style={tdStyle({ textAlign: 'right', background: '#EAF2FD', fontWeight: 700 })}>
                          {fmt(row.months[monthKey(m.year, m.month)] ?? 0)}
                        </td>
                      ))}
                      <td style={tdStyle({ textAlign: 'right', background: '#FFF4CC', fontWeight: 900 })}>{fmt(row.total)}</td>
                    </tr>
                  ))}
                  {overviewRows.length > 0 && (
                    <tr>
                      <td style={tdStyle({ textAlign: 'center', background: '#FBBF24', fontWeight: 900, fontSize: 14 })}>Total</td>
                      {overviewMonthTotals.map((total, i) => (
                        <td key={`${data.months[i].year}-${data.months[i].month}-overview-total`} style={tdStyle({ textAlign: 'right', background: '#FBBF24', fontWeight: 900, fontSize: 14 })}>
                          {fmt(total)}
                        </td>
                      ))}
                      <td style={tdStyle({ textAlign: 'right', background: '#FB923C', fontWeight: 900, fontSize: 14 })}>{fmt(overviewGrandTotal)}</td>
                    </tr>
                  )}
                  {overviewRows.length === 0 && (
                    <tr><td colSpan={2 + data.months.length} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {!loading && data && activeTab === OPD_TAB && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatCard label="ครั้งบริการผู้ป่วยนอก" value={fmt(opdGrandTotal)} sub="รวมรายเดือนตามหน่วยหลัก" icon="syringe" color="rgba(30,95,173,.12)" />
            <StatCard label="หน่วยเจาะเลือด" value={fmt(data.opd_rows.length)} sub="แสดงเฉพาะหน่วยหลัก" icon="building" color="rgba(22,163,74,.12)" />
            <StatCard label="เดือนที่เลือก" value={getThaiMonthLabel(month)} sub={`ปีงบ ${year}`} icon="clock" color="rgba(217,119,6,.12)" />
            <StatCard label="ครั้งบริการเดือนนี้" value={fmt(opdMonthTotals[data.months.findIndex(m => m.month === month)] ?? 0)} sub="รวมทุกหน่วยหลัก" icon="users" color="rgba(147,51,234,.12)" />
          </div>

          <Panel title="ตารางงานบริการผู้ป่วยนอก" subtitle="จำนวนครั้งบริการ แยกตามหน่วยเจาะเลือดหลักและเดือน" accent="#D97706">
            <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#FFF4CC' }}>
                    <th rowSpan={2} style={thStyle({ minWidth: 360 })}>หน่วยเจาะเลือด</th>
                    {data.months.map(m => (
                      <th key={monthKey(m.year, m.month)} style={thStyle({ background: '#DCEBFA', textAlign: 'center', minWidth: 76 })}>{getThaiMonthLabel(m.month)}</th>
                    ))}
                    <th rowSpan={2} style={thStyle({ background: '#BFE7D1', textAlign: 'right', minWidth: 92 })}>Total</th>
                  </tr>
                  <tr style={{ background: '#EAF2FD' }}>
                    {data.months.map(m => (
                      <th key={`${monthKey(m.year, m.month)}-visits`} style={thStyle({ textAlign: 'right' })}>ครั้งบริการ</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.opd_rows.map(row => (
                    <tr key={row.labzone_name} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle({ fontWeight: 700, color: 'var(--ink)' })}>{row.labzone_name}</td>
                      {data.months.map(m => (
                        <td key={`${row.labzone_name}-${monthKey(m.year, m.month)}`} style={tdStyle({ textAlign: 'right', background: '#F3F8FF', fontWeight: 700 })}>
                          {fmt(row.months[monthKey(m.year, m.month)] ?? 0)}
                        </td>
                      ))}
                      <td style={tdStyle({ textAlign: 'right', background: '#DFF5E8', fontWeight: 900 })}>{fmt(row.total)}</td>
                    </tr>
                  ))}
                  {data.opd_rows.length > 0 && (
                    <tr>
                      <td style={tdStyle({ background: '#FFF4CC', fontWeight: 900, textAlign: 'center', fontSize: 14 })}>Total</td>
                      {opdMonthTotals.map((total, i) => (
                        <td key={`${data.months[i].year}-${data.months[i].month}-opd-total`} style={tdStyle({ textAlign: 'right', background: '#FFF4CC', fontWeight: 900, fontSize: 14 })}>{fmt(total)}</td>
                      ))}
                      <td style={tdStyle({ textAlign: 'right', background: '#BFE7D1', fontWeight: 900, fontSize: 14 })}>{fmt(opdGrandTotal)}</td>
                    </tr>
                  )}
                  {data.opd_rows.length === 0 && (
                    <tr><td colSpan={2 + data.months.length} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {!loading && data && currentSection && currentSection !== OPD_TAB && currentDept && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <StatCard label="จำนวนตัวอย่างของงาน" value={fmt(currentDept.ln_count)} sub="LN ไม่ซ้ำ" icon="flask" color="rgba(30,95,173,.12)" />
            <StatCard label="จำนวนรายการตรวจ" value={fmt(currentDept.test_rows)} sub="test rows" icon="beaker" color="rgba(147,51,234,.12)" />
            <StatCard label="รายการตรวจ" value={fmt(currentDept.test_count)} sub="test name ไม่ซ้ำ" icon="doc" color="rgba(22,163,74,.12)" />
            <StatCard label="เดือนที่เลือก" value={getThaiMonthLabel(month)} sub={`ปีงบ ${year}`} icon="clock" color="rgba(217,119,6,.12)" />
          </div>

          <Panel title={`ตารางปริมาณงาน: ${currentSection}`} subtitle="จำนวนตัวอย่างแบบ LN ไม่ซ้ำ แยกตามรายการตรวจและเดือน" accent="#1E5FAD">
            <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880, fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#FFF4CC' }}>
                    <th rowSpan={2} style={thStyle({ minWidth: 340 })}>รายการตรวจ</th>
                    {data.months.map(m => (
                      <th key={monthKey(m.year, m.month)} style={thStyle({ background: '#DCEBFA', textAlign: 'center', minWidth: 76 })}>{getThaiMonthLabel(m.month)}</th>
                    ))}
                    <th rowSpan={2} style={thStyle({ background: '#FFF4CC', textAlign: 'right', minWidth: 92 })}>Total</th>
                  </tr>
                  <tr style={{ background: '#EAF2FD' }}>
                    {data.months.map(m => (
                      <th key={`${monthKey(m.year, m.month)}-total`} style={thStyle({ textAlign: 'right' })}>Total LN</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentRows.map(row => (
                    <tr key={row.test_name} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle({ fontWeight: 600, color: 'var(--ink)' })}>{row.test_name}</td>
                      {data.months.map(m => {
                        const value = metricValue(row, monthKey(m.year, m.month), metricMode)
                        return (
                          <td key={`${row.test_name}-${monthKey(m.year, m.month)}-total`} style={tdStyle({ textAlign: 'right', background: '#F3F8FF', fontWeight: 700 })}>{fmt(value)}</td>
                        )
                      })}
                      <td style={tdStyle({ textAlign: 'right', background: '#FFF4CC', fontWeight: 800 })}>
                        {fmt(rowFiscalTotal(row, data.months, metricMode))}
                      </td>
                    </tr>
                  ))}
                  {currentRows.length > 0 && (
                    <tr>
                      <td style={tdStyle({ background: '#FFF4CC', fontWeight: 900, textAlign: 'center', fontSize: 14 })}>Total</td>
                      {monthTotals.map((total, i) => (
                        <td key={`${data.months[i].year}-${data.months[i].month}-month-total`} style={tdStyle({ textAlign: 'right', background: '#FFF4CC', fontWeight: 900, fontSize: 14 })}>{fmt(total)}</td>
                      ))}
                      <td style={tdStyle({ textAlign: 'right', background: '#FFE8A3', fontWeight: 900, fontSize: 14 })}>{fmt(grandTotal)}</td>
                    </tr>
                  )}
                  {currentRows.length === 0 && (
                    <tr><td colSpan={2 + data.months.length} style={{ padding: 28, textAlign: 'center', color: 'var(--muted)' }}>ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '10px 10px',
    border: '1px solid #1F2937',
    fontSize: 12,
    fontWeight: 800,
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
    ...extra,
  }
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '8px 10px',
    border: '1px solid var(--border)',
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
    ...extra,
  }
}
