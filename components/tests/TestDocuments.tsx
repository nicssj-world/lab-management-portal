'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { TestDocument } from '@/lib/supabase/types'

const DOC_TYPES = ['QP', 'WI', 'Form', 'Other'] as const
type DocType = typeof DOC_TYPES[number]

const TYPE_COLOR: Record<DocType, string> = {
  QP: '#2563EB', WI: '#059669', Form: '#D97706', Other: '#6B7280',
}

interface Props { testId: number }

export function TestDocuments({ testId }: Props) {
  const [docs, setDocs] = useState<TestDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState<DocType>('QP')
  const [dragOver, setDragOver] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/admin/tests/${testId}/documents`)
      .then(r => r.json()).then(setDocs)
  }, [testId])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500) }

  async function upload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      const res = await fetch(`/api/admin/tests/${testId}/documents`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'เกิดข้อผิดพลาด')
      setDocs(prev => [...prev, json as TestDocument])
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload(doc: TestDocument) {
    const res = await fetch(`/api/admin/tests/${testId}/documents/${doc.id}`)
    const json = await res.json()
    if (json.url) window.open(json.url, '_blank')
  }

  async function handleDelete(doc: TestDocument) {
    if (!confirm(`ลบเอกสาร "${doc.name}"?`)) return
    const res = await fetch(`/api/admin/tests/${testId}/documents/${doc.id}`, { method: 'DELETE' })
    if (res.ok) setDocs(prev => prev.filter(d => d.id !== doc.id))
    else showToast('ลบไม่สำเร็จ')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#B91C1C', color: '#fff' }}>
          {toast}
        </div>
      )}

      {/* Document list */}
      {docs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < docs.length - 1 ? '1px solid var(--border)' : 'none', background: 'var(--card)' }}
            >
              <Icon name="doc" size={15} style={{ color: '#2563EB', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--ink)' }}>{doc.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                background: TYPE_COLOR[doc.doc_type as DocType] + '18',
                color: TYPE_COLOR[doc.doc_type as DocType],
              }}>{doc.doc_type}</span>
              <button
                onClick={() => handleDownload(doc)}
                title="ดาวน์โหลด"
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <Icon name="download" size={13} />
              </button>
              <button
                onClick={() => handleDelete(doc)}
                title="ลบ"
                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #FEE2E2', background: 'transparent', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* doc_type selector */}
        <select
          value={docType}
          onChange={e => setDocType(e.target.value as DocType)}
          style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
        >
          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Drop zone */}
        <div
          style={{
            flex: 1, border: '2px dashed var(--border)', borderRadius: 8, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13,
            borderColor: dragOver ? 'var(--primary)' : 'var(--border)',
            background: dragOver ? '#EFF6FF' : 'transparent',
            transition: 'all .15s',
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) upload(file)
          }}
        >
          <Icon name="upload" size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <span style={{ color: 'var(--muted)' }}>
            {uploading ? 'กำลังอัปโหลด...' : 'คลิกหรือลากไฟล์มาวาง'}
          </span>
          <input
            ref={fileRef} type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
          />
        </div>
      </div>

      {docs.length === 0 && !uploading && (
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีเอกสาร</div>
      )}
    </div>
  )
}
