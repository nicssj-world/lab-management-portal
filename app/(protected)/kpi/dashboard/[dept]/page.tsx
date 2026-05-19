import { createClient } from '@/lib/supabase/server'
import { getDeptTrend, getDepartments, getDefinitions } from '@/lib/queries/kpi'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TrendChart } from '@/components/kpi/TrendChart'
import Link from 'next/link'

interface Props {
  params: Promise<{ dept: string }>
}

const CATEGORIES = ['TAT', 'ERROR', 'RISK']

export default async function KpiDeptPage({ params }: Props) {
  const { dept } = await params
  const supabase = await createClient()
  const year = getCurrentThaiFiscalYear()

  const [deptTrend, depts, defs] = await Promise.all([
    getDeptTrend(supabase, dept, year),
    getDepartments(supabase),
    getDefinitions(supabase),
  ])

  const deptInfo = depts.find((d) => d.code === dept)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/kpi/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader
          eyebrow={`KPI · ปีงบ ${year}`}
          title={deptInfo?.name_th ?? dept}
          subtitle="Trend Chart รายเดือน"
        />
      </div>

      {CATEGORIES.map((cat) => {
        const catDefs = defs.filter((d) => d.category === cat)
        if (catDefs.length === 0) return null
        return (
          <div key={cat}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {catDefs.map((def) => {
                const trendData = deptTrend
                  .filter((r) => r.kpi_code === def.code)
                  .map((r) => ({ month: r.month, result_pct: r.result_pct, numerator: r.numerator }))
                return (
                  <Card key={def.id} padding={16}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{def.name_th}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
                      Target: {def.target_type} {def.target_val}{def.unit ?? '%'}
                    </div>
                    <TrendChart
                      data={trendData}
                      targetType={def.target_type ?? 'gte'}
                      targetVal={def.target_val ?? 0}
                      unit={def.unit ?? '%'}
                    />
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })}

      {deptTrend.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
          ยังไม่มีข้อมูล KPI สำหรับแผนกนี้
        </div>
      )}
    </div>
  )
}
