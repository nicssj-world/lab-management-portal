'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Document } from '@/lib/supabase/types'

interface Props {
  docs: Document[]
  catColors: Record<string, string>
  categories: string[]
}

export function ManualClient({ docs, catColors, categories }: Props) {
  const [activeCat, setActiveCat] = useState<string>('all')

  const filtered = activeCat === 'all' ? docs : docs.filter((d) => d.cat === activeCat)

  return (
    <>
      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveCat('all')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
            background: activeCat === 'all' ? 'var(--primary)' : 'var(--surface-2)',
            color: activeCat === 'all' ? '#fff' : 'var(--ink)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ทั้งหมด ({docs.length})
        </button>
        {categories.map((cat) => {
          const count = docs.filter((d) => d.cat === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
                background: activeCat === cat ? 'var(--primary)' : 'var(--surface-2)',
                color: activeCat === cat ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {cat} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="doc" title="ไม่มีเอกสารในหมวดนี้" hint="ลองเลือกหมวดอื่น" />
      ) : (
        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  {['รหัสเอกสาร', 'ชื่อเอกสาร', 'ประเภท', 'Rev.', 'วันที่', 'ขนาด', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '12px 16px', fontSize: 11.5, fontWeight: 600,
                        color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase',
                        borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{doc.code}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--ink)' }}>{doc.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={(catColors[doc.cat] ?? 'gray') as any} size="sm">{doc.cat}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>{doc.rev}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {doc.date ? new Date(doc.date).toLocaleDateString('th-TH') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {doc.size_mb ? `${doc.size_mb} MB` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {doc.storage_path ? (
                        <button
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                          }}
                        >
                          <Icon name="download" size={14} />
                          ดาวน์โหลด
                        </button>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}
