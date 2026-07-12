import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { KpiInputForm } from '@/components/kpi/KpiInputForm'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { getAssignedDeptIds } from '@/lib/queries/kpi'

export default async function KpiInputPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const perms = profile?.role ? await getRolePermissions(profile.role) : {}
  const canEditAll = (perms['KPI'] ?? 'none') === 'edit'
  const isAdmin = profile?.role?.toLowerCase() === 'admin'
  // Allow if the user can edit KPI OR is an assigned filler for at least one dept
  if (!canEditAll) {
    const assigned = await getAssignedDeptIds(supabase, user.id)
    if (assigned.length === 0) redirect('/kpi/dashboard')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Link href="/kpi/dashboard">
          <Button variant="ghost" size="sm" icon="arrowLeft">กลับ</Button>
        </Link>
        <PageHeader eyebrow="KPI" title="บันทึกข้อมูล KPI" subtitle="กรอกข้อมูลรายเดือนสำหรับแต่ละแผนก" marginBottom={0} />
        {isAdmin && (
          <Link href="/kpi/settings" style={{ marginLeft: 'auto' }}>
            <Button variant="secondary" size="sm" icon="settings">ตั้งค่าผู้กรอก</Button>
          </Link>
        )}
      </div>
      <Card padding={24}>
        <KpiInputForm />
      </Card>
    </div>
  )
}
