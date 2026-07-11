'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'

export function NewsPdfButton({ url, title }: { url: string; title: string }) {
  const [viewerOpen, setViewerOpen] = useState(false)

  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault()
          setViewerOpen(true)
        }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 38, padding: '0 18px', borderRadius: 9,
          border: 'none', background: 'var(--primary)',
          boxShadow: '0 2px 8px rgba(30,95,173,.30)',
          textDecoration: 'none', fontSize: 13.5, color: '#fff', fontWeight: 700,
          letterSpacing: '.01em',
        }}
      >
        <Icon name="doc" size={14} />
        อ่าน PDF
      </a>
      {viewerOpen && <PdfViewerModal url={url} title={title} onClose={() => setViewerOpen(false)} />}
    </>
  )
}
