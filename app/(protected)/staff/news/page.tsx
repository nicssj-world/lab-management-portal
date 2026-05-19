import { createClient } from '@/lib/supabase/server'
import { getNews } from '@/lib/queries/news'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { NewsManageClient } from './NewsManageClient'

export default async function NewsManagePage() {
  const supabase = await createClient()
  const news = await getNews(supabase)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="จัดการ"
        title="จัดการข่าวสาร"
        subtitle={`${news.length} บทความ`}
        actions={<Button variant="primary" icon="plus">เพิ่มข่าวสาร</Button>}
      />
      <NewsManageClient news={news} />
    </div>
  )
}
