'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { PdfViewerModal, type Attachment } from '@/components/documents/DocumentDetailModal'
import { allowedTransitions } from '@/lib/documents/transitions'
import { canMoveToStatus, COVER_GENERATION_ENABLED } from '@/lib/documents/workflow'
import { STATUS_COLOR, STATUS_LABEL, fmtDate } from '@/lib/documents/ui-constants'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import type { DocStatus } from '@/lib/documents/transitions'
import type { Document, DocumentRevisionDraft } from '@/lib/supabase/types'

function uploadFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      reject(new Error(`(${xhr.status}) ${xhr.responseText.slice(0, 160)}`))
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })
}

// ── Revision type ─────────────────────────────────────────────
interface RevisionRow {
  id: string
  revision_number: string
  revision_note: string | null
  revised_by: string | null
  approved_by: string | null
  file_url: string | null
  file_name: string | null
  edit_date?: string | null
  effective_date?: string | null
  approved_at?: string | null
  published_at?: string | null
  created_at: string
  history_source?: string | null
}

// ── Revision History Panel ─────────────────────────────────────
export function RevisionPanel({ doc, onClose, onDownload, onPromoted, onDraftStatusChange, userRole, docRole, canAdd, variant = 'drawer' }: {
  doc: Document
  onClose: () => void
  onDownload: (path: string) => void
  onPromoted: (updated: Document) => void
  /** Fires on every working-revision-draft status change that ISN'T the final publish
   *  (Draft↔Review↔Approved) — lets a caller re-bucket the draft in a pending-work list
   *  without a full page refresh. `onPromoted` still covers the Published transition. */
  onDraftStatusChange?: (draft: DocumentRevisionDraft) => void
  userRole: string
  docRole?: string
  canAdd: boolean
  /** 'drawer' (default) slides in from the right, keeping content behind it visible —
   *  used on the documents library page. 'modal' centers the panel over a dimmed backdrop —
   *  used on pages without a wide table to keep visible alongside (e.g. รออนุมัติ). */
  variant?: 'drawer' | 'modal'
}) {

  const canDownloadRevision = userRole === 'Admin' || docRole === 'Document Controller'
  // "ดาวน์โหลดทั้งหมด (ZIP)" is restricted to Reviewer/DCC/Admin — other roles use the
  // per-file download buttons on each attachment instead.
  const canDownloadAll = userRole === 'Admin' || userRole === 'Document Controller' || userRole === 'Reviewer'
    || docRole === 'Document Controller' || docRole === 'Reviewer'
  const allowRevisionHistoryBackfill = canAdd && (userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller')
  const canSkipSystemCover = userRole === 'Admin'
    || userRole === 'Quality Manager'
    || userRole === 'Laboratory Director'
    || docRole === 'Quality Manager'
    || docRole === 'Laboratory Director'
  const canManageDraftOfficial = userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller'
  const allowCurrentRevisionRollback = doc.status === 'Published'
    && (userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller')

  const [revisions, setRevisions] = useState<RevisionRow[]>([])
  const [activeDraft, setActiveDraft] = useState<DocumentRevisionDraft | null>(null)
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftUploadProgress, setDraftUploadProgress] = useState<number | null>(null)
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([])
  const [attachUploading, setAttachUploading] = useState(false)
  const [attachUploadProgress, setAttachUploadProgress] = useState<number | null>(null)
  const [attachDragOver, setAttachDragOver] = useState(false)
  const [zipBusy, setZipBusy] = useState(false)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const [skipSystemCover, setSkipSystemCover] = useState(false)
  const [removePortalRevisionHistory, setRemovePortalRevisionHistory] = useState(true)
  const [draftFormOpen, setDraftFormOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDepartment, setDraftDepartment] = useState('')
  const [draftOwnerName, setDraftOwnerName] = useState('')
  const [draftReviewerName, setDraftReviewerName] = useState('')
  const [draftApproverName, setDraftApproverName] = useState('')
  const [draftEditDate, setDraftEditDate] = useState('')
  const [draftEffectiveDate, setDraftEffectiveDate] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftDescriptionEditing, setDraftDescriptionEditing] = useState(true)
  const [loading, setLoading]     = useState(true)
  const [deletingCurrent, setDeletingCurrent] = useState(false)
  const [pdfViewer, setPdfViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string } | null>(null)

  // Add form state
  const [showForm, setShowForm]           = useState(false)
  const [formRev, setFormRev]             = useState('')
  const [formNote, setFormNote]           = useState('')
  const [formDate, setFormDate]           = useState('')
  const [formFile, setFormFile]           = useState<File | null>(null)
  const [formRevisedBy, setFormRevisedBy]   = useState('')
  const [formApprover, setFormApprover]     = useState('')
  const [formSaving, setFormSaving]         = useState(false)
  const [formError, setFormError]           = useState('')
  const formFileRef = useRef<HTMLInputElement>(null)
  const [draftSourceDragOver, setDraftSourceDragOver] = useState(false)
  const [draftOfficialDragOver, setDraftOfficialDragOver] = useState(false)
  const draftSourceDragCounter = useRef(0)
  const draftOfficialDragCounter = useRef(0)
  const draftDescriptionContext = useRef('')
  const draftOfficialRef = useRef<HTMLInputElement>(null)
  const draftSourceRef = useRef<HTMLInputElement>(null)

  // Edit revision state
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [editRev, setEditRev]               = useState('')
  const [editNote, setEditNote]             = useState('')
  const [editDate, setEditDate]             = useState('')
  const [editRevisedBy, setEditRevisedBy]   = useState('')
  const [editApprover, setEditApprover]     = useState('')
  const [editSaving, setEditSaving]         = useState(false)
  const [editError, setEditError]           = useState('')

  function startEdit(rev: RevisionRow) {
    setEditingId(rev.id)
    setEditRev(rev.revision_number)
    setEditNote(rev.revision_note ?? '')
    setEditRevisedBy(rev.revised_by ?? '')
    setEditApprover(rev.approved_by ?? '')
    setEditDate(rev.created_at ? rev.created_at.split('T')[0] : '')
    setEditError('')
  }

  async function handleDeleteRevision(revId: string) {
    if (!confirm('ลบประวัติการแก้ไขนี้?')) return
    const res = await fetch(`/api/admin/documents/${doc.id}/revisions/${revId}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) {
      setRevisions(prev => prev.filter(r => r.id !== revId))
    }
  }

  async function handleDeleteCurrentRevision() {
    if (revisions.length === 0) return
    if (!confirm(`ลบ Rev. ${doc.revision} ล่าสุด และเลื่อน Rev. ${revisions[0].revision_number} ขึ้นมาแทน?`)) return
    setDeletingCurrent(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/current-revision`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'ลบ Revision ล่าสุดไม่สำเร็จ')
        return
      }
      setRevisions(prev => prev.filter(r => r.id !== json.promotedRevisionId))
      onPromoted(json.document)
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setDeletingCurrent(false)
    }
  }

  async function handleSaveEdit(revId: string) {
    const editingRevision = revisions.find((r) => r.id === revId)
    const dateOnlyEdit = editingRevision?.history_source !== 'backfill'
    if (!dateOnlyEdit && !editRev.trim()) { setEditError('กรุณากรอกหมายเลข Revision'); return }
    if (dateOnlyEdit && !editDate) { setEditError('กรุณาเลือกวันที่แก้ไข'); return }
    setEditSaving(true); setEditError('')
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revisions/${revId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dateOnlyEdit
          ? { revision_date: editDate }
          : {
              revision_number: editRev.trim(),
              revision_note: editNote.trim() || null,
              revised_by: editRevisedBy.trim() || null,
              approved_by: editApprover.trim() || null,
              revision_date: editDate || undefined,
            }),
      })
      const json = await res.json()
      if (!res.ok) { setEditError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setRevisions(prev => prev.map(r => r.id === revId ? { ...r, ...json } : r))
      setEditingId(null)
    } catch { setEditError('เกิดข้อผิดพลาด') }
    finally { setEditSaving(false) }
  }

  function downloadRevisionHistory() {
    window.open(`/api/admin/documents/${doc.id}/revisions?format=pdf`, '_blank')
  }

  function loadRevisions() {
    setLoading(true)
    fetch(`/api/admin/documents/${doc.id}/revisions`)
      .then((r) => r.json())
      .then((d) => setRevisions(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function loadActiveDraft() {
    fetch(`/api/admin/documents/${doc.id}/revision-drafts`)
      .then((r) => r.json())
      .then((d) => setActiveDraft(d?.id ? d : null))
      .catch(() => setActiveDraft(null))
  }

  useEffect(() => {
    loadRevisions()
    loadActiveDraft()
  }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeDraft) {
      setDraftFormOpen(false)
      setSkipSystemCover(false)
      setRemovePortalRevisionHistory(true)
      setDraftDescriptionEditing(true)
      draftDescriptionContext.current = ''
      return
    }
    if (activeDraft.type !== 'QP' && activeDraft.type !== 'WI') setSkipSystemCover(false)
    setDraftTitle(activeDraft.title ?? '')
    setDraftDepartment(activeDraft.department ?? '')
    setDraftOwnerName(activeDraft.owner_name ?? '')
    setDraftReviewerName(activeDraft.reviewer_name ?? '')
    setDraftApproverName(activeDraft.approver_name ?? '')
    setDraftEditDate(activeDraft.edit_date ?? '')
    setDraftEffectiveDate(activeDraft.effective_date ?? '')
    const inheritedDescription = Boolean(
      activeDraft.description?.trim()
      && doc.description?.trim()
      && activeDraft.description.trim() === doc.description.trim(),
    )
    const cleanDescription = inheritedDescription ? '' : activeDraft.description ?? ''
    setDraftDescription(cleanDescription)
    const descriptionContext = activeDraft.word_url ? `${activeDraft.id}:${activeDraft.word_url}` : `${activeDraft.id}:no-source`
    if (draftDescriptionContext.current !== descriptionContext) {
      setDraftDescriptionEditing(!activeDraft.word_url || !cleanDescription.trim())
      draftDescriptionContext.current = descriptionContext
    }
  }, [activeDraft, doc.description])

  // Load attachments for the active draft
  useEffect(() => {
    if (!activeDraft?.id) { setDraftAttachments([]); return }
    fetch(`/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}/attachments`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setDraftAttachments(d) })
      .catch(() => {})
  }, [activeDraft?.id, doc.id])

  async function handleDraftAttachUpload(files: FileList | File[]) {
    if (!activeDraft) return
    const arr = Array.from(files)
    if (!arr.length) return
    setAttachUploading(true)
    setAttachUploadProgress(0)
    const fd = new FormData()
    for (const f of arr) fd.append('files', f)
    try {
      const result = await new Promise<{ ok: boolean; body: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}/attachments`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setAttachUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: xhr.responseText })
        xhr.onerror = () => reject(new Error('network'))
        xhr.send(fd)
      })
      const json = result.body ? JSON.parse(result.body) : null
      if (!result.ok) { alert(json?.error ?? 'อัปโหลดไฟล์แนบไม่สำเร็จ'); return }
      setDraftAttachments((prev) => [...prev, ...(Array.isArray(json) ? json : [])])
    } catch {
      alert('อัปโหลดไฟล์แนบไม่สำเร็จ')
    } finally {
      setAttachUploading(false)
      setAttachUploadProgress(null)
    }
  }

  async function handleDraftAttachDelete(attachId: string) {
    if (!activeDraft) return
    if (!confirm('ลบไฟล์แนบนี้?')) return
    const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}/attachments/${attachId}`, { method: 'DELETE' })
    if (res.ok) setDraftAttachments((prev) => prev.filter((a) => a.id !== attachId))
  }

  async function handleReadAttachment(path: string, fileName: string) {
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}&inline=1`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPdfViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(path), title: fileName })
    } catch {
      alert('เปิดไฟล์ไม่สำเร็จ')
    }
  }

  function handleDownloadDraftZip() {
    if (!activeDraft) return
    setZipBusy(true)
    const a = document.createElement('a')
    a.href = `/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}/download-zip`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => setZipBusy(false), 1500)
  }

  async function handleCreateDraftFromPanel() {
    setDraftBusy(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'สร้าง working revision ไม่สำเร็จ'); return }
      setActiveDraft(json)
    } catch {
      alert('สร้าง working revision ไม่สำเร็จ')
    } finally {
      setDraftBusy(false)
    }
  }

  function parseDraftUploadResponse(text: string): { error?: string; uploadMode?: string; uploadUrl?: string; key?: string; contentType?: string } {
    if (!text) return {}
    try {
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  async function handleDraftFile(kind: 'official' | 'source', file: File | null) {
    if (!activeDraft || !file) return
    if (file.size > 50 * 1024 * 1024) {
      alert(kind === 'source' ? 'ไฟล์ต้นฉบับใหญ่เกิน 50 MB' : 'ไฟล์ทางการใหญ่เกิน 50 MB')
      return
    }
    if (kind === 'source' && !/\.(doc|docx|xls|xlsx)$/i.test(file.name)) {
      alert('ช่อง Word/Excel รองรับเฉพาะไฟล์ DOC, DOCX, XLS, XLSX เท่านั้น')
      return
    }
    if (kind === 'official' && !canManageDraftOfficial) {
      alert('เฉพาะ Admin หรือ Document Controller เท่านั้นที่อัปโหลด PDF เนื้อหา/ไฟล์ทางการได้')
      return
    }
    if (kind === 'official') {
      const isQpWi = activeDraft.type === 'QP' || activeDraft.type === 'WI'
      const allowed = isQpWi ? /\.pdf$/i.test(file.name) : /\.(pdf|doc|docx|xls|xlsx)$/i.test(file.name)
      if (!allowed) {
        alert(isQpWi ? 'QP/WI ต้องใช้ไฟล์ PDF ในช่องไฟล์ทางการ' : 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX เท่านั้น')
        return
      }
    }
    setDraftBusy(true)
    try {
      const endpoint = `/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}`
      const fileType = file.type || 'application/octet-stream'
      const uploadParams = new URLSearchParams({
        intent: 'upload',
        kind,
        fileName: file.name,
        fileType,
        fileSize: String(file.size),
      })
      const presignRes = await fetch(`${endpoint}?${uploadParams.toString()}`)
      const presignText = await presignRes.text()
      const presignJson = parseDraftUploadResponse(presignText)
      if (!presignRes.ok) {
        alert(presignJson.error ?? `สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ (${presignRes.status}) ${presignText.slice(0, 160)}`)
        return
      }
      if (presignJson.uploadMode !== 'direct-r2') {
        alert(`สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ: production อาจยังไม่ใช่โค้ด direct upload ล่าสุด ${presignText.slice(0, 160)}`)
        return
      }
      if (!presignJson.uploadUrl || !presignJson.key) {
        alert(`สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ: response ไม่ครบ ${presignText.slice(0, 160)}`)
        return
      }

      try {
        setDraftUploadProgress(0)
        await uploadFileWithProgress(presignJson.uploadUrl, file, presignJson.contentType ?? fileType, setDraftUploadProgress)
      } catch (err) {
        alert(`อัปโหลดไฟล์ไปยัง storage ไม่สำเร็จ ${err instanceof Error ? err.message : String(err)}`)
        setDraftUploadProgress(null)
        return
      }
      const confirmRes = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploaded_file: {
            kind,
            key: presignJson.key,
            fileName: file.name,
            fileType: presignJson.contentType ?? fileType,
            fileSize: file.size,
          },
        }),
      })
      const confirmText = await confirmRes.text()
      const json = parseDraftUploadResponse(confirmText)
      if (!confirmRes.ok) { alert(json.error ?? `บันทึกข้อมูลไฟล์ไม่สำเร็จ (${confirmRes.status}) ${confirmText.slice(0, 160)}`); return }
      setActiveDraft(json as DocumentRevisionDraft)
    } catch (err) {
      alert(`อัปโหลดไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (draftOfficialRef.current) draftOfficialRef.current.value = ''
      if (draftSourceRef.current) draftSourceRef.current.value = ''
      setDraftUploadProgress(null)
      setDraftBusy(false)
    }
  }

  async function handleSaveDraftMetadata() {
    if (!activeDraft) return
    if (!draftTitle.trim()) {
      alert('กรุณากรอกชื่อเอกสารของ working revision')
      return
    }
    setDraftBusy(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          department: draftDepartment.trim() || undefined,
          owner_name: draftOwnerName.trim() || undefined,
          reviewer_name: draftReviewerName.trim() || undefined,
          approver_name: draftApproverName.trim() || undefined,
          edit_date: draftEditDate || undefined,
          effective_date: draftEffectiveDate || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'บันทึก metadata ของ working revision ไม่สำเร็จ')
        return
      }
      setActiveDraft(json)
      setDraftFormOpen(false)
    } catch {
      alert('บันทึก metadata ของ working revision ไม่สำเร็จ')
    } finally {
      setDraftBusy(false)
    }
  }

  async function handleSaveDraftDescription() {
    if (!activeDraft || !activeDraft.word_url) return
    setDraftBusy(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: draftDescription.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'บันทึกรายละเอียดที่แก้ไขไม่สำเร็จ')
        return
      }
      setActiveDraft(json)
      setDraftDescriptionEditing(false)
    } catch {
      alert('บันทึกรายละเอียดที่แก้ไขไม่สำเร็จ')
    } finally {
      setDraftBusy(false)
    }
  }

  async function handleDraftStatus(next: DocStatus) {
    if (!activeDraft) return
    const isQpWiPublish = next === 'Published' && (activeDraft.type === 'QP' || activeDraft.type === 'WI')
    const shouldSkipSystemCover = skipSystemCover && isQpWiPublish
    if (shouldSkipSystemCover && !confirm('ยืนยันว่า PDF ทางการนี้มีหน้าปกเดิมครบถ้วนแล้ว และต้องการใช้เป็นไฟล์ทางการโดยไม่สร้างหน้าปกระบบ?')) {
      return
    }
    setDraftBusy(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: next,
          ...(shouldSkipSystemCover ? { skip_system_cover: true } : {}),
          ...(isQpWiPublish ? { remove_portal_revision_history: removePortalRevisionHistory } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'เปลี่ยนสถานะ working revision ไม่สำเร็จ'); return }
      if (next === 'Published') {
        setActiveDraft(null)
        setSkipSystemCover(false)
        setRemovePortalRevisionHistory(true)
        loadRevisions()
        onPromoted(json as Document)
      } else {
        setActiveDraft(json)
        onDraftStatusChange?.(json as DocumentRevisionDraft)
      }
    } catch {
      alert('เปลี่ยนสถานะ working revision ไม่สำเร็จ')
    } finally {
      setDraftBusy(false)
    }
  }

  async function handleCancelDraft() {
    if (!activeDraft) return
    if (!confirm(`ยกเลิก working revision Rev. ${activeDraft.revision}?`)) return
    setDraftBusy(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts/${activeDraft.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const ct = res.headers.get('content-type') ?? ''
        const msg = ct.includes('application/json')
          ? ((await res.json()).error ?? 'ยกเลิก working revision ไม่สำเร็จ')
          : `ยกเลิก working revision ไม่สำเร็จ (${res.status})`
        alert(msg)
        return
      }
      setActiveDraft(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ยกเลิก working revision ไม่สำเร็จ')
    } finally {
      setDraftBusy(false)
    }
  }

  async function handleAddRevision() {
    if (!formRev.trim()) { setFormError('กรุณากรอกหมายเลข Revision'); return }
    setFormSaving(true); setFormError('')
    try {
      let fileKey: string | null = null
      let fileKeyName: string | null = null
      let fileKeySize: number | null = null
      let fileKeyType: string | null = null
      if (formFile) {
        const fileType = formFile.type || 'application/octet-stream'
        const presignParams = new URLSearchParams({
          fileName: formFile.name,
          fileType,
          fileSize: String(formFile.size),
        })
        const presignRes = await fetch(`/api/admin/documents/${doc.id}/revisions/presign?${presignParams.toString()}`)
        const presignText = await presignRes.text()
        const presignJson = parseDraftUploadResponse(presignText)
        if (!presignRes.ok) {
          setFormError(presignJson.error ?? `สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ (${presignRes.status})`)
          return
        }
        if (presignJson.uploadMode !== 'direct-r2' || !presignJson.uploadUrl || !presignJson.key) {
          setFormError('สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ: production อาจยังไม่ใช่โค้ด direct upload ล่าสุด กรุณา redeploy แล้วลองใหม่')
          return
        }
        await uploadFileWithProgress(presignJson.uploadUrl, formFile, presignJson.contentType ?? fileType, () => {})
        fileKey = presignJson.key
        fileKeyName = formFile.name
        fileKeySize = formFile.size
        fileKeyType = presignJson.contentType ?? fileType
      }

      const fd = new FormData()
      fd.append('revision_number', formRev.trim())
      if (formNote.trim()) fd.append('revision_note', formNote.trim())
      if (formRevisedBy.trim()) fd.append('revised_by', formRevisedBy.trim())
      if (formApprover.trim()) fd.append('approved_by', formApprover.trim())
      if (formDate) fd.append('revision_date', formDate)
      if (fileKey) {
        fd.append('file_key', fileKey)
        fd.append('file_name', fileKeyName!)
        fd.append('file_size', String(fileKeySize!))
        fd.append('file_type', fileKeyType ?? '')
      }
      const res = await fetch(`/api/admin/documents/${doc.id}/revisions`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setRevisions(prev => [json, ...prev])
      setShowForm(false); setFormRev(''); setFormNote(''); setFormRevisedBy(''); setFormApprover(''); setFormDate(''); setFormFile(null)
    } catch { setFormError('เกิดข้อผิดพลาด') }
    finally { setFormSaving(false) }
  }

  const onDraftSourceDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    draftSourceDragCounter.current += 1
    setDraftSourceDragOver(true)
  }, [])

  const onDraftSourceDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    draftSourceDragCounter.current -= 1
    if (draftSourceDragCounter.current === 0) setDraftSourceDragOver(false)
  }, [])

  const onDraftSourceDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draftSourceDragCounter.current = 0
    setDraftSourceDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && !draftBusy) void handleDraftFile('source', file)
  }, [draftBusy, handleDraftFile])

  const onDraftOfficialDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    draftOfficialDragCounter.current += 1
    setDraftOfficialDragOver(true)
  }, [])

  const onDraftOfficialDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    draftOfficialDragCounter.current -= 1
    if (draftOfficialDragCounter.current === 0) setDraftOfficialDragOver(false)
  }, [])

  const onDraftOfficialDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draftOfficialDragCounter.current = 0
    setDraftOfficialDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && !draftBusy) void handleDraftFile('official', file)
  }, [draftBusy, handleDraftFile])

  const isModal = variant === 'modal'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="modal-scrim"
        style={isModal
          ? { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }
          : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000 }}
      >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={isModal ? 'modal-panel-pop' : 'modal-panel-slide'}
        style={isModal
          ? {
              width: '100%', maxWidth: 620, maxHeight: '90vh',
              background: 'var(--card)', borderRadius: 20, display: 'flex', flexDirection: 'column',
              boxShadow: '0 24px 80px rgba(15,23,42,.2), 0 0 0 1px rgba(15,23,42,.05)',
              overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
            }
          : {
              position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw',
              background: 'var(--card)', zIndex: 1001, display: 'flex', flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(0,0,0,.18)',
              maxHeight: '100vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              overscrollBehavior: 'contain',
            }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
                ประวัติการแก้ไข
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{doc.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace', marginTop: 3 }}>{doc.document_code}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              <button
                onClick={downloadRevisionHistory}
                title="ดาวน์โหลด PDF ประวัติการแก้ไข"
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
              >
                <Icon name="download" size={15} />
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Current version */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>เวอร์ชันปัจจุบัน</div>
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)',
          }}>
            {/* Rev + Status + Download */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>Rev. {doc.revision}</span>
                <Badge color={STATUS_COLOR[doc.status as DocStatus] ?? 'gray'} size="sm">
                  {STATUS_LABEL[doc.status as DocStatus] ?? doc.status}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {allowCurrentRevisionRollback && canAdd && revisions.length > 0 && !activeDraft && (
                  <button
                    onClick={handleDeleteCurrentRevision}
                    disabled={deletingCurrent}
                    title="ลบ Rev. ล่าสุด"
                    style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(220,38,38,.25)', background: 'transparent', cursor: deletingCurrent ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', opacity: deletingCurrent ? 0.55 : 1 }}
                    onMouseEnter={e => { if (!deletingCurrent) e.currentTarget.style.background = 'rgba(220,38,38,.06)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
                <button
                  disabled={!doc.file_url}
                  onClick={() => doc.file_url && onDownload(doc.file_url)}
                  title={doc.file_url ? 'ดาวน์โหลด' : 'ยังไม่มีไฟล์ทางการ'}
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(30,95,173,.3)', background: 'transparent', cursor: doc.file_url ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', opacity: doc.file_url ? 1 : 0.45 }}
                >
                  <Icon name="download" size={14} />
                </button>
              </div>
            </div>
            {/* Meta rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {(doc.owner_name || doc.reviewer_name || doc.approver_name) && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {doc.owner_name && (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>ผู้แก้ไข:</span> {doc.owner_name}
                    </div>
                  )}
                  {doc.approver_name && (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>ผู้อนุมัติ:</span> {doc.approver_name}
                    </div>
                  )}
                </div>
              )}
              {doc.description && (
                <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>รายละเอียด:</span> {doc.description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Working revision */}
        {canAdd && doc.status === 'Published' && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {!activeDraft ? (
              <button
                onClick={handleCreateDraftFromPanel}
                disabled={draftBusy}
                style={{ width: '100%', minHeight: 38, borderRadius: 9, border: '1px dashed var(--primary)', background: 'var(--primary-soft)', cursor: draftBusy ? 'not-allowed' : 'pointer', color: 'var(--primary)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit' }}
              >
                {draftBusy ? 'กำลังสร้าง working revision...' : 'สร้าง Revision ใหม่'}
              </button>
            ) : (
              <div style={{ border: '1px solid rgba(217,119,6,.28)', background: 'rgba(217,119,6,.06)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#B45309' }}>Working Rev. {activeDraft.revision}</span>
                    <Badge color={STATUS_COLOR[activeDraft.status as DocStatus] ?? 'amber'} size="sm">{activeDraft.status}</Badge>
                  </div>
                  <button
                    onClick={() => setDraftFormOpen((v) => !v)}
                    disabled={draftBusy}
                    title="แก้ไขรายละเอียด working revision"
                    style={{ height: 28, padding: '0 9px', borderRadius: 7, border: '1px solid rgba(180,83,9,.25)', background: 'var(--card)', cursor: draftBusy ? 'not-allowed' : 'pointer', color: '#92400E', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', marginRight: 6 }}
                  >
                    Metadata
                  </button>
                  <button
                    onClick={handleCancelDraft}
                    disabled={draftBusy}
                    title="ยกเลิก working revision"
                    style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid rgba(220,38,38,.25)', background: 'transparent', cursor: draftBusy ? 'not-allowed' : 'pointer', color: 'var(--danger)' }}
                  >
                    ×
                  </button>
                </div>

                {draftFormOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,.62)', border: '1px solid rgba(180,83,9,.18)' }}>
                    <input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="ชื่อเอกสาร"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input
                        value={draftDepartment}
                        onChange={(e) => setDraftDepartment(e.target.value)}
                        placeholder="แผนก"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                      />
                      <div style={{ minWidth: 0 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>วันที่แก้ไข</div>
                        <input
                          type="date"
                          value={draftEditDate}
                          onChange={(e) => setDraftEditDate(e.target.value)}
                          title="วันที่แก้ไข"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 3 }}>วันที่บังคับใช้</div>
                        <input
                          type="date"
                          value={draftEffectiveDate}
                          onChange={(e) => setDraftEffectiveDate(e.target.value)}
                          title="วันที่บังคับใช้"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <input
                        value={draftOwnerName}
                        onChange={(e) => setDraftOwnerName(e.target.value)}
                        placeholder="ผู้จัดทำ"
                        style={{ minWidth: 0, padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                      />
                      <input
                        value={draftReviewerName}
                        onChange={(e) => setDraftReviewerName(e.target.value)}
                        placeholder="ผู้รับรอง"
                        style={{ minWidth: 0, padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                      />
                      <input
                        value={draftApproverName}
                        onChange={(e) => setDraftApproverName(e.target.value)}
                        placeholder="ผู้อนุมัติ"
                        style={{ minWidth: 0, padding: '7px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        เลือกวันที่สำหรับ working revision นี้ ระบบจะใช้วันที่เหล่านี้ในไฟล์ Word/Excel และ PDF ทางการ
                      </div>
                      <button
                        onClick={handleSaveDraftMetadata}
                        disabled={draftBusy}
                        style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#B45309', color: '#fff', cursor: draftBusy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => draftSourceRef.current?.click()}
                    onDragEnter={onDraftSourceDragEnter}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={onDraftSourceDragLeave}
                    onDrop={onDraftSourceDrop}
                    disabled={draftBusy}
                    title="คลิกเพื่อเลือกไฟล์ หรือลาก Word/Excel มาวาง"
                    style={{
                      minHeight: 34,
                      borderRadius: 8,
                      border: `1.5px ${draftSourceDragOver ? 'dashed' : 'solid'} ${draftSourceDragOver ? '#B45309' : 'var(--border)'}`,
                      background: draftSourceDragOver ? 'rgba(217,119,6,.12)' : 'var(--card)',
                      cursor: draftBusy ? 'not-allowed' : 'pointer',
                      color: draftSourceDragOver ? '#92400E' : 'var(--ink)',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      transition: 'border-color .12s, background .12s, color .12s',
                    }}
                  >
                    {activeDraft.word_name ? 'เปลี่ยน Word/Excel' : 'อัปโหลด Word/Excel'}
                  </button>
                  <button
                    onClick={() => draftOfficialRef.current?.click()}
                    onDragEnter={onDraftOfficialDragEnter}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={onDraftOfficialDragLeave}
                    onDrop={onDraftOfficialDrop}
                    disabled={draftBusy || !canManageDraftOfficial}
                    title={canManageDraftOfficial ? 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ทางการมาวาง' : 'เฉพาะ Admin หรือ Document Controller เท่านั้นที่อัปโหลด PDF เนื้อหา/ไฟล์ทางการได้'}
                    style={{
                      minHeight: 34,
                      borderRadius: 8,
                      border: `1.5px ${draftOfficialDragOver ? 'dashed' : 'solid'} ${draftOfficialDragOver ? '#B45309' : 'var(--border)'}`,
                      background: draftOfficialDragOver ? 'rgba(217,119,6,.12)' : 'var(--card)',
                      cursor: draftBusy || !canManageDraftOfficial ? 'not-allowed' : 'pointer',
                      color: draftOfficialDragOver ? '#92400E' : 'var(--ink)',
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      opacity: canManageDraftOfficial ? 1 : 0.55,
                      transition: 'border-color .12s, background .12s, color .12s',
                    }}
                  >
                    {activeDraft.type === 'QP' || activeDraft.type === 'WI'
                      ? (activeDraft.file_name ? 'เปลี่ยน PDF เนื้อหา' : 'อัปโหลด PDF เนื้อหา')
                      : (activeDraft.file_name ? 'เปลี่ยนไฟล์ทางการ' : 'อัปโหลดไฟล์ทางการ')}
                  </button>
                  <input
                    ref={draftSourceRef}
                    type="file"
                    accept=".doc,.docx,.xls,.xlsx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{ display: 'none' }}
                    onChange={(e) => handleDraftFile('source', e.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={draftOfficialRef}
                    type="file"
                    accept={activeDraft.type === 'QP' || activeDraft.type === 'WI' ? '.pdf,application/pdf' : '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
                    style={{ display: 'none' }}
                    onChange={(e) => handleDraftFile('official', e.target.files?.[0] ?? null)}
                  />
                  {draftUploadProgress !== null && (
                    <div style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                        <span>กำลังอัปโหลดไฟล์</span>
                        <span>{draftUploadProgress}%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ width: `${draftUploadProgress}%`, height: '100%', borderRadius: 999, background: 'var(--primary)', transition: 'width .15s ease' }} />
                      </div>
                    </div>
                  )}
                </div>

                {(activeDraft.word_url || activeDraft.file_url) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeDraft.word_url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--muted)' }}>
                          Word/Excel: {activeDraft.word_name ?? 'ไฟล์ต้นฉบับ'}
                        </span>
                        <button
                          onClick={() => activeDraft.word_url && onDownload(activeDraft.word_url)}
                          style={{ flexShrink: 0, padding: '4px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit' }}
                        >
                          ดาวน์โหลด Word/Excel
                        </button>
                      </div>
                    )}
                    {activeDraft.file_url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--muted)' }}>
                          {activeDraft.type === 'QP' || activeDraft.type === 'WI' ? 'PDF เนื้อหา' : 'ไฟล์ทางการ'}: {activeDraft.file_name ?? 'ไฟล์ทางการ'}
                        </span>
                        <button
                          onClick={() => activeDraft.file_url && onDownload(activeDraft.file_url)}
                          style={{ flexShrink: 0, padding: '4px 9px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit' }}
                        >
                          ดาวน์โหลด
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeDraft.word_url && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: 10, borderRadius: 8, background: 'var(--card)', border: '1px solid rgba(180,83,9,.18)' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E' }}>รายละเอียดที่แก้ไข</div>
                    <textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      readOnly={!draftDescriptionEditing}
                      placeholder="ระบุรายละเอียดที่แก้ไขใน Rev. นี้"
                      rows={3}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 9px', borderRadius: 7, border: '1px solid var(--border)', background: draftDescriptionEditing ? 'var(--surface-2)' : 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit', resize: draftDescriptionEditing ? 'vertical' : 'none', lineHeight: 1.45, cursor: draftDescriptionEditing ? 'text' : 'default' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                        กล่องนี้จะแสดงหลังอัปโหลด Word/Excel และใช้เป็นรายละเอียดในประวัติการแก้ไข
                      </div>
                      <button
                        onClick={() => draftDescriptionEditing ? handleSaveDraftDescription() : setDraftDescriptionEditing(true)}
                        disabled={draftBusy}
                        style={{ padding: '6px 11px', borderRadius: 7, border: 'none', background: draftDescriptionEditing ? '#B45309' : 'var(--primary)', color: '#fff', cursor: draftBusy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: draftBusy ? 0.7 : 1 }}
                      >
                        {draftDescriptionEditing ? 'บันทึก' : 'แก้ไข'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Draft attachments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', flex: 1 }}>
                      ไฟล์แนบ ({draftAttachments.length})
                    </div>
                    {(draftAttachments.length > 0 || activeDraft.word_url || activeDraft.file_url) && canDownloadAll && (
                      <button
                        onClick={handleDownloadDraftZip}
                        disabled={zipBusy}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: zipBusy ? 'default' : 'pointer', fontSize: 11.5, color: 'var(--muted)', fontFamily: 'inherit', opacity: zipBusy ? 0.6 : 1, transition: 'all .15s' }}
                        onMouseEnter={(e) => { if (!zipBusy) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' } }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                      >
                        <Icon name="download" size={11} />
                        {zipBusy ? 'กำลังเตรียม...' : 'ดาวน์โหลดทั้งหมด (ZIP)'}
                      </button>
                    )}
                  </div>

                  {draftAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {draftAttachments.map((a) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <Icon name="doc" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: 'var(--ink)' }}>{a.file_name}</span>
                          {(a.mime_type === 'application/pdf' || a.file_name?.toLowerCase().endsWith('.pdf')) && (
                            <button onClick={() => handleReadAttachment(a.file_url, a.file_name ?? '')} title="อ่าน" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              <Icon name="eye" size={12} />
                            </button>
                          )}
                          <button onClick={() => onDownload(a.file_url)} title="ดาวน์โหลด" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="download" size={12} />
                          </button>
                          {canAdd && (
                            <button onClick={() => handleDraftAttachDelete(a.id)} title="ลบ" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              <Icon name="trash" size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {canAdd && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setAttachDragOver(true) }}
                      onDragLeave={() => setAttachDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setAttachDragOver(false); if (e.dataTransfer.files?.length) handleDraftAttachUpload(e.dataTransfer.files) }}
                      onClick={() => attachInputRef.current?.click()}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: `1px dashed ${attachDragOver ? 'var(--primary)' : 'var(--border)'}`, background: attachDragOver ? 'var(--primary-soft)' : 'transparent', cursor: 'pointer', fontSize: 11.5, color: 'var(--muted)', transition: 'all .12s' }}
                    >
                      <Icon name="upload" size={13} />
                      {attachUploading ? 'กำลังอัปโหลด...' : 'ลากไฟล์มาวาง หรือคลิกเพื่อแนบไฟล์ (หลายไฟล์ได้)'}
                      <input ref={attachInputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) handleDraftAttachUpload(e.target.files); e.currentTarget.value = '' }} />
                    </div>
                  )}

                  {attachUploadProgress !== null && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
                        <span>กำลังอัปโหลดไฟล์แนบ</span>
                        <span>{attachUploadProgress}%</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ width: `${attachUploadProgress}%`, height: '100%', borderRadius: 999, background: 'var(--primary)', transition: 'width .15s ease' }} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {activeDraft.title && <div>Title: {activeDraft.title}</div>}
                  {activeDraft.owner_name && <div>Owner: {activeDraft.owner_name}</div>}
                  {activeDraft.reviewer_name && <div>Reviewer: {activeDraft.reviewer_name}</div>}
                  {activeDraft.approver_name && <div>Approver: {activeDraft.approver_name}</div>}
                  {activeDraft.edit_date && <div>วันที่แก้ไข: {fmtDate(activeDraft.edit_date)}</div>}
                  {activeDraft.expiry_date && <div>วันที่ทบทวน: {fmtDate(activeDraft.expiry_date)}</div>}
                  {activeDraft.effective_date && <div>วันที่บังคับใช้: {fmtDate(activeDraft.effective_date)}</div>}
                  {activeDraft.word_name && <div>Source: {activeDraft.word_name}</div>}
                  {activeDraft.file_name && <div>Official: {activeDraft.file_name}</div>}
                  {!activeDraft.word_name && !activeDraft.file_name && <div>อัปโหลดไฟล์ต้นฉบับก่อน แล้วให้ DC อัปโหลดไฟล์ทางการ/PDF เนื้อหา</div>}
                </div>

                {(() => {
                  const isQpWi = activeDraft.type === 'QP' || activeDraft.type === 'WI'
                  const missingSource = isQpWi && !activeDraft.word_url
                  const missingOfficial = isQpWi
                    ? !activeDraft.source_pdf_url && !activeDraft.file_url
                    : !activeDraft.file_url
                  if (!missingSource && !missingOfficial) {
                    return (
                      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(22,163,74,.08)', border: '1px solid rgba(22,163,74,.22)', color: '#15803D', fontSize: 11.5, lineHeight: 1.45 }}>
                        ไฟล์ครบแล้ว สามารถส่งเข้า Review ได้
                      </div>
                    )
                  }
                  return (
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.22)', color: '#92400E', fontSize: 11.5, lineHeight: 1.45 }}>
                      {missingSource
                        ? 'ขั้นตอนถัดไป: Reviewer หรือผู้รับผิดชอบอัปโหลด Word/Excel ระบบจะคงสถานะ Draft'
                        : isQpWi
                          ? canManageDraftOfficial
                            ? 'ขั้นตอนถัดไป: DCC ดาวน์โหลด Word/Excel ไปจัดทำ PDF แล้วอัปโหลด PDF เนื้อหา จากนั้นกด → Review'
                            : 'ขั้นตอนถัดไป: รอ DCC ดาวน์โหลด Word/Excel ไปจัดทำ PDF และอัปโหลด PDF เนื้อหา'
                          : canManageDraftOfficial
                            ? 'ขั้นตอนถัดไป: DCC อัปโหลดไฟล์ทางการ แล้วจึงกด → Review'
                            : 'ขั้นตอนถัดไป: รอ DCC อัปโหลดไฟล์ทางการ'}
                    </div>
                  )
                })()}

                {COVER_GENERATION_ENABLED && canSkipSystemCover && (activeDraft.type === 'QP' || activeDraft.type === 'WI') && activeDraft.status === 'Approved' && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(217,119,6,.25)', background: 'rgba(217,119,6,.08)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={skipSystemCover}
                      onChange={(e) => setSkipSystemCover(e.target.checked)}
                      style={{ marginTop: 3, accentColor: '#D97706' }}
                    />
                    <span style={{ fontSize: 11.8, color: '#92400E', lineHeight: 1.45 }}>
                      PDF ทางการนี้มีหน้าปกเดิมครบแล้ว ให้ใช้ไฟล์นี้เป็น official PDF โดยไม่สร้างหน้าปกระบบ
                      <br />
                      <span style={{ color: 'var(--muted)' }}>ใช้เฉพาะกรณีต้องการคงหน้าปกเดิมไว้ ระบบจะไม่ stamp วันที่/ลายเซ็นบนหน้าปกระบบใหม่</span>
                    </span>
                  </label>
                )}

                {(activeDraft.type === 'QP' || activeDraft.type === 'WI') && activeDraft.status === 'Approved' && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(30,95,173,.22)', background: 'rgba(30,95,173,.08)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={removePortalRevisionHistory}
                      onChange={(e) => setRemovePortalRevisionHistory(e.target.checked)}
                      style={{ marginTop: 3, accentColor: 'var(--primary)' }}
                    />
                    <span style={{ fontSize: 11.8, color: 'var(--primary)', lineHeight: 1.45 }}>
                      ลบหน้าประวัติที่ระบบสร้างไว้เดิมก่อนเผยแพร่
                      <br />
                      <span style={{ color: 'var(--muted)' }}>ระบบจะลบเฉพาะหน้าท้ายที่มี marker ของ Portal แล้วเพิ่มหน้าประวัติแก้ไขชุดล่าสุดต่อท้าย โดยไม่แตะประวัติเดิมใน PDF</span>
                    </span>
                  </label>
                )}

                {(() => {
                  const transitions = allowedTransitions(activeDraft.status as DocStatus, userRole, docRole)
                  if (transitions.length === 0) {
                    return (
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                        บัญชีนี้ยังไม่มีสิทธิ์เปลี่ยนสถานะของ working revision นี้
                      </div>
                    )
                  }
                  const transitionCheck = (next: DocStatus) => canMoveToStatus({
                    type: activeDraft.type,
                    status: activeDraft.status,
                    file_url: activeDraft.file_url,
                    source_pdf_url: activeDraft.source_pdf_url,
                    word_url: activeDraft.word_url,
                  }, next)
                  const transitionStates = transitions.map((next) => ({ next, check: transitionCheck(next) }))
                  const blockedReason = transitionStates.find(({ check }) => !check.ok)?.check.error
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                      {blockedReason && (
                        <div style={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.45 }}>
                          ยังไปต่อไม่ได้: {blockedReason}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {transitionStates.map(({ next, check }) => {
                        const disabled = draftBusy || !check.ok
                        return (
                        <button
                          key={next}
                          onClick={() => check.ok && handleDraftStatus(next)}
                          disabled={disabled}
                          title={!check.ok ? check.error : undefined}
                          style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontFamily: 'inherit', opacity: disabled ? 0.55 : 1 }}
                        >
                          → {next}
                        </button>
                        )
                      })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* Revision history list */}
        <div style={{ flex: 'none', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              เวอร์ชันก่อนหน้า ({revisions.length})
            </div>
            {allowRevisionHistoryBackfill && (
              <button
                onClick={() => setShowForm(f => !f)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: showForm ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit' }}
              >
                <Icon name="plus" size={12} />
                เพิ่มประวัติย้อนหลัง
              </button>
            )}
          </div>

          {/* Add form */}
          {allowRevisionHistoryBackfill && showForm && (
            <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {formError && (
                <div style={{ fontSize: 12, color: '#B91C1C', padding: '6px 10px', borderRadius: 6, background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.2)' }}>{formError}</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Revision *</div>
                  <input value={formRev} onChange={e => setFormRev(e.target.value)} placeholder="เช่น 1, 2.1"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>วันที่</div>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ผู้ทำการแก้ไข</div>
                  <input value={formRevisedBy} onChange={e => setFormRevisedBy(e.target.value)} placeholder="ชื่อผู้แก้ไข (ไม่บังคับ)"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ผู้อนุมัติ</div>
                  <input value={formApprover} onChange={e => setFormApprover(e.target.value)} placeholder="ชื่อผู้อนุมัติ (ไม่บังคับ)"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>บันทึกการแก้ไข</div>
                <input value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="สรุปการเปลี่ยนแปลง (ไม่บังคับ)"
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>ไฟล์ (ไม่บังคับ)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => formFileRef.current?.click()}
                    style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="upload" size={12} /> เลือกไฟล์
                  </button>
                  {formFile && (
                    <span style={{ fontSize: 11.5, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formFile?.name}
                    </span>
                  )}
                  <input ref={formFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setFormFile(f); e.target.value = '' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowForm(false); setFormError('') }}
                  style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--muted)' }}>
                  ยกเลิก
                </button>
                <button onClick={handleAddRevision} disabled={formSaving}
                  style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--primary)', cursor: formSaving ? 'not-allowed' : 'pointer', fontSize: 12.5, fontFamily: 'inherit', color: '#fff', opacity: formSaving ? 0.7 : 1 }}>
                  {formSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ padding: '14px', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ height: 13, width: 80, borderRadius: 4, background: 'var(--surface-2)', marginBottom: 8 }} />
                <div style={{ height: 11, width: 160, borderRadius: 4, background: 'var(--surface-2)' }} />
              </div>
            ))
          ) : revisions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>
              <Icon name="clock" size={28} />
              <div style={{ marginTop: 10, fontWeight: 500 }}>ยังไม่มีประวัติการแก้ไข</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>อัปโหลดไฟล์ใหม่ หรือเพิ่มประวัติย้อนหลังด้านบน</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {revisions.map((rev, i) => (
                <div key={rev.id} style={{ borderRadius: 10, border: `1px solid ${editingId === rev.id ? 'var(--primary)' : 'var(--border)'}`, overflow: 'hidden' }}>
                  {editingId === rev.id ? (
                    /* ── Inline edit form ── */
                    <div style={{ padding: '12px 14px', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {editError && (
                        <div style={{ fontSize: 12, color: '#B91C1C', padding: '5px 8px', borderRadius: 6, background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.2)' }}>{editError}</div>
                      )}
                      {rev.history_source !== 'backfill' && (
                        <div style={{ fontSize: 11.5, color: '#92400E', padding: '6px 8px', borderRadius: 6, background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)' }}>
                          Workflow revision แก้ได้เฉพาะวันที่แก้ไขล่าสุด
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>{rev.history_source === 'backfill' ? 'Revision *' : 'Revision'}</div>
                          <input value={editRev} onChange={e => setEditRev(e.target.value)} disabled={rev.history_source !== 'backfill'}
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: rev.history_source === 'backfill' ? 'var(--card)' : 'var(--surface-2)', outline: 'none', boxSizing: 'border-box', opacity: rev.history_source === 'backfill' ? 1 : 0.7 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>วันที่</div>
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>ผู้ทำการแก้ไข</div>
                          <input value={editRevisedBy} onChange={e => setEditRevisedBy(e.target.value)} placeholder="ชื่อผู้แก้ไข" disabled={rev.history_source !== 'backfill'}
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: rev.history_source === 'backfill' ? 'var(--card)' : 'var(--surface-2)', outline: 'none', boxSizing: 'border-box', opacity: rev.history_source === 'backfill' ? 1 : 0.7 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>ผู้อนุมัติ</div>
                          <input value={editApprover} onChange={e => setEditApprover(e.target.value)} placeholder="ชื่อผู้อนุมัติ" disabled={rev.history_source !== 'backfill'}
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: rev.history_source === 'backfill' ? 'var(--card)' : 'var(--surface-2)', outline: 'none', boxSizing: 'border-box', opacity: rev.history_source === 'backfill' ? 1 : 0.7 }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>บันทึกการแก้ไข</div>
                        <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="สรุปการเปลี่ยนแปลง" disabled={rev.history_source !== 'backfill'}
                          style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: rev.history_source === 'backfill' ? 'var(--card)' : 'var(--surface-2)', outline: 'none', boxSizing: 'border-box', opacity: rev.history_source === 'backfill' ? 1 : 0.7 }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditingId(null); setEditError('') }}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--muted)' }}>
                          ยกเลิก
                        </button>
                        <button onClick={() => handleSaveEdit(rev.id)} disabled={editSaving}
                          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--primary)', cursor: editSaving ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', opacity: editSaving ? 0.7 : 1 }}>
                          {editSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal view ── */
                    <div style={{ padding: '12px 14px' }}>
                      {/* Top row: Rev + badge + action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>Rev. {rev.revision_number}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface-2)', padding: '1px 7px', borderRadius: 4, fontWeight: 500 }}>
                            {revisions.length - i} เวอร์ชันก่อน
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {(allowRevisionHistoryBackfill && rev.history_source === 'backfill' || userRole === 'Admin' && rev.history_source !== 'backfill') && (
                            <>
                              <button onClick={() => startEdit(rev)} title="แก้ไข"
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                <Icon name="edit" size={12} />
                              </button>
                              {rev.history_source === 'backfill' && (
                                <button onClick={() => handleDeleteRevision(rev.id)} title="ลบ"
                                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                  <Icon name="trash" size={12} />
                                </button>
                              )}
                            </>
                          )}
                          {rev.file_url && canDownloadRevision && (
                            <button onClick={() => rev.file_url && onDownload(rev.file_url)} title="ดาวน์โหลด"
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              <Icon name="download" size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Meta: ผู้แก้ไข + ผู้อนุมัติ + รายละเอียด + วันที่ */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(rev.revised_by || rev.approved_by) && (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {rev.revised_by && (
                              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>ผู้แก้ไข:</span> {rev.revised_by}
                              </div>
                            )}
                            {rev.approved_by && (
                              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>ผู้อนุมัติ:</span> {rev.approved_by}
                              </div>
                            )}
                          </div>
                        )}
                        {rev.revision_note && (
                          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>รายละเอียด:</span> {rev.revision_note}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                          แก้ไขล่าสุด {fmtDate(rev.edit_date ?? rev.effective_date ?? rev.approved_at ?? rev.published_at ?? rev.created_at)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
      {pdfViewer && <PdfViewerModal url={pdfViewer.url} pdfJsUrl={pdfViewer.pdfJsUrl} title={pdfViewer.title} onClose={() => setPdfViewer(null)} />}
    </>
  )
}
