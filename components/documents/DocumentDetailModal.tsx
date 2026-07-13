'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { isCoverRequiredType } from '@/lib/documents/workflow'
import { isReviewOnlyType, reviewWindowState } from '@/lib/documents/review'
import { TYPE_ICON_BG, TYPE_ICON_FG, STATUS_LABEL, fmtSize, fmtDate } from '@/lib/documents/ui-constants'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import type { DocStatus } from '@/lib/documents/transitions'
import type { Document } from '@/lib/supabase/types'

export { PdfViewerModal } from '@/components/documents/PdfViewerModal'

// ── Attachment type ───────────────────────────────────────────
export interface Attachment {
  id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
  ephemeral?: boolean
  profiles: { name: string } | null
}

// ── Linked document type ──────────────────────────────────────
interface LinkedDoc {
  id: string
  linked_doc_id: string
  created_by: string | null
  created_at: string
  link_kind: 'related' | 'set'
  set_mode: 'registered' | 'linked' | 'revision' | null
  set_draft_id: string | null
  documents: {
    id: string
    document_code: string
    title: string
    type: string
    status: string
    file_url: string | null
    file_name: string | null
    file_size: number | null
  } | null
}

// ── Linked-doc category grouping ────────────────────────────────
const LINK_CATEGORY_ORDER = ['Reference', 'Card file', 'Form', 'Manual']
const LINK_CATEGORY_LABEL: Record<string, string> = {
  Reference: 'เอกสารอ้างอิง (Reference)',
  'Card file': 'เอกสารประกอบการปฏิบัติงาน (Card file)',
  Form: 'แบบฟอร์ม (Form)',
  Manual: 'คู่มือ (Manual)',
}
function groupLinkedDocs(links: LinkedDoc[]) {
  const groups = new Map<string, LinkedDoc[]>()
  for (const l of links) {
    const type = l.documents?.type ?? 'Others'
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type)!.push(l)
  }
  const orderedTypes = [
    ...LINK_CATEGORY_ORDER.filter((t) => groups.has(t)),
    ...Array.from(groups.keys()).filter((t) => !LINK_CATEGORY_ORDER.includes(t)).sort(),
  ]
  return orderedTypes.map((type) => ({ type, label: LINK_CATEGORY_LABEL[type] ?? type, items: groups.get(type)! }))
}

function fileAccentColor(name: string | null | undefined): string {
  const ext = name?.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'doc' || ext === 'docx') return '#2563EB'
  if (ext === 'xls' || ext === 'xlsx') return '#059669'
  return '#DC2626'
}

// ── Document Detail Modal ──────────────────────────────────────
export function DocumentDetailModal({ doc, hasRead, canUpload, userRole, docRole, userId, onClose, onRead, onHistory, onEdit, onDownload, onReviewConfirmed }: {
  doc: Document
  hasRead: boolean
  canUpload: boolean
  userRole: string
  docRole: string | null
  userId: string
  onClose: () => void
  onRead: () => void
  onHistory: () => void
  onEdit: () => void
  onDownload: (path: string) => void
  /** Annual-review: fires with the updated document after "ทบทวนแล้ว" succeeds so the
   *  caller can refresh its copy. Button is hidden when the callback isn't provided. */
  onReviewConfirmed?: (updated: Document) => void
}) {
  const docStatus = doc.status as DocStatus
  const typeColor = TYPE_ICON_FG[doc.type] ?? '#64748B'
  const typeBg    = TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)'

  const canConfirmReview = userRole === 'Admin' || userRole === 'Document Controller'
    || docRole === 'Document Controller' || docRole === 'Reviewer'
  const showConfirmReview = Boolean(
    onReviewConfirmed && canConfirmReview
    && docStatus === 'Published' && isReviewOnlyType(doc.type)
    && !doc.review_confirmed_at && reviewWindowState(doc) !== 'none',
  )
  const [confirmingReview, setConfirmingReview] = useState(false)

  async function handleConfirmReview() {
    if (!confirm(`ยืนยันว่าได้ทบทวนเอกสาร ${doc.document_code} ประจำปีแล้ว และไม่มีการแก้ไขเนื้อหา?\nเอกสารจะเข้าคิว "รอทบทวนประจำปี" ให้ DCC ดำเนินการ Rev +1`)) return
    setConfirmingReview(true)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/confirm-review`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'ยืนยันการทบทวนไม่สำเร็จ'); return }
      onReviewConfirmed?.(json as Document)
    } catch {
      alert('ยืนยันการทบทวนไม่สำเร็จ')
    } finally {
      setConfirmingReview(false)
    }
  }

  const [attachments, setAttachments]     = useState<Attachment[]>([])
  const [attachLoading, setAttachLoading] = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [attachErr, setAttachErr]         = useState('')
  const [attachDragOver, setAttachDragOver] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const attachFileRef    = useRef<HTMLInputElement>(null)
  const attachDragCounter = useRef(0)

  const [links, setLinks]           = useState<LinkedDoc[]>([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState<Document[]>([])
  const [linkSearching, setLinkSearching] = useState(false)
  const [showLinkResults, setShowLinkResults] = useState(false)
  const linkSearchRef = useRef<HTMLDivElement>(null)
  const [pdfViewer, setPdfViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string; forcePdfJs?: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/admin/documents/${doc.id}/attachments`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAttachments(d) })
      .catch(() => {})
      .finally(() => setAttachLoading(false))
  }, [doc.id])

  useEffect(() => {
    fetch(`/api/admin/documents/${doc.id}/links`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLinks(d) })
      .catch(() => {})
      .finally(() => setLinksLoading(false))
  }, [doc.id])

  useEffect(() => {
    if (!linkSearch.trim()) { setLinkResults([]); setShowLinkResults(false); return }
    const t = setTimeout(async () => {
      setLinkSearching(true)
      try {
        const res = await fetch(`/api/admin/documents?search=${encodeURIComponent(linkSearch)}&pageSize=8`)
        const json = await res.json()
        const linkedIds = new Set(links.map(l => l.linked_doc_id))
        const filtered = (json.data ?? [] as Document[]).filter(
          (d: Document) => d.id !== doc.id && !linkedIds.has(d.id)
        )
        setLinkResults(filtered)
        setShowLinkResults(true)
      } catch { setLinkResults([]) } finally { setLinkSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [linkSearch, doc.id, links])

  async function handleLinkDoc(linked: Document) {
    setShowLinkResults(false)
    setLinkSearch('')
    const res = await fetch(`/api/admin/documents/${doc.id}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linked_doc_id: linked.id }),
    })
    const json = await res.json()
    if (res.ok) setLinks(prev => [...prev, json])
  }

  async function handleUnlinkDoc(linkId: string) {
    const res = await fetch(`/api/admin/documents/${doc.id}/links/${linkId}`, { method: 'DELETE' })
    if (res.ok) setLinks(prev => prev.filter(l => l.id !== linkId))
  }

  async function handleAttachUpload(files: FileList) {
    setUploading(true)
    setAttachErr('')
    const fd = new FormData()
    for (const f of Array.from(files)) fd.append('files', f)
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/attachments`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setAttachErr(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setAttachments(prev => [...prev, ...(Array.isArray(json) ? json : [])])
    } catch { setAttachErr('เกิดข้อผิดพลาด') } finally { setUploading(false) }
  }

  async function handleAttachDelete(attachId: string) {
    const res = await fetch(`/api/admin/documents/${doc.id}/attachments/${attachId}`, { method: 'DELETE' })
    if (res.ok) setAttachments(prev => prev.filter(a => a.id !== attachId))
  }

  function handleDownloadAll() {
    setDownloadingAll(true)
    const a = document.createElement('a')
    a.href = `/api/admin/documents/${doc.id}/download-zip`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => setDownloadingAll(false), 1500)
  }

  async function openLinkedDocRead(docId: string, fileUrl: string | null, fileName: string | null) {
    if (!fileUrl || !fileName) return
    try {
      const res = await fetch(`/api/admin/documents/${docId}/read`, { method: 'POST' })
      const json = await res.json()
      if (json.url) { setPdfViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(fileUrl), title: fileName, forcePdfJs: json.preview_uncontrolled === true }); return }
    } catch { /* ignore */ }
    openAttachmentInline(fileUrl, fileName)
  }

  async function openAttachmentInline(fileUrl: string, fileName: string) {
    const isPdf = /\.pdf$/i.test(fileName)
    const qs = isPdf ? '&inline=1' : ''
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(fileUrl)}${qs}`)
      const json = await res.json()
      if (json.url) setPdfViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(fileUrl), title: fileName })
    } catch { /* ignore */ }
  }

  function canDeleteAttach(uploadedBy: string | null) {
    if (['Admin', 'Manager'].includes(userRole)) return true
    if (docRole === 'Document Controller') return true
    return userId === uploadedBy
  }

  // QP/WI: ซ่อน Word/Excel จาก Viewer และ Reviewer
  const canDownloadSource =
    !isCoverRequiredType(doc.type) ||
    ['Admin', 'Manager', 'Quality Manager', 'Laboratory Director', 'Document Controller', 'Reviewer'].includes(userRole) ||
    ['Document Controller', 'Reviewer'].includes(docRole ?? '')

  const downloadAllCount =
    (doc.file_url ? 1 : 0) +
    (canDownloadSource && doc.word_url ? 1 : 0) +
    links.filter(l => l.documents?.file_url).length +
    attachments.length

  // "ดาวน์โหลดทั้งหมด" is restricted to Reviewer/DCC/Admin — other roles use the per-file
  // download buttons on each FileCard instead.
  const canDownloadAll = userRole === 'Admin' || userRole === 'Document Controller' || userRole === 'Reviewer'
    || docRole === 'Document Controller' || docRole === 'Reviewer'

  const STATUS_CHIP: Record<DocStatus, { bg: string; color: string }> = {
    Draft:     { bg: 'rgba(100,116,139,.12)', color: '#475569' },
    Review:    { bg: 'rgba(217,119,6,.12)',   color: '#B45309' },
    Approved:  { bg: 'rgba(30,95,173,.12)',   color: '#1E5FAD' },
    Published: { bg: 'rgba(22,163,74,.12)',   color: '#15803D' },
    Obsolete:  { bg: 'rgba(220,38,38,.12)',   color: '#DC2626' },
  }
  const chip = STATUS_CHIP[docStatus]

  function MetaItem({ label, value, danger }: { label: string; value?: string | null; danger?: boolean }) {
    if (!value) return null
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: danger ? 'var(--danger)' : 'var(--muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.07em' }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: danger ? 'var(--danger)' : 'var(--ink)', lineHeight: 1.4 }}>{value}</div>
      </div>
    )
  }

  function FileCard({ name, size, accentColor, path }: { name: string | null; size: number | null; accentColor: string; path: string }) {
    if (!name) return null
    return (
      <button
        onClick={() => onDownload(path)}
        style={{ flex: 1, minWidth: 180, padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all .14s', textAlign: 'left', fontFamily: 'inherit' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accentColor}55`; e.currentTarget.style.background = `${accentColor}08` }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)' }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accentColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="doc" size={16} style={{ color: accentColor }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{name.split('.').pop()?.toUpperCase()} · {fmtSize(size)}</div>
        </div>
        <Icon name="download" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      </button>
    )
  }

  return (
    <>
      <style>{`
        @keyframes ddm-back { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ddm-card { from { opacity: 0; transform: scale(.97) translateY(10px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', animation: 'ddm-back .16s ease' }}>
        <div style={{ background: 'var(--card)', borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(15,23,42,.2), 0 0 0 1px rgba(15,23,42,.05)', animation: 'ddm-card .22s cubic-bezier(.22,.68,0,1.15)' }}>

          {/* Type-color accent rule */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${typeColor} 0%, ${typeColor}44 60%, transparent 100%)`, flexShrink: 0 }} />

          {/* Header — gradient wash from type color */}
          <div style={{ padding: '22px 26px 18px', flexShrink: 0, background: `linear-gradient(150deg, ${typeBg} 0%, transparent 55%)` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>

              <div style={{ width: 50, height: 50, borderRadius: 14, background: typeBg, border: `1.5px solid ${typeColor}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 14px ${typeColor}18` }}>
                <Icon name="doc" size={22} style={{ color: typeColor }} />
              </div>

              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 9, letterSpacing: '-.01em' }}>{doc.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: typeColor, background: typeBg, padding: '2px 9px', borderRadius: 6, border: `1px solid ${typeColor}28`, fontFamily: 'monospace', letterSpacing: '.02em' }}>{doc.document_code}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>Rev.{doc.revision}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: chip.color, background: chip.bg, padding: '2px 9px', borderRadius: 99 }}>{STATUS_LABEL[docStatus]}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: doc.visibility === 'Public' ? '#15803D' : '#92400E', background: doc.visibility === 'Public' ? 'rgba(22,163,74,.1)' : 'rgba(217,119,6,.1)', padding: '2px 8px', borderRadius: 99 }}>
                    {doc.visibility === 'Public' ? '● เผยแพร่' : '● ภายใน'}
                  </span>
                </div>
              </div>

              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--ink)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}>
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Scrollable body */}
          <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              <MetaItem label="แผนก" value={doc.department} />
              <MetaItem label="ผู้จัดทำ" value={doc.owner_name} />
              <MetaItem label="ผู้รับรอง" value={doc.reviewer_name} />
              <MetaItem label="ผู้อนุมัติ" value={doc.approver_name} />
              <MetaItem label="วันที่มีผลบังคับใช้" value={doc.effective_date ? fmtDate(doc.effective_date) : null} />
              <MetaItem label="วันที่ทบทวน" value={doc.expiry_date ? fmtDate(doc.expiry_date) : null} />
              <MetaItem label="วันที่ยกเลิก" value={doc.obsolete_date ? fmtDate(doc.obsolete_date) : null} danger />
              <MetaItem label="อัปเดตล่าสุด" value={fmtDate(doc.updated_at)} />
            </div>

            {doc.description && (
              <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 10, borderLeft: '3px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>รายละเอียดการแก้ไข</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{doc.description}</div>
              </div>
            )}

            {doc.obsolete_reason && (
              <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,.04)', borderLeft: '3px solid var(--danger)', border: '1px solid rgba(220,38,38,.1)', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.07em' }}>เหตุผลการยกเลิก</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{doc.obsolete_reason}</div>
              </div>
            )}

            {/* Downloadable file cards */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', flex: 1 }}>ดาวน์โหลดไฟล์</div>
                {downloadAllCount > 1 && canDownloadAll && (
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloadingAll || attachLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: downloadingAll ? 'default' : 'pointer', fontSize: 11.5, color: 'var(--muted)', fontFamily: 'inherit', opacity: downloadingAll ? .6 : 1, transition: 'all .15s' }}
                    onMouseEnter={e => { if (!downloadingAll) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}
                  >
                    <Icon name="download" size={11} />
                    {downloadingAll ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลดทั้งหมด'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {doc.file_url && <FileCard name={doc.file_name} size={doc.file_size} accentColor="#DC2626" path={doc.file_url} />}
                {canDownloadSource && doc.word_name && doc.word_url && (
                  <FileCard name={doc.word_name} size={doc.word_size} accentColor={fileAccentColor(doc.word_name)} path={doc.word_url} />
                )}
              </div>
            </div>

            {/* Related docs + Attachments */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>เอกสารที่เกี่ยวข้อง / เอกสารอ้างอิง</div>

              {/* Linked existing docs */}
              {canUpload && ['Draft', 'Review', 'Approved', 'Published'].includes(doc.status) && (
                <div ref={linkSearchRef} style={{ position: 'relative', marginBottom: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                    <input
                      value={linkSearch}
                      onChange={e => setLinkSearch(e.target.value)}
                      onFocus={() => { if (linkResults.length) setShowLinkResults(true) }}
                      placeholder="ค้นหาเอกสารในระบบเพื่อเชื่อมโยง..."
                      style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {linkSearching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
                  </div>
                  {showLinkResults && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.12)', marginTop: 4, overflow: 'hidden' }}>
                      {linkResults.length === 0 ? (
                        <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)' }}>ไม่พบเอกสาร</div>
                      ) : linkResults.map(r => (
                        <button key={r.id} onClick={() => handleLinkDoc(r)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: TYPE_ICON_BG[r.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name="doc" size={13} style={{ color: TYPE_ICON_FG[r.type] ?? '#64748B' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{r.document_code} · {r.type}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!linksLoading && links.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 10 }}>
                  {groupLinkedDocs(links).map((group) => (
                    <div key={group.type}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 5 }}>
                        {group.label} <span style={{ fontWeight: 500 }}>({group.items.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {group.items.map(l => {
                          const d = l.documents
                          if (!d) return null
                          return (
                            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                              <div
                                onClick={() => openLinkedDocRead(d.id, d.file_url, d.file_name)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                              >
                                <div style={{ width: 28, height: 28, borderRadius: 6, background: TYPE_ICON_BG[d.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Icon name="doc" size={13} style={{ color: TYPE_ICON_FG[d.type] ?? '#64748B' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{d.document_code} · {d.type} · {fmtSize(d.file_size)}</div>
                                  {l.link_kind === 'set' && <div style={{ fontSize: 10.5, color: '#B45309', marginTop: 2 }}>สมาชิกชุดเอกสาร · อ่านอย่างเดียว</div>}
                                </div>
                              </div>
                              {d.file_url && d.file_name?.toLowerCase().endsWith('.pdf') && (
                                <button onClick={() => openLinkedDocRead(d.id, d.file_url, d.file_name)} title="อ่าน"
                                  style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                  <Icon name="eye" size={13} />
                                </button>
                              )}
                              <button disabled={!d.file_url} onClick={() => d.file_url && onDownload(d.file_url)} title={d.file_url ? 'ดาวน์โหลด' : 'ยังไม่มีไฟล์ทางการ'}
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: d.file_url ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0, opacity: d.file_url ? 1 : 0.45 }}
                                onMouseEnter={e => { if (d.file_url) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' } }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                <Icon name="download" size={12} />
                              </button>
                              {l.link_kind !== 'set' && canDeleteAttach(l.created_by) && (['Draft', 'Review'].includes(doc.status) || ['Admin', 'Manager'].includes(userRole) || docRole === 'Document Controller') && (
                                <button onClick={() => handleUnlinkDoc(l.id)} title="ยกเลิกการเชื่อมโยง"
                                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                  <Icon name="x" size={12} />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Uploaded attachments */}
              {canUpload && ['Draft', 'Review', 'Approved', 'Published'].includes(doc.status) && (
                <>
                  <div
                    onClick={() => !uploading && attachFileRef.current?.click()}
                    onDragEnter={e => { e.preventDefault(); attachDragCounter.current += 1; setAttachDragOver(true) }}
                    onDragOver={e => e.preventDefault()}
                    onDragLeave={e => { e.preventDefault(); attachDragCounter.current -= 1; if (attachDragCounter.current === 0) setAttachDragOver(false) }}
                    onDrop={e => { e.preventDefault(); attachDragCounter.current = 0; setAttachDragOver(false); if (e.dataTransfer.files.length && !uploading) handleAttachUpload(e.dataTransfer.files) }}
                    style={{ border: `2px dashed ${attachDragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 16px', background: attachDragOver ? 'var(--primary-soft)' : 'var(--surface-2)', cursor: uploading ? 'default' : 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, opacity: uploading ? .7 : 1 }}
                  >
                    <Icon name="upload" size={14} style={{ color: attachDragOver ? 'var(--primary)' : 'var(--muted)', flexShrink: 0 }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: attachDragOver ? 'var(--primary)' : 'var(--ink)' }}>
                        {uploading ? 'กำลังอัพโหลด...' : 'ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือก'}
                      </div>
                      {!uploading && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>รองรับทุกประเภทไฟล์ · เลือกได้หลายไฟล์พร้อมกัน</div>}
                    </div>
                  </div>
                  <input ref={attachFileRef} type="file" multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.length) { handleAttachUpload(e.target.files); e.target.value = '' } }} />
                </>
              )}
              {attachErr && <div style={{ fontSize: 11.5, color: 'var(--danger)', marginBottom: 6 }}>{attachErr}</div>}
              {attachLoading ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>กำลังโหลด...</div>
              ) : attachments.length === 0 && links.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>ยังไม่มีไฟล์แนบ</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachments.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                      <div
                        onClick={() => openAttachmentInline(a.file_url, a.file_name)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }}
                      >
                        <Icon name="doc" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.file_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{fmtSize(a.file_size)} · {a.profiles?.name ?? '—'} · {fmtDate(a.created_at)}</div>
                        </div>
                      </div>
                      <button onClick={() => onDownload(a.file_url)} title="ดาวน์โหลด"
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                        <Icon name="download" size={12} />
                      </button>
                      {canDeleteAttach(a.uploaded_by) && (['Draft', 'Review'].includes(doc.status) || ['Admin', 'Manager'].includes(userRole) || docRole === 'Document Controller') && (
                        <button onClick={() => handleAttachDelete(a.id)} title="ลบ"
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

          {/* Footer */}
          <div style={{ padding: '14px 26px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onRead} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all .12s', boxShadow: '0 2px 10px rgba(30,95,173,.28)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#1750a0'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(30,95,173,.38)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(30,95,173,.28)' }}>
              <Icon name="eye" size={14} />{hasRead ? 'อ่านอีกครั้ง' : 'Read เอกสาร'}
            </button>
            <button onClick={onHistory} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all .12s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink)' }}>
              <Icon name="clock" size={14} />ประวัติการแก้ไข
            </button>
            {showConfirmReview && (
              <button
                onClick={handleConfirmReview}
                disabled={confirmingReview}
                title="ยืนยันการทบทวนประจำปี — ไม่มีการแก้ไขเนื้อหา"
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'rgba(22,163,74,.1)', color: '#15803D', border: '1px solid rgba(22,163,74,.35)', cursor: confirmingReview ? 'default' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'all .12s', opacity: confirmingReview ? .6 : 1 }}
              >
                <Icon name="check" size={14} />{confirmingReview ? 'กำลังบันทึก…' : 'ทบทวนแล้ว'}
              </button>
            )}
            <div style={{ flex: 1 }} />
            {canUpload && (
              <button onClick={onEdit} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--muted)', fontFamily: 'inherit', transition: 'all .12s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                <Icon name="edit" size={13} />แก้ไข
              </button>
            )}
          </div>

        </div>
      </div>
      {pdfViewer && <PdfViewerModal url={pdfViewer.url} pdfJsUrl={pdfViewer.pdfJsUrl} title={pdfViewer.title} forcePdfJs={pdfViewer.forcePdfJs} onClose={() => setPdfViewer(null)} />}
    </>
  )
}
