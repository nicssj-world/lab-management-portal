'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { documentPdfProxyUrl, isPdfLike } from '@/lib/pdf-viewer-utils'
import type { Document } from '@/lib/supabase/types'
import { TYPE_LABEL } from '@/lib/documents/type-labels'

const TYPE_TABS = ['All', 'QM', 'QP', 'WI', 'Form', 'Lb', 'Manual', 'Policy', 'Others'] as const
const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', QM: 'green', Lb: 'purple', Others: 'gray',
}

interface Props { docs: Document[] }

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ManualClient({ docs }: Props) {
  const [activeType, setActiveType] = useState<string>('All')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string; forcePdfJs?: boolean } | null>(null)

  const filtered = activeType === 'All' ? docs : docs.filter((d) => d.type === activeType)

  async function openPreview(doc: Document) {
    if (!doc.file_url) return
    setLoadingId(doc.id)
    try {
      const res = await fetch(`/api/documents/download?path=${encodeURIComponent(doc.file_url)}&variant=preview&inline=1`)
      const json = await res.json()
      if (json.url) setViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(doc.file_url, 'public'), title: doc.file_name ?? doc.title, forcePdfJs: json.preview_uncontrolled === true })
    } finally {
      setLoadingId(null)
    }
  }

  async function download(doc: Document) {
    if (!doc.file_url) return
    setLoadingId(doc.id)
    try {
      const res = await fetch(`/api/documents/download?path=${encodeURIComponent(doc.file_url)}&variant=download`)
      const json = await res.json()
      if (json.url) window.open(json.url, '_blank')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
      {/* Type tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TYPE_TABS.map((tab) => {
          const count = tab === 'All' ? docs.length : docs.filter((d) => d.type === tab).length
          if (tab !== 'All' && count === 0) return null
          return (
            <button
              key={tab}
              onClick={() => setActiveType(tab)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600,
                background: activeType === tab ? 'var(--primary)' : 'var(--surface-2)',
                color: activeType === tab ? '#fff' : 'var(--ink)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {tab === 'All' ? tab : (TYPE_LABEL[tab] ?? tab)} ({count})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="doc" title="ไม่มีเอกสารในหมวดนี้" hint="ลองเลือกหมวดอื่น" />
      ) : (
        <Card padding={0}>
          <StickyScroll>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  {['รหัสเอกสาร', 'ชื่อเอกสาร', 'ประเภท', 'Revision', 'วันที่มีผล', 'ขนาด', ''].map((h, i) => (
                    <th key={i} style={{ padding: '12px 16px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{doc.document_code}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--ink)' }}>{doc.title}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge color={TYPE_COLORS[doc.type] ?? 'gray'} size="sm">{doc.type}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>Rev. {doc.revision}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>
                      {doc.effective_date ? new Date(doc.effective_date).toLocaleDateString('th-TH') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: 12 }}>{fmtSize(doc.file_size)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {isPdfLike({ fileName: doc.file_name ?? doc.file_url, mimeType: doc.mime_type }) ? (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => openPreview(doc)}
                            disabled={loadingId === doc.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, opacity: loadingId === doc.id ? .5 : 1 }}
                          >
                            <Icon name="eye" size={14} />
                            {loadingId === doc.id ? 'กำลังโหลด...' : 'อ่าน'}
                          </button>
                          <button
                            onClick={() => download(doc)}
                            disabled={loadingId === doc.id}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, opacity: loadingId === doc.id ? .5 : 1 }}
                          >
                            <Icon name="download" size={14} /> ดาวน์โหลด
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => download(doc)}
                          disabled={loadingId === doc.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, opacity: loadingId === doc.id ? .5 : 1 }}
                        >
                          <Icon name="download" size={14} />
                          {loadingId === doc.id ? 'กำลังโหลด...' : 'ดาวน์โหลด'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </StickyScroll>
        </Card>
      )}
      {viewer && <PdfViewerModal url={viewer.url} pdfJsUrl={viewer.pdfJsUrl} title={viewer.title} forcePdfJs={viewer.forcePdfJs} onClose={() => setViewer(null)} />}
    </>
  )
}
