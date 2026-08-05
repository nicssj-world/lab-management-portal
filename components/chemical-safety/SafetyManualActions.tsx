'use client'

import { useState } from 'react'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'

export function SafetyManualActions({ code, title }: { code: string; title: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="manual-actions">
        <a className="manual-download" href={`/api/public/safety-manual/${code}?disposition=attachment`}>ดาวน์โหลด {code} (PDF)</a>
        <button type="button" onClick={() => setOpen(true)}>เปิดอ่าน</button>
      </div>
      {open && (
        <PdfViewerModal
          url={`/api/public/safety-manual/${code}?disposition=inline`}
          title={title}
          mimeType="application/pdf"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
