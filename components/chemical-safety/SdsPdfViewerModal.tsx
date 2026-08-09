'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { PdfViewer } from '@/components/documents/PdfViewer'
import { FONT, SPACE } from './shared/tokens'

function pdfFileName(title: string) {
  return /\.pdf$/i.test(title.trim()) ? title : `${title}.pdf`
}

export function SdsPdfViewerModal({
  url,
  title,
  onClose,
}: {
  url: string
  title: string
  onClose: () => void
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`ดูไฟล์ PDF ${title}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        background: 'rgba(0,0,0,.62)',
      }}
    >
      <div style={{
        width: 'min(1100px, 100%)', height: 'min(88vh, 900px)', minHeight: 420,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: 16, background: 'var(--card)',
        boxShadow: '0 24px 80px rgba(0,0,0,.32)',
      }}>
        <header style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.sm,
          padding: `${SPACE.sm}px ${SPACE.md}px`, borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: 'var(--primary)', fontSize: FONT.xs, fontWeight: 800,
              letterSpacing: '.08em', textTransform: 'uppercase',
            }}>
              เอกสาร SDS
            </div>
            <h2 style={{
              margin: '3px 0 0', color: 'var(--ink)', fontSize: FONT.lg,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </h2>
          </div>
          <Button variant="ghost" icon="x" title="ปิดตัวดู PDF" onClick={onClose} />
        </header>
        <div style={{ flex: 1, minHeight: 0, background: 'var(--surface-2)' }}>
          <PdfViewer
            url={url}
            fileName={pdfFileName(title)}
            forcePdfJs
          />
        </div>
      </div>
    </div>
  )
}
