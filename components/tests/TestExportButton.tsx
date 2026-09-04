'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Props {
  search: string
  categoryId: string
  tube: string
  department: string
  sortBy: string
  sortDir: 'asc' | 'desc'
}

export function TestExportButton({ search, categoryId, tube, department, sortBy, sortDir }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setBusy(true)
    setError('')
    try {
      const params = new URLSearchParams({
        active: 'true',
        sortBy,
        sortDir,
      })
      if (search) params.set('search', search)
      if (categoryId) params.set('category', categoryId)
      if (tube) params.set('tube', tube)
      if (department) params.set('department', department)

      const response = await fetch(`/api/admin/tests/export?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(body?.error ?? 'ส่งออก Excel ไม่สำเร็จ')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const contentDisposition = response.headers.get('content-disposition') ?? ''
      const filename = contentDisposition.match(/filename="([^"]+)"/)?.[1]
        ?? `test-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ส่งออก Excel ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon="download"
        onClick={handleExport}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? 'กำลังส่งออก...' : 'ส่งออก Excel'}
      </Button>
      {error && (
        <span role="alert" aria-live="assertive" style={{ color: '#B91C1C', fontSize: 11.5, maxWidth: 220 }}>
          {error}
        </span>
      )}
    </>
  )
}
