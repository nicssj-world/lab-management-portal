'use client'

import { useState } from 'react'
import { SdsPdfViewerModal } from './SdsPdfViewerModal'

export function SafetyManualActions({ code, title }: { code: string; title: string }) {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <div className="manual-actions">
        <a className="manual-download" href={`/api/public/safety-manual/${code}?disposition=attachment`}>ดาวน์โหลด {code} (PDF)</a>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          aria-haspopup="dialog"
          aria-label={`เปิด ${title} ภายในหน้า`}
        >
          เปิดอ่าน
        </button>
      </div>
      {previewOpen && (
        <SdsPdfViewerModal
          url={`/api/public/safety-manual/${code}?disposition=inline`}
          title={title}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}
