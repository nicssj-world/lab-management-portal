import { createClient } from '@/lib/supabase/server'
import { getContracts } from '@/lib/queries/contracts'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ContractsClient } from './ContractsClient'

export default async function ContractsPage() {
  const supabase = await createClient()
  const contracts = await getContracts(supabase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="สัญญา"
        title="สัญญาและวัสดุ"
        subtitle={`${contracts.length} สัญญา`}
        actions={<Button variant="primary" icon="plus">เพิ่มสัญญา</Button>}
      />
      <ContractsClient contracts={contracts} />
    </div>
  )
}
