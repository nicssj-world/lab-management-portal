'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
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
  avg_phleb_wait: number
  avg_transport: number
  avg_total_tat: number
  median_total_tat: number
  phleb_match_rate: number
}
interface LabRow { lab_section: string; avg_tat: number; count: number }
interface DistRow { bin: string; count: number; cumulative_pct: number }
interface HeatCell { dow: number; hour: number; count: number }
interface TrendRow { year: number; month: number; avg_tat: number; pct_within_target: number }
interface MatchBreakdown { exact: number; ambiguous: number; no_match: number }
interface StageRow { stage: string; avg_minutes: number }
interface LabzoneRow { labzone_name: string; count: number; avg_wait: number }
interface FilterOptions { lab_sections: string[]; wards: string[]; test_names: string[]; labzone_names: string[] }

interface SummaryData {
  has_phleb_data: boolean
  kpi: KpiData
  match_breakdown: MatchBreakdown
  stage_breakdown: StageRow[]
  by_labzone: LabzoneRow[]
  by_lab_section: LabRow[]
  tat_distribution: DistRow[]
  heatmap: HeatCell[]
  trend: TrendRow[]
  filter_options: FilterOptions
}

const DOW_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const MATCH_COLORS: Record<string, string> = {
  'จับคู่แน่นอน': 'var(--success)',
  'จับคู่ไม่แน่นอน': 'var(--warning)',
  'ไม่พบคู่': 'var(--border)',
}

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
      position: 'relative',
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '28px repeat(7, 1fr)', gap: 2, minWidth: 280 }}>
        <div />
        {DOW_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, paddingBottom: 2 }}>
            {d}
          </div>
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
                  title={count > 0 ? `${DOW_LABELS[dow]} ${String(hour).padStart(2, '0')}:00 — ${count} ตัวอย่าง` : undefined}
                  style={{ ...cellStyle(count), height: 14 }}
                />
              )
            })}
          </React.Fragment>
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
  const [labzone, setLabzone] = useState('')

  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (
    y: number, m: number, ls: string, w: string, p: string, tn: string, lz: string
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
      if (lz) params.set('labzone_name', lz)
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
    fetchData(year, month, labSection, ward, priority, testName, labzone)
  }, [year, month, labSection, ward, priority, testName, labzone, fetchData])

  const kpi = data?.kpi
  const isEmpty = !loading && (kpi?.total_count ?? 0) === 0
  const hasPhleb = !loading && !isEmpty && (data?.has_phleb_data ?? false)

  const sectionData = data?.by_lab_section ?? []
  const sectionAvgs = sectionData.map(s => s.avg_tat)
  const sectionMedIdx = Math.floor(sectionAvgs.length / 2)
  const sectionMedian = [...sectionAvgs].sort((a, b) => a - b)[sectionMedIdx] ?? 0

  const thisYear = new Date().getFullYear()
  const yearOptions = [thisYear, thisYear - 1, thisYear - 2]

  // Stage breakdown stacked bar data
  const stageBarData = data?.stage_breakdown
    ? [{
        name: 'Pipeline',
        'รอเจาะเลือด': data.stage_breakdown.find(s => s.stage === 'รอเจาะเลือด')?.avg_minutes ?? 0,
        'ขนส่งตัวอย่าง': data.stage_breakdown.find(s => s.stage === 'ขนส่งตัวอย่าง')?.avg_minutes ?? 0,
        'วิเคราะห์ในแลป': data.stage_breakdown.find(s => s.stage === 'วิเคราะห์ในแลป')?.avg_minutes ?? 0,
      }]
    : []

  const totalStageMin = stageBarData[0]
    ? (stageBarData[0]['รอเจาะเลือด'] + stageBarData[0]['ขนส่งตัวอย่าง'] + stageBarData[0]['วิเคราะห์ในแลป'])
    : 0

  // Match donut data
  const mb = data?.match_breakdown
  const matchPieData = mb
    ? [
        { name: 'จับคู่แน่นอน', value: mb.exact },
        { name: 'จับคู่ไม่แน่นอน', value: mb.ambiguous },
        { name: 'ไม่พบคู่', value: mb.no_match },
      ]
    : []

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
          {(data?.filter_options.labzone_names ?? []).length > 0 && (
            <select value={labzone} onChange={e => setLabzone(e.target.value)} style={selectStyle}>
              <option value="">หน่วยเจาะเลือดทั้งหมด</option>
              {(data?.filter_options.labzone_names ?? []).map(lz => <option key={lz} value={lz}>{lz}</option>)}
            </select>
          )}
          {(labSection || ward || priority || testName || labzone) && (
            <Button variant="ghost" size="sm" onClick={() => { setLabSection(''); setWard(''); setPriority(''); setTestName(''); setLabzone('') }}>
              ล้าง filter
            </Button>
          )}
        </div>
      </Card>

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[0,1,2,3,4,5].map(i => (
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
          {/* ── Section A: KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <Stat label="TAT เฉลี่ย (ช่วงแลป)" value={`${kpi.avg_tat} นาที`} icon="clock" color="blue" />
            <Stat label="% ตามเป้าหมาย TAT" value={`${kpi.pct_within_target}%`} icon="chart" color="green" />
            <Stat label="จำนวนตัวอย่างทั้งหมด" value={kpi.total_count.toLocaleString()} icon="beaker" color="purple" />
            <Stat
              label="เวลารอเจาะเฉลี่ย"
              value={kpi.avg_phleb_wait > 0 ? `${kpi.avg_phleb_wait} นาที` : '—'}
              icon="syringe"
              color="amber"
            />
            <Stat
              label="Total TAT เฉลี่ย"
              value={kpi.avg_total_tat > 0 ? `${kpi.avg_total_tat} นาที` : '—'}
              icon="trending"
              color="blue"
            />
            <Stat
              label="Match rate (Phlebotomy)"
              value={kpi.phleb_match_rate > 0 ? `${kpi.phleb_match_rate}%` : '—'}
              icon="check"
              color="blue"
            />
          </div>

          {/* ── Section B: Pipeline ── */}
          {hasPhleb ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
              {/* Stage breakdown stacked bar */}
              <Card padding={20}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  Pipeline เวลา (นาที)
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
                  ลงทะเบียน → เจาะเสร็จ → รับ specimen → รายงานผล
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart layout="vertical" data={stageBarData} margin={{ top: 0, right: 60, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip
                      formatter={(val, name) => [`${Number(val)} นาที`, String(name)]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="รอเจาะเลือด" stackId="a" fill="var(--primary)" radius={[4, 0, 0, 4]} />
                    <Bar dataKey="ขนส่งตัวอย่าง" stackId="a" fill="var(--warning)" />
                    <Bar dataKey="วิเคราะห์ในแลป" stackId="a" fill="var(--success)" radius={[0, 4, 4, 0]}
                      label={{
                        position: 'right',
                        content: () => `รวม ${Math.round(totalStageMin)} นาที`,
                        fontSize: 12,
                        fill: 'var(--ink)',
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Match quality donut */}
              <Card padding={20}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>
                  คุณภาพการจับคู่ข้อมูล
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <PieChart width={130} height={130}>
                    <Pie
                      data={matchPieData}
                      cx={60}
                      cy={60}
                      innerRadius={38}
                      outerRadius={58}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {matchPieData.map(entry => (
                        <Cell key={entry.name} fill={MATCH_COLORS[entry.name] ?? 'var(--border)'} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {matchPieData.map(entry => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: MATCH_COLORS[entry.name] ?? 'var(--border)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--muted)' }}>{entry.name}</span>
                        <span style={{ fontWeight: 600, color: 'var(--ink)', marginLeft: 'auto' }}>{entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {(data?.match_breakdown.ambiguous ?? 0) > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--warning)', padding: '6px 10px', background: 'rgba(217,119,6,.08)', borderRadius: 6 }}>
                    ⚠ จับคู่ไม่แน่นอน {data?.match_breakdown.ambiguous.toLocaleString()} รายการ (ผู้ป่วยมาเจาะหลายครั้ง/วัน)
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
                <Icon name="syringe" size={20} />
                <span>ยังไม่มีข้อมูลการเจาะเลือดสำหรับเดือนนี้</span>
                {canEdit && (
                  <Link href="/tat/upload" style={{ marginLeft: 'auto' }}>
                    <Button variant="secondary" size="sm" icon="upload">อัพโหลดไฟล์ Phlebotomy</Button>
                  </Link>
                )}
              </div>
            </Card>
          )}

          {/* ── Section C: Charts ── */}

          {/* Trend + Dept */}
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
                  <Bar dataKey="avg_tat" name="TAT เฉลี่ย" radius={[0, 4, 4, 0]} fill="var(--primary)">
                    {sectionData.map((entry, i) => (
                      <rect key={i} fill={entry.avg_tat > sectionMedian ? 'var(--danger)' : 'var(--primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Distribution + Heatmap */}
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

          {/* Labzone workload (only when phleb data exists) */}
          {hasPhleb && (data?.by_labzone ?? []).length > 0 && (
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>
                Workload หน่วยเจาะเลือด
              </div>
              <ResponsiveContainer width="100%" height={Math.max(180, (data?.by_labzone ?? []).length * 36)}>
                <BarChart layout="vertical" data={data?.by_labzone ?? []} margin={{ top: 0, right: 80, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                  <YAxis type="category" dataKey="labzone_name" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} width={120} />
                  <Tooltip
                    formatter={(val, name) =>
                      name === 'จำนวนตัวอย่าง'
                        ? [Number(val).toLocaleString(), String(name)]
                        : [`${Number(val)} นาที`, String(name)]
                    }
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="จำนวนตัวอย่าง" fill="var(--primary)" opacity={0.85} radius={[0, 4, 4, 0]}
                    label={{ position: 'right', fontSize: 11, fill: 'var(--muted)', formatter: (v: unknown) => Number(v).toLocaleString() }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
