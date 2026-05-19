import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { KpiInputForm } from '@/components/kpi/KpiInputForm'

export default function KpiInputPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader eyebrow="KPI" title="บันทึกข้อมูล KPI" subtitle="กรอกข้อมูลรายเดือนสำหรับแต่ละแผนก" />
      <Card padding={24}>
        <KpiInputForm />
      </Card>
    </div>
  )
}
