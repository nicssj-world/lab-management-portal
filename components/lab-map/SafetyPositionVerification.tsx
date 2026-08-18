'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { SafetyAssetDTO } from '@/lib/lab-map/types'

async function verifyPosition(item: SafetyAssetDTO) {
  const response = await fetch(`/api/admin/lab-map/safety-assets/${item.id}/position/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updatedAt: item.updatedAt }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'ยืนยันตำแหน่งไม่สำเร็จ')
}

export function SafetyPositionVerification({ item, disabled = false, onVerified }: {
  item: SafetyAssetDTO
  disabled?: boolean
  onVerified: () => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  if (item.positionStatus !== 'unverified') return null

  async function submit() {
    if (submitting) return
    setSubmitting(true)
    setMessage('')
    try {
      await verifyPosition(item)
      await onVerified()
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return <section className="safety-position-verification" aria-label="ยืนยันตำแหน่งหน้างาน">
    <div className="safety-position-verification-copy">
      <strong>ยืนยันตำแหน่งหน้างาน</strong>
      <small>ตรวจแล้วว่าหมุดตรงกับตำแหน่งจริง กดยืนยันได้โดยไม่ต้องถ่ายรูปใหม่</small>
    </div>
    <Button type="button" variant="secondary" size="lg" icon="check" disabled={disabled || submitting} onClick={() => void submit()}>
      {submitting ? 'กำลังยืนยัน…' : 'ยืนยันตำแหน่ง'}
    </Button>
    {message ? <p role="alert">{message}</p> : null}
  </section>
}
