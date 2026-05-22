import { createClient } from '@/lib/supabase/server'
import { getDeptDetail, getWorkloadDepts } from '@/lib/queries/workload'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { StickyScroll } from '@/components/ui/StickyScroll'
import Link from 'next/link'

interface Props {
  params: Promise<{ dept: string }>
}

export default async function WorkloadDeptPage({ params }: Props) {
  const { dept } = await params
  const supabase = await createClient()
  const year = getCurrentThaiFiscalYear()
  const month = new Date().getMonth() + 1

  const [detail, depts] = await Promise.all([
    getDeptDetail(supabase, dept, year, month),
    getWorkloadDepts(supabase),
  ])

  const deptInfo = depts.find((d) => d.code === dept)
  const totalInTime = detail.reduce((s, r) => s + r.in_time_count, 0)
  const totalAll = detail.reduce((s, r) => s + r.total_count, 0)
  const overallPct = totalAll > 0 ? Math.round((totalInTime / totalAll) * 100 * 10) / 10 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/lab-workload/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader
          eyebrow="Lab Workload"
          title={deptInfo?.name ?? dept}
          subtitle={`ปีงบ ${year} · เดือน ${month}`}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: 'จำนวนทั้งหมด', value: totalAll.toLocaleString() },
          { label: 'ตาม TAT', value: totalInTime.toLocaleString() },
          { label: '% on-time', value: `${overallPct}%` },
        ].map((stat) => (
          <Card key={stat.label} padding={16} style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{stat.value}</div>
          </Card>
        ))}
      </div>

      <Card padding={0}>
        <StickyScroll>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                {['รหัส EPHIS', 'ชื่อรายการตรวจ', 'ราคา', 'ตาม TAT', 'ทั้งหมด', '% on-time', 'สถานะ'].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีข้อมูล</td>
                </tr>
              ) : detail.map((row) => (
                <tr key={row.test_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{row.ephis_code}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink)' }}>{row.test_name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>{row.price ? `฿${row.price}` : '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--ink)' }}>{row.in_time_count.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--ink)' }}>{row.total_count.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: row.pct >= 95 ? '#16A34A' : row.pct >= 80 ? '#D97706' : '#DC2626' }}>
                    {row.pct}%
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge color={row.pct >= 95 ? 'green' : row.pct >= 80 ? 'amber' : 'red'} size="sm">
                      {row.pct >= 95 ? 'ผ่าน' : row.pct >= 80 ? 'ควรปรับปรุง' : 'ไม่ผ่าน'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </StickyScroll>
      </Card>
    </div>
  )
}
