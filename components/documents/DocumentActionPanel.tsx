'use client'

import { useCallback, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { allowedTransitions, type DocStatus } from '@/lib/documents/transitions'
import { canMoveToStatus, isCoverRequiredType } from '@/lib/documents/workflow'
import { STATUS_COLOR, STATUS_LABEL, TYPE_ICON_BG, TYPE_ICON_FG, fmtSize } from '@/lib/documents/ui-constants'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import type { Document } from '@/lib/supabase/types'

// A focused DCC action panel for a single `documents` row on the pending-approval page:
// preview/download the current files, upload/replace the official content PDF, and advance
// the status — so DCC can finish the job without leaving for the document library. Working
// revision drafts (on already-Published docs) still use RevisionPanel instead.
export function DocumentActionPanel({ doc: initialDoc, userRole, docRole, onClose, onUpdated }: {
  doc: Document
  userRole: string
  docRole?: string | null
  onClose: () => void
  onUpdated: (updated: Document) => void
}) {
  const [doc, setDoc] = useState<Document>(initialDoc)
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pdfViewer, setPdfViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string; mimeType?: string | null } | null>(null)

  // Same gate as RevisionPanel's canManageDraftOfficial — only DCC/Admin set the content PDF.
  const canManageOfficial = userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller'
  const isQpWi = isCoverRequiredType(doc.type)
  // The pending page's workflow stops at Published — obsoleting a document is done from the
  // document library instead, so never offer the Obsolete transition here.
  const transitions = allowedTransitions(doc.status as DocStatus, userRole, docRole ?? undefined)
    .filter((s) => s !== 'Obsolete')

  async function handleUploadOfficial(file: File | null) {
    if (!file || !canManageOfficial) return
    if (file.size > 50 * 1024 * 1024) { alert('ไฟล์ทางการใหญ่เกิน 50 MB'); return }
    if (isQpWi && !/\.pdf$/i.test(file.name)) { alert('QP/WI ต้องใช้ไฟล์ PDF เนื้อหา'); return }
    if (!isQpWi && !/\.(pdf|doc|docx|xls|xlsx)$/i.test(file.name)) { alert('ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX เท่านั้น'); return }
    setBusy(true)
    try {
      const presignParams = new URLSearchParams({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: String(file.size),
        type: doc.type,
      })
      const presignRes = await fetch(`/api/admin/documents/presign-file?${presignParams}`)
      const presignJson = await presignRes.json().catch(() => ({}))
      if (!presignRes.ok) { alert(presignJson.error ?? 'สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ'); return }
      const { uploadMode, uploadUrl, key, contentType } = presignJson as { uploadMode?: string; uploadUrl?: string; key?: string; contentType?: string }
      if (uploadMode !== 'direct-r2' || !uploadUrl || !key) { alert('สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ: production อาจยังไม่ใช่โค้ด direct upload ล่าสุด'); return }

      setUploadProgress(0)
      await uploadFileWithProgress(uploadUrl, file, contentType ?? file.type, setUploadProgress)

      // Official file goes to the API as multipart form-data (file_key), never JSON — the
      // route only reads file_key from a form. This is separate from any status change.
      const fd = new FormData()
      fd.append('file_key', key)
      fd.append('file_name', file.name)
      fd.append('file_size', String(file.size))
      fd.append('file_type', contentType ?? file.type ?? '')
      const patchRes = await fetch(`/api/admin/documents/${doc.id}`, { method: 'PATCH', body: fd })
      const patchJson = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) { alert(patchJson.error ?? 'บันทึกไฟล์ทางการไม่สำเร็จ'); return }
      setDoc(patchJson as Document)
      onUpdated(patchJson as Document)
    } catch (err) {
      alert(`อัปโหลดไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setUploadProgress(null)
      setBusy(false)
    }
  }

  async function handleStatusChange(next: DocStatus) {
    setBusy(true)
    try {
      const body: Record<string, string> = { status: next }
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert(json.error ?? 'เปลี่ยนสถานะไม่สำเร็จ'); return }
      setDoc(json as Document)
      onUpdated(json as Document)
    } catch {
      alert('เปลี่ยนสถานะไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function handlePreview(path: string, title: string) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/read`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.url) { alert(json.error ?? 'เปิดไฟล์ไม่สำเร็จ'); return }
      setPdfViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(path), title, mimeType: json.mime_type ?? null })
    } catch {
      alert('เปิดไฟล์ไม่สำเร็จ')
    }
  }

  async function handleDownload(path: string) {
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}&variant=download`)
      const json = await res.json()
      if (json.url) window.open(json.url, '_blank')
    } catch { /* ignore */ }
  }

  const onDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); dragCounter.current += 1; setDragOver(true) }, [])
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); dragCounter.current -= 1; if (dragCounter.current === 0) setDragOver(false) }, [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && !busy) void handleUploadOfficial(file)
  }, [busy]) // eslint-disable-line react-hooks/exhaustive-deps

  const officialIsPdf = /\.pdf$/i.test(doc.file_name ?? doc.file_url ?? '')

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
        <div style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', background: 'var(--card)', borderRadius: 20, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(15,23,42,.2), 0 0 0 1px rgba(15,23,42,.05)', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
          {/* Header */}
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="doc" size={18} style={{ color: TYPE_ICON_FG[doc.type] ?? '#64748B' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{doc.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{doc.document_code}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {doc.type}</span>
                {doc.revision && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· Rev.{doc.revision}</span>}
                <Badge color={STATUS_COLOR[doc.status as DocStatus] ?? 'gray'} size="sm">{STATUS_LABEL[doc.status as DocStatus] ?? doc.status}</Badge>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}>
              <Icon name="x" size={18} />
            </button>
          </div>

          {/* Files */}
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>ไฟล์เอกสาร</div>
            {/* Official content file */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <Icon name="doc" size={15} style={{ color: doc.file_url ? '#DC2626' : 'var(--muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.file_url ? (doc.file_name ?? 'ไฟล์ทางการ') : (isQpWi ? 'ยังไม่มี PDF เนื้อหา' : 'ยังไม่มีไฟล์ทางการ')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  {doc.file_url ? `ไฟล์ทางการ · ${fmtSize(doc.file_size)}` : 'รอ DCC จัดทำ/อัปโหลด'}
                </div>
              </div>
              {doc.file_url && officialIsPdf && (
                <button onClick={() => handlePreview(doc.file_url!, doc.file_name ?? doc.title)} title="เปิดอ่าน"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}>
                  <Icon name="eye" size={14} />
                </button>
              )}
              {doc.file_url && (
                <button onClick={() => handleDownload(doc.file_url!)} title="ดาวน์โหลด"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}>
                  <Icon name="download" size={14} />
                </button>
              )}
            </div>
            {/* Source Word/Excel file */}
            {doc.word_url && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                <Icon name="doc" size={15} style={{ color: '#2563EB', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.word_name ?? 'ไฟล์ต้นฉบับ'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>ไฟล์ต้นฉบับ Word/Excel · {fmtSize(doc.word_size)}</div>
                </div>
                <button onClick={() => handleDownload(doc.word_url!)} title="ดาวน์โหลดไฟล์ต้นฉบับ"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}>
                  <Icon name="download" size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Upload / replace content PDF */}
          {canManageOfficial && doc.status !== 'Published' && doc.status !== 'Obsolete' && (
            <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                {doc.file_url ? 'แทนที่ไฟล์ทางการ' : (isQpWi ? 'อัปโหลด PDF เนื้อหา' : 'อัปโหลดไฟล์ทางการ')}
              </div>
              <div
                onClick={() => !busy && fileInputRef.current?.click()}
                onDragEnter={onDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{ border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, padding: '16px', background: dragOver ? 'var(--primary-soft)' : 'var(--surface-2)', cursor: busy ? 'default' : 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: busy ? .7 : 1 }}
              >
                <Icon name="upload" size={14} style={{ color: dragOver ? 'var(--primary)' : 'var(--muted)', flexShrink: 0 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: dragOver ? 'var(--primary)' : 'var(--ink)' }}>
                    {uploadProgress !== null ? `กำลังอัปโหลด... ${uploadProgress}%` : 'ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{isQpWi ? 'เฉพาะ PDF เนื้อหา (ไม่มีหน้าปก)' : 'PDF, DOC, DOCX, XLS, XLSX'}</div>
                </div>
              </div>
              <input ref={fileInputRef} type="file" style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.[0]) handleUploadOfficial(e.target.files[0]) }} />
            </div>
          )}

          {/* Status transitions */}
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>เลื่อนสถานะ</div>
            {transitions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>ไม่มีการเปลี่ยนสถานะที่ทำได้จากสถานะนี้</div>
            ) : (
              <>
                {transitions.map((next) => {
                  const check = canMoveToStatus({
                    type: doc.type,
                    status: doc.status,
                    file_url: doc.file_url,
                    source_pdf_url: doc.source_pdf_url,
                    word_url: doc.word_url,
                  }, next)
                  const disabled = busy || !check.ok
                  return (
                    <button
                      key={next}
                      disabled={disabled}
                      title={!check.ok ? check.error : undefined}
                      onClick={() => check.ok && handleStatusChange(next)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .12s', opacity: disabled ? 0.55 : 1 }}
                      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--primary)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>เปลี่ยนเป็น {STATUS_LABEL[next]}</span>
                      <Badge color={STATUS_COLOR[next]} size="sm">{next}</Badge>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {pdfViewer && (
        <PdfViewerModal url={pdfViewer.url} pdfJsUrl={pdfViewer.pdfJsUrl} title={pdfViewer.title} mimeType={pdfViewer.mimeType ?? undefined} onClose={() => setPdfViewer(null)} />
      )}
    </>
  )
}
