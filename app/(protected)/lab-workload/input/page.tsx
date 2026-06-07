import { createClient } from '@/lib/supabase/server'
import { getWorkloadDepts } from '@/lib/queries/workload'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { WorkloadInputForm } from '@/components/workload/WorkloadInputForm'
import { ExcelImport } from '@/components/workload/ExcelImport'
import Link from 'next/link'
import { TabsClient } from './TabsClient'

export default async function WorkloadInputPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [depts, profileResult] = await Promise.all([
    getWorkloadDepts(supabase),
    user
      ? supabase.from('profiles').select('role').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const userRole = profileResult.data?.role ?? 'Assistant'
  const departments = depts.map(d => ({ id: d.id as number, code: d.code, name: d.name }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/lab-workload/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader
          eyebrow="Lab Workload"
          title="บันทึกข้อมูลภาระงาน"
          subtitle="กรอกข้อมูลรายเดือน หรือนำเข้าจาก Excel"
        />
      </div>

      <Card padding={0}>
        <TabsClient
          manualTab={
            <div style={{ padding: 24 }}>
              <WorkloadInputForm departments={departments} userRole={userRole} />
            </div>
          }
          importTab={
            <div style={{ padding: 24 }}>
              <ExcelImport departments={departments} />
            </div>
          }
        />
      </Card>
    </div>
  )
}
