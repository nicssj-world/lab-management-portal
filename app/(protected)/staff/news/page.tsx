import { createClient } from '@/lib/supabase/server'
import { getNews } from '@/lib/queries/news'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { NewsManageClient } from './NewsManageClient'

export default async function NewsManagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: actor } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const canEdit = ['Admin', 'Manager'].includes(actor?.role ?? '')

  const news = await getNews(supabase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="จัดการ"
        title="จัดการข่าวสาร"
        subtitle={`${news.length} บทความ`}
        actions={canEdit ? <Button variant="primary" icon="plus">เพิ่มข่าวสาร</Button> : undefined}
      />
      <NewsManageClient news={news} canEdit={canEdit} />
    </div>
  )
}
