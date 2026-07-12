'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

interface Props {
  documentId: string
  documentName: string
}

export function QualityDocumentReadButton({ documentId, documentName }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleOpen() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/read`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถเปิดเอกสารได้')
      if (json.url) window.open(json.url, '_blank')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'ไม่สามารถเปิดเอกสารได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      title={`เปิด ${documentName}`}
      style={{
        width: 28, height: 28, borderRadius: 6,
        border: '1px solid var(--border)', background: 'transparent',
        cursor: loading ? 'not-allowed' : 'pointer',
        color: loading ? 'var(--muted)' : '#2563EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, opacity: loading ? 0.5 : 1,
      }}
    >
      <Icon name="eye" size={13} />
    </button>
  )
}
