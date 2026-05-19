'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { upsertNews, deleteNews } from '@/lib/queries/news'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import type { News } from '@/lib/supabase/types'

const CAT_COLORS: Record<string, string> = {
  announce: 'blue', training: 'teal', cert: 'green', system: 'amber', service: 'gray',
}
const CAT_LABELS: Record<string, string> = {
  announce: 'ประกาศ', training: 'อบรม', cert: 'การรับรอง', system: 'ระบบ', service: 'บริการ',
}

interface Props { news: News[] }

export function NewsManageClient({ news: initialNews }: Props) {
  const [news, setNews] = useState(initialNews)
  const supabase = createClient()

  async function togglePublish(item: News) {
    const updated = await upsertNews(supabase, { ...item, published: !item.published })
    setNews((prev) => prev.map((n) => n.id === item.id ? { ...n, published: updated.published } : n))
  }

  async function handleDelete(id: number) {
    if (!confirm('ยืนยันการลบข่าวสารนี้?')) return
    await deleteNews(supabase, id)
    setNews((prev) => prev.filter((n) => n.id !== id))
  }

  if (news.length === 0) {
    return <EmptyState icon="bell" title="ไม่มีข่าวสาร" hint="เพิ่มข่าวสารด้วยปุ่มด้านบน" />
  }

  return (
    <Card padding={0}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
              {['หัวข้อ', 'หมวดหมู่', 'ผู้เขียน', 'การมองเห็น', 'NEW', 'วันที่สร้าง', ''].map((h, i) => (
                <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {news.map((n) => (
              <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--ink)', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
                  {n.excerpt && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.excerpt}</div>}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  {n.cat && <Badge color={(CAT_COLORS[n.cat] ?? 'gray') as any} size="sm">{CAT_LABELS[n.cat] ?? n.cat}</Badge>}
                </td>
                <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>{n.author ?? '—'}</td>
                <td style={{ padding: '11px 16px' }}>
                  <button
                    onClick={() => togglePublish(n)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <Badge color={n.published ? 'green' : 'gray'} size="sm">
                      {n.published ? 'เผยแพร่แล้ว' : 'ร่าง'}
                    </Badge>
                  </button>
                </td>
                <td style={{ padding: '11px 16px' }}>
                  {n.is_new ? <Badge color="red" size="sm">NEW</Badge> : '—'}
                </td>
                <td style={{ padding: '11px 16px', color: 'var(--muted)', fontSize: 12 }}>
                  {n.created_at ? new Date(n.created_at).toLocaleDateString('th-TH') : '—'}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
                      แก้ไข
                    </button>
                    <button onClick={() => handleDelete(n.id)} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#DC2626' }}>
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
