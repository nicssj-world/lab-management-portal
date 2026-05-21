import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getNewsById, getAdjacentNews } from '@/lib/queries/news'
import { Icon } from '@/components/ui/Icon'
import { NewsShareButton } from '@/components/news/NewsShareButton'
import { CAT_MAP, CATEGORIES } from '@/lib/validations/news'
import type { News } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function extractTags(body: string | null, cat: string | null): string[] {
  const tags: string[] = []
  const catInfo = CAT_MAP[cat as keyof typeof CAT_MAP]
  if (catInfo) tags.push(catInfo.th)
  if (body) {
    const matches = body.match(/#[\w฀-๿-]+/g) ?? []
    for (const m of matches) {
      const tag = m.slice(1)
      if (!tags.includes(tag)) tags.push(tag)
    }
  }
  return tags
}

function newsCode(id: number, createdAt: string) {
  const year = new Date(createdAt).getFullYear()
  return `N-${year}-${String(id).padStart(2, '0')}`
}

export default async function NewsDetailPage({ params }: Props) {
  const { id } = await params
  const newsId = parseInt(id, 10)
  if (isNaN(newsId)) notFound()

  const supabase = await createClient()

  const [news, adjacent] = await Promise.all([
    getNewsById(supabase, newsId),
    getAdjacentNews(supabase, newsId),
  ])

  if (!news || !news.published) notFound()

  // Related news: same category, excluding current, limit 3
  const { data: relatedRaw } = await supabaseAdmin
    .from('news')
    .select('id, title, cat, created_at, excerpt')
    .eq('published', true)
    .eq('cat', news.cat ?? '')
    .neq('id', newsId)
    .order('created_at', { ascending: false })
    .limit(3)
  const related = (relatedRaw ?? []) as Pick<News, 'id' | 'title' | 'cat' | 'created_at' | 'excerpt'>[]

  const cat = CAT_MAP[news.cat as keyof typeof CAT_MAP]
  const tags = extractTags(news.body, news.cat)
  const initial = (news.author ?? 'ก').charAt(0).toUpperCase()
  const code = newsCode(news.id, news.created_at)

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px 72px' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginBottom: 24, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>หน้าแรก</Link>
          <Icon name="chevRight" size={11} />
          <Link href="/news" style={{ color: 'var(--muted)', textDecoration: 'none' }}>ข่าวสาร</Link>
          <Icon name="chevRight" size={11} />
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{code}</span>
        </div>

        {/* Category + date + views */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {cat && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600,
              background: cat.color + '18', color: cat.color,
              border: `1px solid ${cat.color}30`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color }} />
              {cat.th}
            </span>
          )}
          {news.is_new && (
            <span style={{ background: '#DC2626', color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.04em' }}>NEW</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 12.5 }}>
            <Icon name="clock" size={12} />
            <span>{fmtDate(news.created_at)}</span>
          </div>
          {news.views > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 12.5 }}>
              <Icon name="eye" size={12} />
              <span>{news.views.toLocaleString()} การเข้าชม</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h1 style={{ margin: '0 0 12px', fontSize: 30, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.25, letterSpacing: '-.01em' }}>
          {news.title}
        </h1>

        {/* Excerpt */}
        {news.excerpt && (
          <p style={{ margin: '0 0 24px', fontSize: 16, color: 'var(--muted)', lineHeight: 1.65 }}>
            {news.excerpt}
          </p>
        )}

        {/* Author + action buttons */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          marginBottom: 32,
        }}>
          {/* Avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: 'var(--ink)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700,
          }}>
            {initial}
          </div>

          {/* Author info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
              {news.author ?? 'กลุ่มงานเทคนิคการแพทย์'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
              โรงพยาบาลชลบุรี · เผยแพร่ {fmtDate(news.created_at)}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {news.pdf_path && (
              <a
                href={`/api/news/${news.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 14px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--card)',
                  textDecoration: 'none', fontSize: 13, color: 'var(--ink)', fontWeight: 500,
                }}
              >
                <Icon name="download" size={13} />
                PDF
              </a>
            )}
            <NewsShareButton title={news.title} />
          </div>
        </div>

        {/* Body */}
        {news.body ? (
          <div
            style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--ink)', marginBottom: 32, whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: news.body }}
          />
        ) : (
          <div style={{ height: 32 }} />
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            {tags.map(tag => (
              <span key={tag} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500,
                background: 'var(--surface-2)', color: 'var(--muted)',
                border: '1px solid var(--border)',
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Prev / Next navigation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 48 }}>
          {adjacent.prev ? (
            <Link href={`/news/${adjacent.prev.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--card)', transition: 'border-color .15s, box-shadow .15s',
              }}
                onMouseEnter={undefined}
              >
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon name="arrowLeft" size={10} /> ข่าวเก่ากว่า
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {adjacent.prev.title}
                </div>
              </div>
            </Link>
          ) : <div />}

          {adjacent.next ? (
            <Link href={`/news/${adjacent.next.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--card)', textAlign: 'right', transition: 'border-color .15s',
              }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                  ข่าวใหม่กว่า <Icon name="arrowRight" size={10} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {adjacent.next.title}
                </div>
              </div>
            </Link>
          ) : <div />}
        </div>

        {/* Related news */}
        {related.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              ข่าวอื่นที่เกี่ยวข้อง
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {related.map(r => {
                const rCat = CAT_MAP[r.cat as keyof typeof CAT_MAP]
                return (
                  <Link key={r.id} href={`/news/${r.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      padding: '14px 16px', borderRadius: 12, border: '1px solid var(--border)',
                      background: 'var(--card)', height: '100%', boxSizing: 'border-box',
                      transition: 'box-shadow .15s',
                    }}>
                      {rCat && (
                        <span style={{
                          display: 'inline-block', padding: '2px 9px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: rCat.color + '18', color: rCat.color, marginBottom: 8,
                        }}>
                          {rCat.th}
                        </span>
                      )}
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {r.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {fmtDate(r.created_at)}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
