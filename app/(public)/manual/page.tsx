import { createClient } from '@/lib/supabase/server'
import { getDocuments } from '@/lib/queries/documents'
import { PageHeader } from '@/components/ui/PageHeader'
import { ManualClient } from './ManualClient'

export default async function ManualPage() {
  const supabase = await createClient()
  const { data: docs } = await getDocuments(supabase, { visibility: 'Public', pageSize: 200 })

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px' }}>
        <PageHeader
          eyebrow="เอกสาร"
          title="คู่มือห้องปฏิบัติการ"
          subtitle={`เอกสารคุณภาพสำหรับบุคลากรและผู้รับบริการ (${docs.length} รายการ)`}
        />
        <ManualClient docs={docs} />
      </div>
    </main>
  )
}
