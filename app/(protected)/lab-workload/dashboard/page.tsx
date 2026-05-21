'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { WorkloadKpiCards } from '@/components/workload/WorkloadKpiCards'
import { MonthlyTrendChart } from '@/components/workload/MonthlyTrendChart'
import { DeptComparisonChart } from '@/components/workload/DeptComparisonChart'
import { AnnualReportExport } from '@/components/workload/AnnualReportExport'
import { useWorkload } from '@/lib/hooks/workload/useWorkload'
import { useDepartments } from '@/lib/hooks/workload/useDepartments'
import { useRealtimeEntries } from '@/lib/hooks/workload/useRealtimeEntries'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { usePermission } from '@/context/PermissionContext'

export default function WorkloadDashboardPage() {
  const [year, setYear] = useState(getCurrentThaiFiscalYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const chartRef = useRef<HTMLDivElement>(null)
  const { canEdit } = usePermission('Workload')

  const { summary, loading, refetch } = useWorkload(year, month)
  const { departments } = useDepartments()

  useRealtimeEntries(useCallback(() => refetch(), [refetch]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="Lab Workload"
        title="ภาระงานห้องปฏิบัติการ"
        subtitle="Lab Workload Dashboard"
        actions={
          <>
            <AnnualReportExport year={year} summary={summary} chartRef={chartRef} />
            {canEdit && (
              <Link href="/lab-workload/input">
                <Button variant="primary" icon="plus">บันทึกข้อมูล</Button>
              </Link>
            )}
          </>
        }
      />

      {/* Selectors */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', cursor: 'pointer' }}
        >
          {[getCurrentThaiFiscalYear(), getCurrentThaiFiscalYear() - 1].map((y) => (
            <option key={y} value={y}>ปีงบ {y}</option>
          ))}
        </select>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
      ) : (
        <>
          <WorkloadKpiCards summary={summary} />

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>Trend รายเดือน</div>
              <div ref={chartRef}>
              <MonthlyTrendChart
                data={[]}
                departments={departments.map((d) => ({ code: d.code, color: d.color }))}
              />
              </div>
            </Card>
            <Card padding={20}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>เปรียบเทียบแผนก</div>
              <DeptComparisonChart data={summary} />
            </Card>
          </div>

          {/* Dept table */}
          <Card padding={0}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                    {['แผนก', 'ทำได้ตาม TAT', 'ทั้งหมด', '% on-time', ''].map((h, i) => (
                      <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((d) => (
                    <tr key={d.dept_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <Link href={`/lab-workload/${d.dept_code}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                          {d.dept_name}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink)' }}>{d.in_time_count.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink)' }}>{d.total_count.toLocaleString()}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                            <div style={{ height: '100%', width: `${d.pct}%`, background: d.pct >= 95 ? '#16A34A' : d.pct >= 80 ? '#D97706' : '#DC2626', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: d.pct >= 95 ? '#16A34A' : d.pct >= 80 ? '#D97706' : '#DC2626', minWidth: 40 }}>{d.pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <Link href={`/lab-workload/${d.dept_code}`} style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>ดูรายละเอียด →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
