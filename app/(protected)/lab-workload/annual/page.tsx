'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { getCurrentThaiFiscalYear, getThaiMonthLabel } from '@/lib/kpi-utils'

interface MonthRef { year: number; month: number }
interface TrendRow { year: number; month: number; has_data: boolean; ln_count: number; test_rows: number; opd_hn: number }
interface DepartmentAnnualRow {
  section: string
  ln_count: number
  test_rows: number
  test_count: number
  months: Record<string, { ln_count: number; test_rows: number }>
}
interface OpdRow { labzone_name: string; months: Record<string, number>; total: number }
interface AnnualData {
  fiscal_year: number
  selected_year: number
  months: MonthRef[]
  kpi: { total_ln: number; total_test_rows: number; department_count: number; opd_hn: number; data_months: number }
  trend: TrendRow[]
  departments: DepartmentAnnualRow[]
  opd_rows: OpdRow[]
}
interface OverviewRow { section: string; months: Record<string, number>; total: number }

function monthKey(year: number, month: number) {
  return `${year}-${month}`
}

function fmt(n: number) {
  return n.toLocaleString()
}

function monthLabel(row: { year: number; month: number }) {
  return `${getThaiMonthLabel(row.month)} ${String(row.year + 543).slice(2)}`
}

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    color: 'var(--ink)',
    fontSize: 11.5,
    fontWeight: 900,
    whiteSpace: 'nowrap',
    ...extra,
  }
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '9px 12px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    color: 'var(--ink)',
    whiteSpace: 'nowrap',
    ...extra,
  }
}

function buildOverviewRows(data: AnnualData): OverviewRow[] {
  const departmentRows = data.departments.map(dept => {
    const values = Object.fromEntries(data.months.map(m => {
      const key = monthKey(m.year, m.month)
      return [key, dept.months[key]?.ln_count ?? 0]
    }))
    return {
      section: dept.section,
      months: values,
      total: Object.values(values).reduce((sum, value) => sum + value, 0),
    }
  })

  const opdValues = Object.fromEntries(data.months.map(m => {
    const key = monthKey(m.year, m.month)
    return [key, data.opd_rows.reduce((sum, row) => sum + (row.months[key] ?? 0), 0)]
  }))
  const opdTotal = Object.values(opdValues).reduce((sum, value) => sum + value, 0)

  return [
    ...departmentRows.filter(row => row.total > 0).sort((a, b) => b.total - a.total),
    ...(opdTotal > 0 ? [{ section: 'งานบริการผู้ป่วยนอก (HN)', months: opdValues, total: opdTotal }] : []),
  ]
}

function Stat({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
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

function Panel({ title, subtitle, children, accent = 'var(--primary)' }: { title: string; subtitle?: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', borderLeft: `3px solid ${accent}` }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: 18, minWidth: 0 }}>{children}</div>
    </div>
  )
}

export default function WorkloadAnnualPage() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [data, setData] = useState<AnnualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const yearOptions = useMemo(() => {
    const current = getCurrentThaiFiscalYear()
    return [current, current - 1, current - 2]
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/lab-workload/annual?year=${year}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setData(json as AnnualData)
    } catch (err) {
      setError((err as Error).message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { void fetchData() }, [fetchData])

  const maxDept = Math.max(1, ...(data?.departments ?? []).map(row => row.ln_count))
  const overviewRows = data ? buildOverviewRows(data) : []
  const overviewMonthTotals = data?.months.map(m => overviewRows.reduce((sum, row) => sum + (row.months[monthKey(m.year, m.month)] ?? 0), 0)) ?? []
  const overviewGrandTotal = overviewMonthTotals.reduce((sum, value) => sum + value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="Lab Workload"
        title="ภาพรวมภาระงานทั้งปีงบประมาณ"
        subtitle="รวมปริมาณงานรายเดือน ต.ค.-ก.ย. จากข้อมูลที่วิเคราะห์แล้ว"
        actions={(
          <Link href="/lab-workload/dashboard">
            <Button variant="secondary" icon="arrowLeft">รายเดือน</Button>
          </Link>
        )}
      />

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Icon name="filter" size={14} style={{ color: 'var(--muted)' }} />
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12 }}
        >
          {yearOptions.map(y => <option key={y} value={y}>ปีงบ {y}</option>)}
        </select>
        {data && <span style={{ fontSize: 12, color: 'var(--muted)' }}>มีข้อมูล {data.kpi.data_months}/12 เดือน</span>}
      </div>

      {loading && <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted)' }}>กำลังโหลด...</div>}
      {!loading && error && <div style={{ padding: 16, borderRadius: 12, border: '1px solid #FCA5A5', color: '#B91C1C', background: '#FEF2F2' }}>{error}</div>}

      {!loading && data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Stat label="LN รวมทั้งปี" value={fmt(data.kpi.total_ln)} sub={`${data.kpi.data_months}/12 เดือนที่มีข้อมูล`} icon="beaker" color="rgba(30,95,173,.10)" />
            <Stat label="Test rows รวม" value={fmt(data.kpi.total_test_rows)} sub={`${fmt(data.kpi.department_count)} หน่วยงาน`} icon="microscope" color="rgba(22,163,74,.10)" />
            <Stat label="OPD service" value={fmt(data.kpi.opd_hn)} sub="รวมครั้งบริการเจาะเลือด" icon="syringe" color="rgba(147,51,234,.10)" />
            <Stat label="เฉลี่ย/เดือน" value={fmt(Math.round(data.kpi.total_ln / Math.max(data.kpi.data_months, 1)))} sub="LN ต่อเดือนที่มีข้อมูล" icon="trending" color="rgba(217,119,6,.12)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, .9fr)', gap: 12 }}>
            <Panel title="แนวโน้มภาระงานรายเดือน" subtitle="ปีงบประมาณเรียงจาก ต.ค. ถึง ก.ย." accent="#1E5FAD">
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={data.trend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey={(row: TrendRow) => monthLabel(row)} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip formatter={(value, name) => [fmt(Number(value)), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <Bar yAxisId="left" dataKey="ln_count" name="LN" fill="#BFD7F2" radius={[5, 5, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="test_rows" name="Test rows" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="เดือนในปีงบ" subtitle="ตรวจสอบเดือนที่ยังไม่มีข้อมูล" accent="#0F766E">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {data.trend.map(row => (
                      <tr key={`${row.year}-${row.month}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--ink)' }}>{monthLabel(row)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: row.has_data ? 'var(--ink)' : 'var(--muted)' }}>{row.has_data ? fmt(row.ln_count) : 'ไม่มีข้อมูล'}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--muted)' }}>{row.has_data ? fmt(row.test_rows) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel title="ตารางสรุปรวมทั้งปีงบ" subtitle="รวม workload ตามงานและเดือน ต.ค.-ก.ย." accent="#FBBF24">
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

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: 12 }}>
            <Panel title="ภาระงานตามหน่วยงาน" subtitle="รวม LN และ test rows ทั้งปี" accent="#DC2626">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.departments.slice(0, 14).map(row => (
                  <div key={row.section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                      <strong style={{ color: 'var(--ink)' }}>{row.section}</strong>
                      <span style={{ color: 'var(--muted)' }}>{fmt(row.ln_count)} LN · {fmt(row.test_rows)} rows</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ width: `${Math.max(3, row.ln_count / maxDept * 100)}%`, height: '100%', background: '#1E5FAD' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="OPD service" subtitle="หน่วยเจาะเลือดตามปีงบ" accent="#9333EA">
              <div style={{ height: 330 }}>
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart data={data.opd_rows.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis type="category" dataKey="labzone_name" width={140} tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                    <Tooltip formatter={(value) => [fmt(Number(value)), 'ครั้งบริการ']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <Bar dataKey="total" radius={[0, 5, 5, 0]}>
                      {data.opd_rows.slice(0, 8).map((_, i) => <Cell key={i} fill={['#9333EA', '#1E5FAD', '#16A34A', '#D97706', '#0F766E', '#DC2626'][i % 6]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
