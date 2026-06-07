import { createClient } from '@/lib/supabase/server'
import { getDeptAnnualDetail, getWorkloadDepts } from '@/lib/queries/workload'
import { getCurrentThaiFiscalYear, getFiscalMonths, getThaiMonthLabel } from '@/lib/kpi-utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StickyScroll } from '@/components/ui/StickyScroll'
import Link from 'next/link'

interface Props {
  params: Promise<{ dept: string }>
  searchParams?: Promise<{ year?: string }>
}

function parseFiscalYear(value: string | undefined) {
  const current = getCurrentThaiFiscalYear()
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < current - 5 || parsed > current + 1) return current
  return parsed
}

function yearOptions(selectedYear: number) {
  const current = getCurrentThaiFiscalYear()
  return Array.from(new Set([current, current - 1, current - 2, selectedYear])).sort((a, b) => b - a)
}

function fmt(n: number) {
  return n.toLocaleString()
}

function pctColor(pct: number) {
  if (pct >= 95) return '#16A34A'
  if (pct >= 80) return '#D97706'
  return '#DC2626'
}

function statusLabel(pct: number) {
  if (pct >= 95) return 'ผ่าน'
  if (pct >= 80) return 'ควรปรับปรุง'
  return 'ไม่ผ่าน'
}

export default async function WorkloadDeptPage({ params, searchParams }: Props) {
  const { dept } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const year = parseFiscalYear(sp?.year)
  const months = getFiscalMonths()

  const [detail, depts] = await Promise.all([
    getDeptAnnualDetail(supabase, dept, year),
    getWorkloadDepts(supabase),
  ])

  const deptInfo = depts.find((d) => d.code === dept)
  const totalInTime = detail.reduce((s, r) => s + r.in_time_count, 0)
  const totalAll = detail.reduce((s, r) => s + r.total_count, 0)
  const overallPct = totalAll > 0 ? Math.round((totalInTime / totalAll) * 100 * 10) / 10 : 0
  const monthTotals = months.map((month) => detail.reduce((sum, row) => sum + row.months[month].total_count, 0))
  const dataMonthCount = monthTotals.filter((value) => value > 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/lab-workload/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader
          eyebrow="Lab Workload"
          title={deptInfo?.name ?? dept}
          subtitle={`ปีงบ ${year} · ตารางรายเดือน ต.ค.-ก.ย.`}
        />
      </div>

      <Card padding={12} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <form action={`/lab-workload/${encodeURIComponent(dept)}`} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="workload-year" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>ปีงบ</label>
          <select
            id="workload-year"
            name="year"
            defaultValue={year}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 12 }}
          >
            {yearOptions(year).map((option) => (
              <option key={option} value={option}>ปีงบ {option}</option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm" icon="filter">แสดง</Button>
        </form>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>แสดงครบ 12 เดือน · มีข้อมูล {dataMonthCount}/12 เดือน</span>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[
          { label: 'จำนวนทั้งหมด', value: fmt(totalAll), sub: 'รวม 12 เดือน' },
          { label: 'ตาม TAT', value: fmt(totalInTime), sub: 'รวม 12 เดือน' },
          { label: '% on-time', value: `${overallPct}%` },
          { label: 'รายการตรวจ', value: fmt(detail.length), sub: 'มีข้อมูลในปีงบนี้' },
        ].map((stat) => (
          <Card key={stat.label} padding={16}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{stat.value}</div>
            {'sub' in stat && stat.sub && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{stat.sub}</div>}
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <StickyScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 1320 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['รหัส EPHIS', 'ชื่อรายการตรวจ', 'ราคา', ...months.map(getThaiMonthLabel), 'Total', '% on-time', 'สถานะ'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.length === 0 ? (
                <tr>
                  <td colSpan={months.length + 6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีข้อมูล</td>
                </tr>
              ) : detail.map((row) => (
                <tr key={row.test_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{row.ephis_code ?? '—'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink)' }}>{row.test_name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>{row.price != null ? `฿${row.price}` : '—'}</td>
                  {months.map((month) => {
                    const value = row.months[month]
                    return (
                      <td
                        key={`${row.test_id}-${month}`}
                        title={`ตาม TAT ${fmt(value.in_time_count)} / ทั้งหมด ${fmt(value.total_count)} (${value.pct}%)`}
                        style={{ padding: '10px 16px', color: 'var(--ink)', textAlign: 'right', fontWeight: value.total_count > 0 ? 700 : 400, background: value.total_count > 0 ? '#F3F8FF' : 'transparent' }}
                      >
                        {fmt(value.total_count)}
                      </td>
                    )
                  })}
                  <td style={{ padding: '10px 16px', color: 'var(--ink)', textAlign: 'right', fontWeight: 800, background: '#FFF4CC' }}>{fmt(row.total_count)}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: pctColor(row.pct) }}>
                    {row.pct}%
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge color={row.pct >= 95 ? 'green' : row.pct >= 80 ? 'amber' : 'red'} size="sm">
                      {statusLabel(row.pct)}
                    </Badge>
                  </td>
                </tr>
              ))}
              {detail.length > 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '11px 16px', textAlign: 'center', background: '#FFF4CC', fontWeight: 900, color: 'var(--ink)' }}>Total</td>
                  {monthTotals.map((value, index) => (
                    <td key={`total-${months[index]}`} style={{ padding: '11px 16px', textAlign: 'right', background: '#FFF4CC', fontWeight: 900, color: 'var(--ink)' }}>{fmt(value)}</td>
                  ))}
                  <td style={{ padding: '11px 16px', textAlign: 'right', background: '#FFE8A3', fontWeight: 900, color: 'var(--ink)' }}>{fmt(totalAll)}</td>
                  <td style={{ padding: '11px 16px', fontWeight: 900, color: pctColor(overallPct) }}>{overallPct}%</td>
                  <td style={{ padding: '11px 16px' }} />
                </tr>
              )}
            </tbody>
          </table>
        </StickyScroll>
      </Card>
    </div>
  )
}
