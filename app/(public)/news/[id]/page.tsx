import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getNewsById, getAdjacentNews } from '@/lib/queries/news'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'

interface Props {
  params: Promise<{ id: string }>
}

export default async function NewsDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const newsId = parseInt(id, 10)

  if (isNaN(newsId)) notFound()

  const [news, adjacent] = await Promise.all([
    getNewsById(supabase, newsId),
    getAdjacentNews(supabase, newsId),
  ])

  if (!news || !news.published) notFound()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 28px 60px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginBottom: 24 }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>หน้าแรก</Link>
          <Icon name="chevRight" size={12} />
          <Link href="/news" style={{ color: 'var(--muted)', textDecoration: 'none' }}>ข่าวสาร</Link>
          <Icon name="chevRight" size={12} />
          <span style={{ color: 'var(--ink)' }}>บทความ</span>
        </div>

        <Card padding={36}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {news.cat && <Badge color="blue" size="sm">{news.cat}</Badge>}
            {news.is_new && <Badge color="red" size="sm">NEW</Badge>}
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
            {news.title}
          </h1>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 28 }}>
            {news.author && `${news.author} · `}
            {news.created_at ? new Date(news.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </div>
          {news.excerpt && (
            <p style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.7, borderLeft: '3px solid var(--primary)', paddingLeft: 16, marginBottom: 24 }}>
              {news.excerpt}
            </p>
          )}
          {news.body && (
            <div
              style={{ fontSize: 14.5, lineHeight: 1.85, color: 'var(--ink)' }}
              dangerouslySetInnerHTML={{ __html: news.body }}
            />
          )}
          {news.pdf_path && (
            <div style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name="doc" size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>เอกสารแนบ</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{news.pdf_path.split('/').pop()}</div>
              </div>
              <a
                href={news.pdf_path}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                เปิด PDF
              </a>
            </div>
          )}
        </Card>

        {/* Prev / Next navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 }}>
          {adjacent.prev ? (
            <Link href={`/news/${adjacent.prev.id}`} style={{ textDecoration: 'none', flex: 1 }}>
              <Card padding={16} hoverable>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>← ก่อนหน้า</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{(adjacent.prev as any).title}</div>
              </Card>
            </Link>
          ) : <div style={{ flex: 1 }} />}
          {adjacent.next ? (
            <Link href={`/news/${adjacent.next.id}`} style={{ textDecoration: 'none', flex: 1, textAlign: 'right' }}>
              <Card padding={16} hoverable>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ถัดไป →</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{(adjacent.next as any).title}</div>
              </Card>
            </Link>
          ) : <div style={{ flex: 1 }} />}
        </div>
      </div>
    </main>
  )
}
