import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getRolePermissions } from '@/lib/permissions'
import { getContracts } from '@/lib/queries/contracts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ContractsClient } from './ContractsClient'

export default async function ContractsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const perms = actor?.role ? await getRolePermissions(actor.role) : {}
  if ((perms['สัญญา'] ?? 'none') === 'none') redirect('/staff/dashboard')
  const canEdit = perms['สัญญา'] === 'edit'

  const contracts = await getContracts(supabase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="สัญญา"
        title="สัญญาและวัสดุ"
        subtitle={`${contracts.length} สัญญา`}
        actions={canEdit ? <Button variant="primary" icon="plus">เพิ่มสัญญา</Button> : undefined}
      />
      <ContractsClient contracts={contracts} canEdit={canEdit} />
    </div>
  )
}
