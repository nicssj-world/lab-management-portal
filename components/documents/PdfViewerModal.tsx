'use client'

import { Icon } from '@/components/ui/Icon'
import { PdfViewer } from '@/components/documents/PdfViewer'

export function PdfViewerModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 48, background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <Icon name="doc" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <button onClick={onClose} title="ปิด" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PdfViewer url={url} fileName={title} />
      </div>
    </div>
  )
}
