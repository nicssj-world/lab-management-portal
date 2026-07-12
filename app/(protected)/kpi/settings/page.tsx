import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { KpiSettingsClient } from '@/components/kpi/KpiSettingsClient'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export default async function KpiSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role?.toLowerCase() !== 'admin') redirect('/kpi/dashboard')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/kpi/input">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader eyebrow="KPI · ตั้งค่า" title="ตั้งค่าการกรอก KPI" subtitle="มอบหมายผู้กรอกรายแผนก และกำหนดตัวชี้วัดที่แต่ละแผนกต้องกรอก" marginBottom={0} />
      </div>
      <KpiSettingsClient />
    </div>
  )
}
