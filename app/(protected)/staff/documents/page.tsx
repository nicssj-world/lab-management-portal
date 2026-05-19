import { createClient } from '@/lib/supabase/server'
import { getDocuments } from '@/lib/queries/documents'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { DocumentsClient } from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const docs = await getDocuments(supabase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="คุณภาพ"
        title="จัดการเอกสารคุณภาพ"
        subtitle={`${docs.length} รายการ`}
        actions={<Button variant="primary" icon="plus">อัปโหลดเอกสาร</Button>}
      />
      <DocumentsClient docs={docs} />
    </div>
  )
}
