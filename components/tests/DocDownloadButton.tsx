'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'

interface Props {
  testId: number
  docId: number
  docName: string
}

export function DocDownloadButton({ testId, docId, docName }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tests/${testId}/documents/${docId}`)
      const json = await res.json()
      if (json.url) {
        const a = document.createElement('a')
        a.href = json.url
        a.download = docName
        a.target = '_blank'
        a.click()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      title="ดาวน์โหลด"
      style={{
        width: 28, height: 28, borderRadius: 6,
        border: '1px solid var(--border)', background: 'transparent',
        cursor: loading ? 'not-allowed' : 'pointer',
        color: loading ? 'var(--muted)' : '#2563EB',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, opacity: loading ? 0.5 : 1,
      }}
    >
      <Icon name="download" size={13} />
    </button>
  )
}
