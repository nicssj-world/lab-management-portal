'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { RiskDropzone } from './RiskDropzone'
import { FONT, SPACE, formatThaiDate, tabularNums } from './tokens'

export type RiskAttachment = {
  id: string
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_at: string
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function iconFor(contentType: string) {
  if (contentType.startsWith('image/')) return 'eye'
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'chart'
  return 'doc'
}

/** ไฟล์หลักฐานประกอบเรื่อง — อัปโหลดตรงไปยัง R2 แล้วยืนยันกลับมาที่ระบบ */
export function AttachmentPanel({ attachments, target, canManage, onChanged }: {
  attachments: RiskAttachment[]
  target: { incidentId?: number; registerId?: number }
  canManage: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(file: File) {
    setBusy(true)
    setError('')
    try {
      const presignRes = await fetch('/api/admin/risk/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...target,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error ?? 'ขอสิทธิ์อัปโหลดไม่สำเร็จ')

      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!put.ok) throw new Error('อัปโหลดไฟล์ไปยังที่จัดเก็บไม่สำเร็จ')

      const finalizeRes = await fetch('/api/admin/risk/attachments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, key: presign.key, fileName: file.name }),
      })
      const finalize = await finalizeRes.json()
      if (!finalizeRes.ok) throw new Error(finalize.error ?? 'บันทึกไฟล์ไม่สำเร็จ')

      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(attachment: RiskAttachment) {
    if (!window.confirm(`ลบไฟล์ ${attachment.file_name} หรือไม่`)) return
    setBusy(true)
    setError('')
    const res = await fetch(`/api/admin/risk/attachments/${attachment.id}`, { method: 'DELETE' })
    if (!res.ok) setError('ลบไฟล์ไม่สำเร็จ')
    else onChanged()
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      {error && <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: FONT.base }}>{error}</p>}

      {attachments.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map(file => (
            <li
              key={file.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8 }}
            >
              <a
                href={`/api/admin/risk/attachments/${file.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, minHeight: 44, color: 'var(--ink)', textDecoration: 'none' }}
              >
                <Icon name={iconFor(file.content_type)} size={16} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: FONT.md, fontWeight: 600, color: 'var(--primary)' }}>{file.file_name}</span>
                  <span style={{ display: 'block', fontSize: FONT.xs, color: 'var(--muted)', ...tabularNums }}>
                    {formatSize(file.size_bytes)} · อัปโหลด {formatThaiDate(file.uploaded_at.slice(0, 10))}
                  </span>
                </span>
              </a>
              {canManage && (
                <Button variant="ghost" size="sm" icon="trash" onClick={() => void remove(file)} disabled={busy}>ลบ</Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <RiskDropzone
          accept={ACCEPT}
          disabled={busy}
          onFiles={files => void upload(files[0])}
          title={busy ? 'กำลังอัปโหลด…' : 'คลิกหรือลากไฟล์หลักฐานมาวางที่นี่'}
          hint="รองรับ PDF, JPG, PNG, WEBP, XLS และ XLSX ขนาดไม่เกิน 20 MB"
        />
      )}

      {!canManage && attachments.length === 0 && (
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.md }}>ยังไม่มีไฟล์หลักฐานแนบไว้</p>
      )}
    </div>
  )
}
