'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getNews } from '@/lib/queries/news'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import type { News } from '@/lib/supabase/types'

const CAT_LABELS: Record<string, string> = {
  announce: 'ประกาศ',
  training: 'อบรม',
  cert: 'การรับรอง',
  system: 'ระบบ',
  service: 'บริการ',
}

const CAT_COLORS: Record<string, string> = {
  announce: 'blue', training: 'teal', cert: 'green', system: 'amber', service: 'gray',
}

export default function NewsPage() {
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    getNews(supabase, { publishedOnly: true }).then((data) => {
      setNews(data)
      setLoading(false)
    })
  }, [])

  const filtered = activeCat === 'all' ? news : news.filter((n) => n.cat === activeCat)

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`
        @keyframes news-badge-ripple {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.55), 0 0 0 0 rgba(220,38,38,.25); }
          70%  { box-shadow: 0 0 0 8px rgba(220,38,38,0), 0 0 0 16px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0),  0 0 0 0  rgba(220,38,38,0); }
        }
        .news-new-badge { animation: news-badge-ripple 1.4s ease-out infinite; display: inline-flex; }
      `}</style>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
            <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', transition: 'color .15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
            >หน้าแรก</Link>
            <Icon name="chevRight" size={11} />
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>ข่าวสาร</span>
          </div>

          {/* Count + last updated */}
          {!loading && news.length > 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{news.length} ข่าว</span>
              <span>·</span>
              <span>อัปเดตล่าสุด {new Date(news[0].created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}

          {/* Title */}
          <h1 style={{ margin: '0 0 8px', fontSize: 34, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: '-.02em' }}>
            ข่าวสารห้องปฏิบัติการ
          </h1>

          {/* Subtitle */}
          <p style={{ margin: 0, fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            ข่าวสาร ประกาศ และอัปเดตจากกลุ่มงานเทคนิคการแพทย์
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCat('all')}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
              background: activeCat === 'all' ? 'var(--primary)' : 'var(--surface-2)',
              color: activeCat === 'all' ? '#fff' : 'var(--ink)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ทั้งหมด ({news.length})
          </button>
          {Object.entries(CAT_LABELS).map(([key, label]) => {
            const count = news.filter((n) => n.cat === key).length
            return count > 0 ? (
              <button
                key={key}
                onClick={() => setActiveCat(key)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
                  background: activeCat === key ? 'var(--primary)' : 'var(--surface-2)',
                  color: activeCat === key ? '#fff' : 'var(--ink)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {label} ({count})
              </button>
            ) : null
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="bell" title="ไม่มีข่าวสารในขณะนี้" hint="ลองเลือกหมวดอื่น" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {filtered.map((n) => (
              <Link key={n.id} href={`/news/${n.id}`} style={{ textDecoration: 'none' }}>
                <Card hoverable padding={20} style={{ height: '100%' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {n.cat && (
                      <Badge color={(CAT_COLORS[n.cat] ?? 'gray') as any} size="sm">
                        {CAT_LABELS[n.cat] ?? n.cat}
                      </Badge>
                    )}
                    {n.is_new && <span className="news-new-badge" style={{ background: '#DC2626', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.06em' }}>NEW</span>}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.4 }}>
                    {n.title}
                  </div>
                  {n.excerpt && (
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{n.excerpt}</div>
                  )}
                  <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted)' }}>
                    {n.author && `${n.author} · `}
                    {n.created_at ? new Date(n.created_at).toLocaleDateString('th-TH') : ''}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
