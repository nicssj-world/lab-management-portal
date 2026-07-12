'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { canUseDocumentAction, type DocumentAccessMode, type DocumentAction } from '@/lib/tests/document-access'

interface Props {
  testId: number
  source: 'library' | 'attachment'
  documentId: string
  accessMode: DocumentAccessMode
}

export function TestDocumentActions({ testId, source, documentId, accessMode }: Props) {
  const [loading, setLoading] = useState<DocumentAction | null>(null)

  async function open(action: DocumentAction) {
    setLoading(action)
    try {
      const response = await fetch(`/api/admin/tests/${testId}/document-actions/${source}/${documentId}?action=${action}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'ไม่สามารถเปิดเอกสารได้')
      if (body.url) window.open(body.url, '_blank')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ไม่สามารถเปิดเอกสารได้')
    } finally {
      setLoading(null)
    }
  }

  const buttonStyle: React.CSSProperties = {
    width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
    background: 'transparent', cursor: 'pointer', color: '#2563EB',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  }

  return (
    <span style={{ display: 'flex', gap: 5 }}>
      {canUseDocumentAction(accessMode, 'view') && <button onClick={() => void open('view')} disabled={loading !== null} title="เปิดดู" style={{ ...buttonStyle, opacity: loading ? .5 : 1 }}><Icon name="eye" size={13} /></button>}
      {canUseDocumentAction(accessMode, 'download') && <button onClick={() => void open('download')} disabled={loading !== null} title="ดาวน์โหลด" style={{ ...buttonStyle, opacity: loading ? .5 : 1 }}><Icon name="download" size={13} /></button>}
    </span>
  )
}
