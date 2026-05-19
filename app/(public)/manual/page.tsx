import { createClient } from '@/lib/supabase/server'
import { getDocuments, getDocumentDownloadUrl } from '@/lib/queries/documents'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { ManualClient } from './ManualClient'

export default async function ManualPage() {
  const supabase = await createClient()
  const docs = await getDocuments(supabase, { publicOnly: true })

  const categories = ['SOP', 'WI', 'Form', 'Policy', 'Manual', 'Record'] as const
  const catColors: Record<string, string> = {
    SOP: 'blue', WI: 'teal', Form: 'gray', Policy: 'red', Manual: 'amber', Record: 'green',
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px' }}>
        <PageHeader
          eyebrow="เอกสาร"
          title="คู่มือห้องปฏิบัติการ"
          subtitle={`เอกสารคุณภาพสำหรับบุคลากรและผู้รับบริการ (${docs.length} รายการ)`}
        />

        {/* Category pills */}
        <ManualClient docs={docs} catColors={catColors} categories={[...categories]} />
      </div>
    </main>
  )
}
