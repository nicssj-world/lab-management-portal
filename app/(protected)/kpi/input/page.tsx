import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { KpiInputForm } from '@/components/kpi/KpiInputForm'
import Link from 'next/link'

export default function KpiInputPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/kpi/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader eyebrow="KPI" title="บันทึกข้อมูล KPI" subtitle="กรอกข้อมูลรายเดือนสำหรับแต่ละแผนก" marginBottom={0} />
      </div>
      <Card padding={24}>
        <KpiInputForm />
      </Card>
    </div>
  )
}
