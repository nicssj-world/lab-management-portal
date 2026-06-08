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

interface MonthRow {
  year: number
  month: number
  has_data: boolean
  total_count: number
  sample_count: number
  avg_tat: number
  pct_within_target: number
  avg_total_tat: number
  phleb_match_rate: number
}
interface SectionRow { lab_section: string; avg_tat: number; count: number }
interface LabzoneRow { labzone_name: string; count: number; avg_wait: number }
interface PhlebZoneRow { labzone_name: string; count: number }
interface DistRow { bin: string; count: number; cumulative_pct: number }
interface TatAnnualData {
  fiscal_year: number
  selected_year: number
  months: MonthRow[]
  kpi: {
    total_count: number
    sample_count: number
    avg_tat: number
    pct_within_target: number
    avg_total_tat: number
    avg_phleb_wait: number
    phleb_match_rate: number
    total_tat_cut_720_count: number
    total_tat_outlier_720_count: number
    data_months: number
  }
  by_lab_section: SectionRow[]
  by_labzone: LabzoneRow[]
  by_labzone_phleb: PhlebZoneRow[]
  tat_distribution: DistRow[]
}

function fmt(n: number) {
  return n.toLocaleString()
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

function monthLabel(row: { year: number; month: number }) {
  return `${getThaiMonthLabel(row.month)} ${String(row.year + 543).slice(2)}`
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

export function TatAnnualClient() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [data, setData] = useState<TatAnnualData | null>(null)
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
      const res = await fetch(`/api/admin/tat/annual?year=${year}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลไม่สำเร็จ')
      setData(json as TatAnnualData)
    } catch (err) {
      setError((err as Error).message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { void fetchData() }, [fetchData])

  const monthData = data?.months ?? []
  const maxSection = Math.max(1, ...(data?.by_lab_section ?? []).map(row => row.count))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="TAT"
        title="ภาพรวม TAT ทั้งปีงบประมาณ"
        subtitle="รวมข้อมูลรายเดือน ต.ค.-ก.ย. จาก cache ที่วิเคราะห์แล้ว"
        actions={(
          <>
            <Link href="/tat">
              <Button variant="secondary" icon="arrowLeft">รายเดือน</Button>
            </Link>
          </>
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
            <Stat label="Test rows ทั้งปี" value={fmt(data.kpi.total_count)} sub={`${fmt(data.kpi.sample_count)} LN`} icon="beaker" color="rgba(30,95,173,.10)" />
            <Stat label="TAT Lab เฉลี่ย" value={formatDuration(data.kpi.avg_tat)} sub={`${data.kpi.pct_within_target}% ตามเป้าหมาย`} icon="clock" color="rgba(22,163,74,.10)" />
            <Stat label="Total TAT เฉลี่ย" value={formatDuration(data.kpi.avg_total_tat)} sub={`ตัด >12 hr: ${fmt(data.kpi.total_tat_cut_720_count)} LN`} icon="trending" color="rgba(217,119,6,.12)" />
            <Stat label="Phlebotomy match" value={`${data.kpi.phleb_match_rate}%`} sub={`รอเจาะเฉลี่ย ${formatDuration(data.kpi.avg_phleb_wait)}`} icon="syringe" color="rgba(147,51,234,.10)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, .9fr)', gap: 12 }}>
            <Panel title="แนวโน้มรายเดือนในปีงบ" subtitle="TAT เฉลี่ยและ % ตามเป้าหมาย" accent="#1E5FAD">
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={monthData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey={(row: MonthRow) => monthLabel(row)} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip formatter={(value, name) => name === 'TAT เฉลี่ย' ? [formatDuration(Number(value)), name] : [`${value}%`, name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <Bar yAxisId="left" dataKey="avg_tat" name="TAT เฉลี่ย" fill="#BFD7F2" radius={[5, 5, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="pct_within_target" name="% ตามเป้าหมาย" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="การกระจาย TAT ทั้งปี" subtitle="รวม test rows ทุกเดือน" accent="#D97706">
              <div style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.tat_distribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="bin" tick={{ fontSize: 10.5, fill: 'var(--muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                    <Tooltip formatter={(value) => [fmt(Number(value)), 'จำนวน']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <Bar dataKey="count" fill="#D97706" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, .8fr)', gap: 12 }}>
            <Panel title="TAT ตามหน่วยงาน Lab" subtitle="เรียงตามจำนวน LN ทั้งปี" accent="#DC2626">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.by_lab_section.slice(0, 12).map(row => (
                  <div key={row.lab_section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                      <strong style={{ color: 'var(--ink)' }}>{row.lab_section}</strong>
                      <span style={{ color: 'var(--muted)' }}>{fmt(row.count)} LN · {formatDuration(row.avg_tat)}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 5 }}>
                      <div style={{ width: `${Math.max(3, row.count / maxSection * 100)}%`, height: '100%', background: '#1E5FAD' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="เดือนในปีงบ" subtitle="ใช้สำหรับตรวจช่องว่างข้อมูล" accent="#0F766E">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {monthData.map(row => (
                      <tr key={`${row.year}-${row.month}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 700, color: 'var(--ink)' }}>{monthLabel(row)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: row.has_data ? 'var(--ink)' : 'var(--muted)' }}>{row.has_data ? fmt(row.total_count) : 'ไม่มีข้อมูล'}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--muted)' }}>{row.has_data ? `${row.pct_within_target}%` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
