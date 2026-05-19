'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getDocumentDownloadUrl } from '@/lib/queries/documents'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import type { Document } from '@/lib/supabase/types'

const CAT_OPTIONS = ['SOP', 'WI', 'Form', 'Policy', 'Manual', 'Record']
const CAT_COLORS: Record<string, string> = {
  SOP: 'blue', WI: 'teal', Form: 'gray', Policy: 'red', Manual: 'amber', Record: 'green',
}

interface Props { docs: Document[] }

export function DocumentsClient({ docs }: Props) {
  const [activeCat, setActiveCat] = useState<string>('all')
  const [showPublic, setShowPublic] = useState<'all' | 'public' | 'private'>('all')
  const supabase = createClient()

  const filtered = docs.filter((d) => {
    if (activeCat !== 'all' && d.cat !== activeCat) return false
    if (showPublic === 'public' && !d.public) return false
    if (showPublic === 'private' && d.public) return false
    return true
  })

  async function handleDownload(doc: Document) {
    if (!doc.storage_path) return
    const url = await getDocumentDownloadUrl(supabase, doc.storage_path)
    window.open(url, '_blank')
  }

  return (
    <>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setActiveCat('all')}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12.5, fontWeight: 600,
            background: activeCat === 'all' ? 'var(--primary)' : 'var(--surface-2)',
            color: activeCat === 'all' ? '#fff' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ทั้งหมด ({docs.length})
        </button>
        {CAT_OPTIONS.map((cat) => {
          const count = docs.filter((d) => d.cat === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12.5, fontWeight: 600,
                background: activeCat === cat ? 'var(--primary)' : 'var(--surface-2)',
                color: activeCat === cat ? '#fff' : 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {cat} ({count})
            </button>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['all', 'public', 'private'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setShowPublic(v)}
              style={{
                padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600,
                background: showPublic === v ? 'var(--primary-soft)' : 'var(--card)',
                color: showPublic === v ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {v === 'all' ? 'ทั้งหมด' : v === 'public' ? 'สาธารณะ' : 'ภายใน'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="doc" title="ไม่มีเอกสาร" hint="ลองเปลี่ยนตัวกรอง" />
      ) : (
        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  {['รหัสเอกสาร', 'ชื่อเอกสาร', 'ประเภท', 'Rev.', 'วันที่', 'ขนาด', 'สถานะ', 'เจ้าของ', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{doc.code}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 500, color: 'var(--ink)' }}>{doc.name}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge color={(CAT_COLORS[doc.cat] ?? 'gray') as any} size="sm">{doc.cat}</Badge>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>{doc.rev}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {doc.date ? new Date(doc.date).toLocaleDateString('th-TH') : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {doc.size_mb ? `${doc.size_mb} MB` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge color={doc.public ? 'green' : 'gray'} size="sm">{doc.public ? 'สาธารณะ' : 'ภายใน'}</Badge>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 12 }}>{doc.owner ?? '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {doc.storage_path ? (
                        <button
                          onClick={() => handleDownload(doc)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}
                        >
                          <Icon name="download" size={14} />
                          ดาวน์โหลด
                        </button>
                      ) : '—'}
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
