import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { TATImportForm } from '@/components/tat/TATImportForm'
import Link from 'next/link'

export default function TATImportPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/tat/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader
          eyebrow="TAT"
          title="นำเข้าข้อมูล TAT"
          subtitle="อัปโหลดไฟล์ Excel หรือ CSV จาก LIS"
        />
      </div>
      <Card padding={24}>
        <TATImportForm />
      </Card>
    </div>
  )
}
