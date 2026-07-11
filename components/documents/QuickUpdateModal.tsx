'use client'

import { useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { nextRevisionValue } from '@/lib/documents/workflow'
import type { Document } from '@/lib/supabase/types'

// Direct-to-R2 upload with progress (mirrors the helper in RevisionPanel.tsx — kept local so
// this modal has no dependency on that component).
function uploadFileWithProgress(url: string, file: File, contentType: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress(100); resolve(); return }
      reject(new Error(`(${xhr.status}) ${xhr.responseText.slice(0, 160)}`))
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx'
const VALID_EXT = /\.(pdf|doc|docx|xls|xlsx)$/i

interface Props {
  doc: Document
  /** true = Admin/DCC → publishes immediately; false = Reviewer → queues for approval */
  canPublish: boolean
  onClose: () => void
  onDone: (opts: { published: boolean }) => void
}

export function QuickUpdateModal({ doc, canPublish, onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const nextRev = nextRevisionValue(doc.revision)

  function pickFile(f: File | null) {
    setError('')
    if (!f) { setFile(null); return }
    if (f.size > 50 * 1024 * 1024) { setError('ไฟล์ใหญ่เกิน 50 MB'); return }
    if (!VALID_EXT.test(f.name)) { setError('รองรับเฉพาะ PDF, DOC, DOCX, XLS, XLSX'); return }
    setFile(f)
  }

  async function handleSubmit() {
    if (!file) { setError('กรุณาเลือกไฟล์'); return }
    setBusy(true)
    setError('')
    const base = `/api/admin/documents/${doc.id}/revision-drafts`
    let draftId: string | null = null
    try {
      // 1. create the working revision draft (revision auto-bumps server-side)
      const createRes = await fetch(base, { method: 'POST' })
      const draft = await createRes.json()
      if (!createRes.ok) { setError(draft.error ?? 'สร้างฉบับแก้ไขไม่สำเร็จ'); return }
      draftId = draft.id as string
      const endpoint = `${base}/${draftId}`

      // 2. presign + upload the new official file directly to R2, then confirm
      const fileType = file.type || 'application/octet-stream'
      const presignRes = await fetch(`${endpoint}?${new URLSearchParams({
        intent: 'upload', kind: 'official', fileName: file.name, fileType, fileSize: String(file.size),
      })}`)
      const presign = await presignRes.json()
      if (!presignRes.ok || !presign.uploadUrl || !presign.key) {
        setError(presign.error ?? 'สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ'); return
      }
      setProgress(0)
      await uploadFileWithProgress(presign.uploadUrl, file, presign.contentType ?? fileType, setProgress)
      const confirmRes = await fetch(endpoint, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploaded_file: { kind: 'official', key: presign.key, fileName: file.name, fileType: presign.contentType ?? fileType, fileSize: file.size } }),
      })
      const confirmed = await confirmRes.json()
      if (!confirmRes.ok) { setError(confirmed.error ?? 'บันทึกไฟล์ไม่สำเร็จ'); return }

      // 3. finalize by role: Admin/DCC publish immediately, Reviewer queues at Approved
      const targetStatus = canPublish ? 'Published' : 'Approved'
      const finalizeRes = await fetch(endpoint, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, description: note.trim() || undefined }),
      })
      const finalized = await finalizeRes.json()
      if (!finalizeRes.ok) { setError(finalized.error ?? 'ดำเนินการไม่สำเร็จ'); return }

      draftId = null // committed — do not clean up
      onDone({ published: canPublish })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ')
    } finally {
      // clean up an orphan draft if we bailed after creating it (keeps the pending queue tidy)
      if (draftId) {
        try { await fetch(`${base}/${draftId}`, { method: 'DELETE' }) } catch { /* non-fatal */ }
      }
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Card padding={24} style={{ maxWidth: 520, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>อัปเดตเอกสาร (Upd+)</div>
          <button onClick={onClose} disabled={busy} style={{ background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{doc.title}</div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'monospace', marginTop: 2 }}>{doc.document_code}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Rev. <b style={{ color: 'var(--ink)' }}>{doc.revision ?? '1'}</b> → <b style={{ color: 'var(--primary)' }}>{nextRev}</b>
          </div>
        </div>

        {/* File picker */}
        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (busy) return
            pickFile(e.dataTransfer.files?.[0] ?? null)
          }}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, padding: 20, textAlign: 'center',
            cursor: busy ? 'not-allowed' : 'pointer', background: dragOver ? 'var(--primary-soft)' : 'var(--surface-2)',
            marginBottom: 14, transition: 'border-color .12s, background .12s',
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="upload" size={20} style={{ color: dragOver ? 'var(--primary)' : 'var(--muted)', flexShrink: 0 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {file ? file.name : dragOver ? 'ปล่อยไฟล์ที่นี่' : 'เลือกไฟล์ใหม่ หรือลากไฟล์มาวาง (PDF, DOC, DOCX, XLS, XLSX)'}
            </div>
          </div>
          {file && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB</div>}
        </div>

        {/* Note */}
        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>รายละเอียดการแก้ไข (ไม่บังคับ)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          rows={2}
          placeholder="สรุปสิ่งที่เปลี่ยนแปลง..."
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {progress !== null && (
          <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width .15s' }} />
          </div>
        )}

        {error && <div style={{ padding: '9px 12px', borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
          {canPublish
            ? 'เมื่อยืนยัน เอกสารจะถูกเผยแพร่ (Published) ทันที และไฟล์เดิมจะเข้าประวัติการแก้ไข'
            : 'เมื่อยืนยัน จะส่งเข้าคิว "รอเผยแพร่" ให้ DCC/Admin ตรวจและเผยแพร่ เอกสารเดิมยังคงเผยแพร่อยู่จนกว่าจะอนุมัติ'}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={busy || !file}>
            {busy ? 'กำลังดำเนินการ...' : canPublish ? 'อัปเดตและเผยแพร่' : 'ส่งเข้าคิวรอเผยแพร่'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
