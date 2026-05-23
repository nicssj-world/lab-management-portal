'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'
import { EmptyState } from '@/components/ui/EmptyState'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { getCurrentThaiFiscalYear, getThaiMonthLabel } from '@/lib/kpi-utils'

interface KpiData {
  avg_tat: number
  median_tat: number
  pct_within_target: number
  total_count: number
  busiest_hour: string
}
interface LabRow { lab_section: string; avg_tat: number; count: number }
interface DistRow { bin: string; count: number; cumulative_pct: number }
interface HeatCell { dow: number; hour: number; count: number }
interface TrendRow { year: number; month: number; avg_tat: number; pct_within_target: number }
interface FilterOptions { lab_sections: string[]; wards: string[]; test_names: string[] }

interface SummaryData {
  kpi: KpiData
  by_lab_section: LabRow[]
  tat_distribution: DistRow[]
  heatmap: HeatCell[]
  trend: TrendRow[]
  filter_options: FilterOptions
}

const DOW_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

function formatTrendLabel(year: number, month: number) {
  return `${getThaiMonthLabel(month)} ${String(year + 543).slice(2)}`
}

function TatHeatmap({ cells }: { cells: HeatCell[] }) {
  const grid = new Map<string, number>()
  let maxCount = 0
  for (const c of cells) {
    const key = `${c.dow}-${c.hour}`
    grid.set(key, c.count)
    if (c.count > maxCount) maxCount = c.count
  }

  const cellStyle = (count: number): React.CSSProperties => {
    const opacity = maxCount > 0 ? count / maxCount : 0
    return {
      background: `rgba(30,95,173,${opacity.toFixed(2)})`,
      border: '1px solid var(--border)',
      borderRadius: 2,
      cursor: count > 0 ? 'default' : undefined,
      position: 'relative',
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px repeat(7, 1fr)',
        gap: 2,
        minWidth: 280,
      }}>
        {/* Header row */}
        <div />
        {DOW_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, paddingBottom: 2 }}>
            {d}
          </div>
        ))}

        {/* Hour rows */}
        {Array.from({ length: 24 }, (_, hour) => (
          <>
            <div key={`h${hour}`} style={{ fontSize: 9.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
              {String(hour).padStart(2, '0')}
            </div>
            {Array.from({ length: 7 }, (_, dow) => {
              const count = grid.get(`${dow}-${hour}`) ?? 0
              return (
                <div
                  key={`${dow}-${hour}`}
                  title={count > 0 ? `${DOW_LABELS[dow]} ${String(hour).padStart(2, '0')}:00 — ${count} ตัวอย่าง` : undefined}
                  style={{ ...cellStyle(count), height: 14 }}
                />
              )
            })}
          </>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>น้อย</span>
        {[0.1, 0.3, 0.5, 0.7, 1].map(o => (
          <div key={o} style={{ width: 14, height: 14, borderRadius: 2, border: '1px solid var(--border)', background: `rgba(30,95,173,${o})` }} />
        ))}
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>มาก</span>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: 12.5, fontFamily: 'inherit', background: 'var(--card)',
  color: 'var(--ink)', cursor: 'pointer', minWidth: 120,
}

export function TatDashboardClient({ canEdit }: { canEdit: boolean }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [labSection, setLabSection] = useState('')
  const [ward, setWard] = useState('')
  const [priority, setPriority] = useState('')
  const [testName, setTestName] = useState('')

  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (
    y: number, m: number, ls: string, w: string, p: string, tn: string
  ) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(y), month: String(m) })
      if (ls) params.set('lab_section', ls)
      if (w) params.set('ward', w)
      if (p) params.set('priority', p)
      if (tn) params.set('test_name', tn)
      const res = await fetch(`/api/admin/tat/summary?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(year, month, labSection, ward, priority, testName)
  }, [year, month, labSection, ward, priority, testName, fetchData])

  const kpi = data?.kpi
  const isEmpty = !loading && (kpi?.total_count ?? 0) === 0

  // Dept bar chart: color by avg vs median of sections
  const sectionData = data?.by_lab_section ?? []
  const sectionAvgs = sectionData.map(s => s.avg_tat)
  const sectionMedIdx = Math.floor(sectionAvgs.length / 2)
  const sectionMedian = [...sectionAvgs].sort((a, b) => a - b)[sectionMedIdx] ?? 0

  // Year selector options
  const thisYear = new Date().getFullYear()
  const yearOptions = [thisYear, thisYear - 1, thisYear - 2]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="TAT"
        title="Turnaround Time"
        subtitle="วิเคราะห์ระยะเวลารายงานผล"
        marginBottom={0}
        actions={canEdit ? (
          <Link href="/tat/upload">
            <Button variant="primary" icon="upload">อัพโหลดข้อมูล</Button>
          </Link>
        ) : undefined}
      />

      {/* Filter bar */}
      <Card padding={14}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={selectStyle}>
            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <MonthSelector value={month} onChange={setMonth} />
          <select value={labSection} onChange={e => setLabSection(e.target.value)} style={selectStyle}>
            <option value="">แผนก Lab ทั้งหมด</option>
            {(data?.filter_options.lab_sections ?? []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={ward} onChange={e => setWard(e.target.value)} style={selectStyle}>
            <option value="">หอผู้ป่วยทั้งหมด</option>
            {(data?.filter_options.wards ?? []).map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
            <option value="">ทุกความเร่งด่วน</option>
            <option value="ด่วน">ด่วน</option>
            <option value="ปกติ">ปกติ</option>
          </select>
          <select value={testName} onChange={e => setTestName(e.target.value)} style={selectStyle}>
            <option value="">ทุกประเภทการตรวจ</option>
            {(data?.filter_options.test_names ?? []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {(labSection || ward || priority || testName) && (
            <Button variant="ghost" size="sm" onClick={() => { setLabSection(''); setWard(''); setPriority(''); setTestName('') }}>
              ล้าง filter
            </Button>
          )}
        </div>
      </Card>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {[0,1,2,3].map(i => (
            <Card key={i} padding={18}>
              <div style={{ height: 12, borderRadius: 4, background: 'var(--surface-2)', width: 80, marginBottom: 10 }} />
              <div style={{ height: 28, borderRadius: 4, background: 'var(--surface-2)', width: 60 }} />
            </Card>
          ))}
        </div>
      )}

      {!loading && isEmpty && (
        <Card padding={0}>
          <EmptyState
            icon="clock"
            title="ยังไม่มีข้อมูล TAT สำหรับเดือนนี้"
            hint={canEdit ? 'อัพโหลดไฟล์จาก LIS เพื่อเริ่มวิเคราะห์ข้อมูล' : undefined}
          />
          {canEdit && (
            <div style={{ textAlign: 'center', paddingBottom: 28 }}>
              <Link href="/tat/upload">
                <Button variant="primary" icon="upload">อัพโหลดข้อมูล TAT</Button>
              </Link>
            </div>
          )}
        </Card>
      )}

      {!loading && !isEmpty && kpi && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <Stat label="TAT เฉลี่ย (นาที)" value={kpi.avg_tat.toLocaleString()} icon="clock" color="blue" />
            <Stat label="% ตามเป้าหมาย TAT" value={`${kpi.pct_within_target}%`} icon="chart" color="green" />
            <Stat label="จำนวนตัวอย่างทั้งหมด" value={kpi.total_count.toLocaleString()} icon="beaker" color="purple" />
            <Stat label="ช่วงเวลาที่ยุ่งที่สุด" value={kpi.busiest_hour} icon="trending" color="amber" />
          </div>

          {/* Row 2: Trend + Dept */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Trend รายเดือน</div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data?.trend ?? []} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey={({ year: y, month: m }: TrendRow) => formatTrendLabel(y, m)}
                    tick={{ fontSize: 10.5, fill: 'var(--muted)' }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="นาที" width={50} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" width={36} domain={[0, 100]} />
                  <Tooltip
                    formatter={(val, name) =>
                      name === 'TAT เฉลี่ย' ? [`${val} นาที`, name] : [`${val}%`, name]
                    }
                    labelFormatter={(label) => String(label)}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="avg_tat" name="TAT เฉลี่ย" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line yAxisId="right" type="monotone" dataKey="pct_within_target" name="% ตามเป้า" stroke="var(--success)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>TAT เฉลี่ยต่อแผนก</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={sectionData} margin={{ top: 0, right: 20, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="นาที" />
                  <YAxis type="category" dataKey="lab_section" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} width={80} />
                  <Tooltip formatter={(val) => [`${val} นาที`, 'TAT เฉลี่ย']} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="avg_tat" name="TAT เฉลี่ย" radius={[0, 4, 4, 0]}
                    fill="var(--primary)"
                    label={false}
                  >
                    {sectionData.map((entry, i) => (
                      <rect
                        key={i}
                        fill={entry.avg_tat > sectionMedian ? 'var(--danger)' : 'var(--primary)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Row 3: Distribution + Heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>การกระจาย TAT</div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data?.tat_distribution ?? []} margin={{ top: 4, right: 36, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="bin" tick={{ fontSize: 9.5, fill: 'var(--muted)' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} unit="%" domain={[0, 100]} width={36} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="count" name="จำนวน" fill="var(--primary)" opacity={0.85} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="cumulative_pct" name="% สะสม" stroke="var(--warning)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>
                Heatmap เวลารับตัวอย่าง
              </div>
              <TatHeatmap cells={data?.heatmap ?? []} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
