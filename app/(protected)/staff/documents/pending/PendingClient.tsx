'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { RevisionPanel } from '@/components/documents/RevisionPanel'
import { DocumentDetailModal, PdfViewerModal } from '@/components/documents/DocumentDetailModal'
import { DocumentActionPanel } from '@/components/documents/DocumentActionPanel'
import { TYPE_ICON_BG, TYPE_ICON_FG, fmtDate } from '@/lib/documents/ui-constants'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import type { Document, DocumentRevisionDraft } from '@/lib/supabase/types'

export interface PendingDoc {
  id: string
  draftId?: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  updated_at: string
  hasOfficialPdf?: boolean
  /** 'draft' = a working revision draft on an already-Published document (opens the
   *  RevisionPanel to act on); 'document' = the document's own status (opens the detail
   *  modal). */
  kind: 'document' | 'draft'
}

export interface AnnualReviewDoc {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  review_confirmed_at: string
  review_confirmed_by_name: string | null
}

interface Props {
  newDocs: PendingDoc[]
  sourceDocs: PendingDoc[]
  reviewDocs: PendingDoc[]
  approvedDocs: PendingDoc[]
  annualReviewDocs: AnnualReviewDoc[]
  userRole?: string
  docRole?: string
  userId?: string
}

function bucketForStatus(status: DocumentRevisionDraft['status'], hasWordUrl: boolean): 'source' | 'review' | 'approved' | null {
  if (status === 'Draft') return hasWordUrl ? 'source' : null
  if (status === 'Review') return 'review'
  if (status === 'Approved') return 'approved'
  return null
}

function DocButton({ doc, loading, onClick }: { doc: PendingDoc; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', width: '100%',
        borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)',
        cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', opacity: loading ? .6 : 1,
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="doc" size={15} style={{ color: TYPE_ICON_FG[doc.type] ?? '#64748B' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
          {doc.kind === 'draft' && (
            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#9333EA', background: 'rgba(147,51,234,.12)', padding: '1px 7px', borderRadius: 99, flexShrink: 0 }}>Working Rev.</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace' }}>{doc.document_code}</span>
          <span>· {doc.type}</span>
          {doc.revision && <span>· Rev.{doc.revision}</span>}
          {doc.department && <span>· {doc.department}</span>}
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtDate(doc.updated_at)}</div>
      <Icon name="chevRight" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </button>
  )
}

function Section({ title, sub, icon, accent, children, count, action }: {
  title: string; sub: string; icon: string; accent: string; count: number; children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: `2.5px solid ${accent}`, borderRadius: 14, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: count > 0 ? 14 : 8 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{sub}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: count > 0 ? accent : 'var(--muted)', background: count > 0 ? `${accent}14` : 'var(--surface-2)', padding: '3px 12px', borderRadius: 99, fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </span>
        {action}
      </div>
      {count === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 2px' }}>ไม่มีรายการค้าง</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
      )}
    </div>
  )
}

function ActionCard({ label, count, sub, icon, accent, onClick }: {
  label: string
  count: number
  sub: string
  icon: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 92,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--card)',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 10, background: `${accent}16`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 24, color: count > 0 ? accent : 'var(--ink)', fontWeight: 850, lineHeight: 1.1, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.35 }}>{sub}</span>
      </span>
      <Icon name="chevRight" size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />
    </button>
  )
}

export function PendingClient({ newDocs: initialNewDocs, sourceDocs: initialSourceDocs, reviewDocs: initialReviewDocs, approvedDocs: initialApprovedDocs, annualReviewDocs: initialAnnualReviewDocs, userRole, docRole, userId = '' }: Props) {
  const router = useRouter()
  const isAdmin = userRole === 'Admin'
  const workflowRole = docRole ?? userRole
  const canAdd = isAdmin
    ? true
    : ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(workflowRole ?? '')
  const canBulkReview = isAdmin || userRole === 'Document Controller' || docRole === 'Document Controller'
  const canDccSourceDownload = canBulkReview

  const newSectionRef = useRef<HTMLDivElement | null>(null)
  const sourceSectionRef = useRef<HTMLDivElement | null>(null)
  const reviewSectionRef = useRef<HTMLDivElement | null>(null)
  const approvedSectionRef = useRef<HTMLDivElement | null>(null)
  const annualSectionRef = useRef<HTMLDivElement | null>(null)

  const [newDocs, setNewDocs] = useState<PendingDoc[]>(initialNewDocs)
  const [sourceDocs, setSourceDocs] = useState<PendingDoc[]>(initialSourceDocs)
  const [reviewDocs, setReviewDocs] = useState<PendingDoc[]>(initialReviewDocs)
  const [approvedDocs, setApprovedDocs] = useState<PendingDoc[]>(initialApprovedDocs)
  const [annualDocs, setAnnualDocs] = useState<AnnualReviewDoc[]>(initialAnnualReviewDocs)
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [sourceBulkBusy, setSourceBulkBusy] = useState(false)
  const [sourceBulkStep, setSourceBulkStep] = useState('')
  const [sourceBulkPercent, setSourceBulkPercent] = useState<number | null>(null)
  const [sourceBulkResult, setSourceBulkResult] = useState<string | null>(null)
  const [revDoc, setRevDoc] = useState<Document | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [actionDoc, setActionDoc] = useState<Document | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set())
  const [pdfViewer, setPdfViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string; forcePdfJs?: boolean } | null>(null)

  const total = newDocs.length + sourceDocs.length + reviewDocs.length + approvedDocs.length + annualDocs.length
  const sourceWaitingPdfCount = sourceDocs.filter((doc) => !doc.hasOfficialPdf).length
  const sourceReadyReviewCount = sourceDocs.filter((doc) => doc.hasOfficialPdf).length

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function filenameFromDisposition(header: string | null) {
    if (!header) return 'dcc-source-files.zip'
    const encoded = header.match(/filename\*=UTF-8''([^;]+)/)
    if (encoded?.[1]) return decodeURIComponent(encoded[1])
    const plain = header.match(/filename="([^"]+)"/)
    return plain?.[1] ?? 'dcc-source-files.zip'
  }

  async function openRevisionPanel(id: string) {
    setLoadingId(id)
    try {
      const res = await fetch(`/api/admin/documents/${id}`)
      const json = await res.json()
      if (res.ok) setRevDoc(json as Document)
    } catch { /* ignore */ } finally {
      setLoadingId(null)
    }
  }

  async function openDetail(id: string) {
    setDetailLoadingId(id)
    try {
      const res = await fetch(`/api/admin/documents/${id}`)
      const json = await res.json()
      if (res.ok) setDetailDoc(json as Document)
    } catch { /* ignore */ } finally {
      setDetailLoadingId(null)
    }
  }

  // DCC action panel for a `kind:'document'` item (fresh Draft / Review / Approved document,
  // not a Rev+ working draft) — upload the content PDF + advance status in-page.
  async function openActionPanel(id: string) {
    setDetailLoadingId(id)
    try {
      const res = await fetch(`/api/admin/documents/${id}`)
      const json = await res.json()
      if (res.ok) setActionDoc(json as Document)
    } catch { /* ignore */ } finally {
      setDetailLoadingId(null)
    }
  }

  // Re-bucket a document after the action panel uploads a file or changes its status.
  function handleDocumentUpdated(updated: Document) {
    setActionDoc(updated)
    const entry: PendingDoc = {
      id: updated.id,
      document_code: updated.document_code,
      title: updated.title,
      type: updated.type,
      department: updated.department,
      revision: updated.revision,
      updated_at: updated.updated_at,
      hasOfficialPdf: updated.type === 'QP' || updated.type === 'WI'
        ? Boolean(updated.source_pdf_url || updated.file_url)
        : Boolean(updated.file_url),
      kind: 'document',
    }
    const dropDoc = (prev: PendingDoc[]) => prev.filter((d) => !(d.kind === 'document' && d.id === updated.id))
    setNewDocs(dropDoc)
    setReviewDocs(dropDoc)
    setApprovedDocs(dropDoc)
    if (updated.status === 'Draft' && updated.word_url) setNewDocs((prev) => [entry, ...prev])
    else if (updated.status === 'Review') setReviewDocs((prev) => [entry, ...prev])
    else if (updated.status === 'Approved') setApprovedDocs((prev) => [entry, ...prev])
    // Published / Obsolete → drops out of every pending bucket.
  }

  async function quickReadDetail(doc: Document) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/read`, { method: 'POST' })
      const json = await res.json()
      if (json.url) { setPdfViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(doc.file_url), title: doc.file_name ?? doc.title, forcePdfJs: json.preview_uncontrolled === true }); setReadDocIds((prev) => new Set(prev).add(doc.id)) }
    } catch { /* ignore */ }
  }

  async function handleDownload(path: string | null | undefined) {
    if (!path) return
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}&variant=download`)
      const json = await res.json()
      if (json.url) window.open(json.url, '_blank')
    } catch { /* ignore */ }
  }

  async function handleDccSourceDownload() {
    if (sourceBulkBusy) return
    const draftIds = sourceDocs
      .map((doc) => doc.draftId)
      .filter((id): id is string => Boolean(id))
    if (draftIds.length === 0) return

    setSourceBulkBusy(true)
    setSourceBulkResult(null)
    setSourceBulkPercent(null)
    setSourceBulkStep('กำลังเตรียมรายการไฟล์ต้นฉบับ...')

    try {
      setSourceBulkStep('กำลังดึงไฟล์ Word/Excel จากคลัง...')
      const res = await fetch('/api/admin/documents/pending/source-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftIds }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(json.error ?? 'สร้าง ZIP ไม่สำเร็จ')
      }

      setSourceBulkStep('กำลังสร้าง ZIP...')
      const totalBytes = Number(res.headers.get('Content-Length') ?? 0)
      const reader = res.body?.getReader()
      const chunks: ArrayBuffer[] = []
      let received = 0

      setSourceBulkStep('กำลังดาวน์โหลด...')
      setSourceBulkPercent(totalBytes > 0 ? 0 : null)
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue
          chunks.push(value.slice().buffer as ArrayBuffer)
          received += value.byteLength
          if (totalBytes > 0) setSourceBulkPercent(Math.min(100, Math.round((received / totalBytes) * 100)))
        }
      } else {
        const blob = await res.blob()
        chunks.push(await blob.arrayBuffer())
        received = blob.size
        if (totalBytes > 0) setSourceBulkPercent(100)
      }

      const blob = new Blob(chunks, { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filenameFromDisposition(res.headers.get('Content-Disposition'))
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const exported = res.headers.get('X-Exported-Files') ?? '0'
      const skipped = res.headers.get('X-Skipped-Files') ?? '0'
      const summary = `ดาวน์โหลดสำเร็จ ${exported} ไฟล์ · ข้าม ${skipped} ไฟล์`
      setSourceBulkResult(summary)
      setSourceBulkPercent(100)
      setSourceBulkStep('เสร็จสิ้น')
    } catch (error) {
      setSourceBulkResult(error instanceof Error ? error.message : 'ดาวน์โหลด ZIP ไม่สำเร็จ')
      setSourceBulkStep('เกิดข้อผิดพลาด')
    } finally {
      setTimeout(() => {
        setSourceBulkBusy(false)
        setSourceBulkStep('')
        setSourceBulkPercent(null)
      }, 900)
    }
  }

  function handlePromoted() {
    // Draft reached Published — it drops out of every pending bucket entirely.
    const parentId = revDoc?.id
    if (parentId) {
      setSourceDocs((prev) => prev.filter((d) => !(d.kind === 'draft' && d.id === parentId)))
      setReviewDocs((prev) => prev.filter((d) => !(d.kind === 'draft' && d.id === parentId)))
      setApprovedDocs((prev) => prev.filter((d) => !(d.kind === 'draft' && d.id === parentId)))
    }
    setRevDoc(null)
    router.refresh()
  }

  function handleDraftStatusChange(draft: DocumentRevisionDraft) {
    const parentId = draft.document_id
    const bucket = bucketForStatus(draft.status, Boolean(draft.word_url))
    setSourceDocs((prev) => prev.filter((d) => !(d.kind === 'draft' && d.id === parentId)))
    setReviewDocs((prev) => prev.filter((d) => !(d.kind === 'draft' && d.id === parentId)))
    setApprovedDocs((prev) => prev.filter((d) => !(d.kind === 'draft' && d.id === parentId)))
    if (!bucket || !revDoc) return
    const entry: PendingDoc = {
      id: parentId,
      draftId: draft.id,
      document_code: revDoc.document_code,
      title: revDoc.title,
      type: revDoc.type,
      department: revDoc.department,
      revision: draft.revision,
      updated_at: draft.updated_at,
      hasOfficialPdf: draft.type === 'QP' || draft.type === 'WI'
        ? Boolean(draft.source_pdf_url || draft.file_url)
        : Boolean(draft.file_url),
      kind: 'draft',
    }
    if (bucket === 'source') setSourceDocs((prev) => [entry, ...prev])
    else if (bucket === 'review') setReviewDocs((prev) => [entry, ...prev])
    else if (bucket === 'approved') setApprovedDocs((prev) => [entry, ...prev])
  }

  function toggleReviewSelection(id: string) {
    setSelectedReviewIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkAnnualReview() {
    const ids = Array.from(selectedReviewIds)
    if (ids.length === 0) return
    if (!confirm(`ยืนยันบันทึกทบทวนประจำปี ${ids.length} ฉบับ?\nระบบจะบันทึกแถวประวัติ "ทบทวนแล้ว ไม่มีการแก้ไข" (Rev คงเดิม ไม่แก้เนื้อ/หน้าปก) และอัปเดตหน้าประวัติท้ายเล่ม PDF ให้อัตโนมัติ`)) return
    setBulkBusy(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/admin/documents/bulk-annual-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const json = await res.json() as { succeeded?: { id: string; document_code: string }[]; failed?: { document_code: string; error: string }[]; error?: string }
      if (!res.ok) { setBulkResult(json.error ?? 'ดำเนินการไม่สำเร็จ'); return }
      const okIds = new Set((json.succeeded ?? []).map((s) => s.id))
      setAnnualDocs((prev) => prev.filter((d) => !okIds.has(d.id)))
      setSelectedReviewIds(new Set())
      const parts = [`สำเร็จ ${json.succeeded?.length ?? 0} ฉบับ`]
      if (json.failed && json.failed.length > 0) {
        parts.push(`ไม่สำเร็จ ${json.failed.length} ฉบับ: ${json.failed.map((f) => `${f.document_code} (${f.error})`).join(', ')}`)
      }
      setBulkResult(parts.join(' · '))
      router.refresh()
    } catch {
      setBulkResult('ดำเนินการไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBulkBusy(false)
    }
  }

  function openPending(d: PendingDoc) {
    if (d.kind === 'draft') openRevisionPanel(d.id)
    else openActionPanel(d.id)
  }

  // One-click publish shortcut for DCC/Admin on an Approved working revision draft — promotes
  // it onto the live document (archives the current revision, bumps Rev) without opening the
  // full revision panel. Used mainly for the Reviewer-submitted "Upd+" queue.
  async function handleQuickPublishDraft(d: PendingDoc) {
    if (!d.draftId || publishingId) return
    if (!confirm(`เผยแพร่ "${d.document_code}" Rev.${d.revision ?? ''} เป็น Published?\nไฟล์เดิมจะถูกเก็บเข้าประวัติการแก้ไข`)) return
    setPublishingId(d.id)
    try {
      const res = await fetch(`/api/admin/documents/${d.id}/revision-drafts/${d.draftId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Published' }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'เผยแพร่ไม่สำเร็จ'); return }
      setApprovedDocs((prev) => prev.filter((x) => !(x.kind === 'draft' && x.id === d.id)))
      router.refresh()
    } catch {
      alert('เผยแพร่ไม่สำเร็จ')
    } finally {
      setPublishingId(null)
    }
  }

  function isLoading(d: PendingDoc) {
    return d.kind === 'draft' ? loadingId === d.id : detailLoadingId === d.id
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sourceBulkBusy && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          background: 'rgba(15,23,42,.28)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            width: 'min(460px, 100%)',
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            boxShadow: '0 24px 70px rgba(15,23,42,.22)',
            padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(147,51,234,.12)', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="download" size={17} />
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>กำลังเตรียม ZIP ไฟล์ต้นฉบับ</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>ค้นหาไฟล์ · รวมไฟล์ · สร้าง ZIP · ดาวน์โหลด</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 650, marginBottom: 10 }}>{sourceBulkStep || 'กำลังเริ่มต้น...'}</div>
            <div style={{ height: 9, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{
                width: sourceBulkPercent === null ? '38%' : `${sourceBulkPercent}%`,
                height: '100%',
                borderRadius: 99,
                background: '#9333EA',
                transition: 'width .18s ease',
                animation: sourceBulkPercent === null ? 'source-bulk-pulse 1.1s ease-in-out infinite alternate' : 'none',
              }} />
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}>
              <span>{sourceDocs.length} รายการ</span>
              <span>{sourceBulkPercent === null ? '...' : `${sourceBulkPercent}%`}</span>
            </div>
            <style>{`
              @keyframes source-bulk-pulse {
                from { transform: translateX(-18%); opacity: .55; }
                to { transform: translateX(170%); opacity: 1; }
              }
            `}</style>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: 18, borderRadius: 14, border: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)',
        boxShadow: '0 14px 36px rgba(15,23,42,.08)',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>เอกสารคุณภาพ</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginTop: 2 }}>รออนุมัติ / งานค้างใน Workflow</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>รายการที่รอการดำเนินการ · {total} รายการ</div>
        </div>
        <Link href="/staff/documents" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          <Icon name="doc" size={15} /> เปิดคลังเอกสาร
        </Link>
      </div>

      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--ink)' }}>DCC Action Center</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>สรุปคิวงานเอกสารที่ต้องดำเนินการต่อ</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>รวม {total} รายการ</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 10 }}>
          <ActionCard label="เอกสารใหม่ รอจัดทำ PDF" count={newDocs.length} sub="เอกสาร Rev.00 มีไฟล์ต้นฉบับแล้ว รอ DCC" icon="plus" accent="#0EA5E9" onClick={() => scrollToSection(newSectionRef)} />
          <ActionCard label="รอทำ PDF (Rev+)" count={sourceWaitingPdfCount} sub="มี Word/Excel แล้ว รอ DCC จัดทำ PDF" icon="upload" accent="#9333EA" onClick={() => scrollToSection(sourceSectionRef)} />
          <ActionCard label="พร้อมส่ง Review" count={sourceReadyReviewCount} sub="มีไฟล์ทางการแล้ว ตรวจและส่งต่อได้" icon="arrowRight" accent="#2563EB" onClick={() => scrollToSection(sourceSectionRef)} />
          <ActionCard label="รอผู้รับรองตรวจสอบ" count={reviewDocs.length} sub="เอกสารอยู่ในสถานะ Review" icon="eye" accent="#D97706" onClick={() => scrollToSection(reviewSectionRef)} />
          <ActionCard label="รอเผยแพร่" count={approvedDocs.length} sub="อนุมัติแล้ว รอเผยแพร่เป็น Published" icon="check" accent="#16A34A" onClick={() => scrollToSection(approvedSectionRef)} />
          <ActionCard label="รอทบทวนประจำปี" count={annualDocs.length} sub="QP/WI ที่ยืนยัน review แล้ว" icon="clock" accent="#0D9488" onClick={() => scrollToSection(annualSectionRef)} />
        </div>
      </div>

      <div ref={newSectionRef}>
        <Section
          title="เอกสารใหม่ รอจัดทำ PDF"
          sub="เอกสารสร้างใหม่ (Rev.00) ที่อัปโหลดไฟล์ต้นฉบับแล้ว รอ DCC จัดทำ PDF เนื้อหาและส่งเข้า Review"
          icon="plus" accent="#0EA5E9" count={newDocs.length}
        >
          {newDocs.map((d) => (
            <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
          ))}
        </Section>
      </div>

      <div ref={sourceSectionRef}>
        <Section
          title="ไฟล์ Word/Excel รอ DCC ดำเนินการ"
          sub="Working revision ที่อัปโหลดไฟล์ต้นฉบับแล้ว รอ DCC จัดทำ PDF เนื้อหา"
          icon="upload" accent="#9333EA" count={sourceDocs.length}
          action={canDccSourceDownload && sourceDocs.length > 0 ? (
            <button
              onClick={handleDccSourceDownload}
              disabled={sourceBulkBusy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
                border: '1px solid #9333EA', background: sourceBulkBusy ? 'var(--surface-2)' : '#9333EA',
                color: sourceBulkBusy ? 'var(--muted)' : '#fff', fontSize: 12.5, fontWeight: 800,
                fontFamily: 'inherit', cursor: sourceBulkBusy ? 'default' : 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Icon name="download" size={13} />
              {sourceBulkBusy ? 'กำลังเตรียม...' : 'ดาวน์โหลดไฟล์ต้นฉบับทั้งหมด'}
            </button>
          ) : null}
        >
          {sourceBulkResult && (
            <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(147,51,234,.08)', border: '1px solid rgba(147,51,234,.22)', color: '#7E22CE', fontSize: 12, lineHeight: 1.45 }}>
              {sourceBulkResult}
            </div>
          )}
          {sourceDocs.map((d) => (
            <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
          ))}
        </Section>
      </div>

      <div ref={reviewSectionRef}>
        <Section
          title="รอตรวจสอบ (Review)"
          sub="เอกสารที่ส่งเข้าสถานะ Review รอผู้รับรองตรวจสอบ"
          icon="eye" accent="#D97706" count={reviewDocs.length}
        >
          {reviewDocs.map((d) => (
            <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
          ))}
        </Section>
      </div>

      <div ref={approvedSectionRef}>
        <Section
          title="รออนุมัติเผยแพร่ (Approved)"
          sub="เอกสารที่รับรองแล้ว รอผู้มีอำนาจอนุมัติเผยแพร่เป็น Published"
          icon="check" accent="#16A34A" count={approvedDocs.length}
        >
          {approvedDocs.map((d) => (
            (d.kind === 'draft' && d.draftId && canBulkReview) ? (
              <div key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <DocButton doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
                </div>
                <button
                  onClick={() => handleQuickPublishDraft(d)}
                  disabled={publishingId === d.id}
                  title="เผยแพร่เป็น Published (Rev+1, เก็บไฟล์เดิมเข้าประวัติ)"
                  style={{
                    flexShrink: 0, padding: '0 16px', borderRadius: 10, border: '1px solid #16A34A',
                    background: 'rgba(22,163,74,.10)', color: '#15803D', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: 700, cursor: publishingId === d.id ? 'default' : 'pointer',
                    opacity: publishingId === d.id ? .6 : 1, whiteSpace: 'nowrap',
                  }}
                >
                  {publishingId === d.id ? 'กำลังเผยแพร่...' : 'Published'}
                </button>
              </div>
            ) : (
              <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
            )
          ))}
        </Section>
      </div>

      <div ref={annualSectionRef}>
        <Section
          title="รอทบทวนประจำปี (Annual Review)"
          sub="เอกสาร QP/WI ที่ยืนยันการทบทวนแล้ว รอ DCC บันทึก 'ทบทวนแล้ว ไม่มีการแก้ไข' (Rev คงเดิม)"
          icon="clock" accent="#0D9488" count={annualDocs.length}
        >
        {bulkResult && (
          <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(13,148,136,.08)', border: '1px solid rgba(13,148,136,.25)', color: '#0F766E', fontSize: 12, lineHeight: 1.45 }}>
            {bulkResult}
          </div>
        )}
        {canBulkReview && annualDocs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={annualDocs.length > 0 && annualDocs.every((d) => selectedReviewIds.has(d.id))}
                onChange={(e) => setSelectedReviewIds(e.target.checked ? new Set(annualDocs.map((d) => d.id)) : new Set())}
                style={{ accentColor: '#0D9488' }}
              />
              เลือกทั้งหมด
            </label>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleBulkAnnualReview}
              disabled={bulkBusy || selectedReviewIds.size === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8,
                border: 'none', background: selectedReviewIds.size > 0 ? '#0D9488' : 'var(--border)',
                color: selectedReviewIds.size > 0 ? '#fff' : 'var(--muted)', fontSize: 12.5, fontWeight: 700,
                fontFamily: 'inherit', cursor: bulkBusy || selectedReviewIds.size === 0 ? 'default' : 'pointer',
                opacity: bulkBusy ? .6 : 1,
              }}
            >
              <Icon name="check" size={13} />
              {bulkBusy ? 'กำลังดำเนินการ…' : `บันทึกทบทวนประจำปี (${selectedReviewIds.size} ฉบับ)`}
            </button>
          </div>
        )}
        {annualDocs.map((d) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canBulkReview && (
              <input
                type="checkbox"
                checked={selectedReviewIds.has(d.id)}
                onChange={() => toggleReviewSelection(d.id)}
                disabled={bulkBusy}
                style={{ accentColor: '#0D9488', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <DocButton
                doc={{ id: d.id, document_code: d.document_code, title: d.title, type: d.type, department: d.department, revision: d.revision, updated_at: d.review_confirmed_at, kind: 'document' }}
                loading={detailLoadingId === d.id}
                onClick={() => openDetail(d.id)}
              />
            </div>
          </div>
        ))}
        </Section>
      </div>

      {revDoc && (
        <RevisionPanel
          doc={revDoc}
          onClose={() => setRevDoc(null)}
          onDownload={handleDownload}
          onPromoted={handlePromoted}
          onDraftStatusChange={handleDraftStatusChange}
          userRole={userRole ?? ''}
          docRole={docRole}
          canAdd={canAdd}
          variant="modal"
        />
      )}

      {actionDoc && (
        <DocumentActionPanel
          doc={actionDoc}
          userRole={userRole ?? ''}
          docRole={docRole}
          onClose={() => setActionDoc(null)}
          onUpdated={handleDocumentUpdated}
        />
      )}

      {detailDoc && (
        <DocumentDetailModal
          doc={detailDoc}
          hasRead={readDocIds.has(detailDoc.id)}
          canUpload={canAdd}
          userRole={userRole ?? ''}
          docRole={docRole ?? null}
          userId={userId}
          onClose={() => setDetailDoc(null)}
          onRead={() => quickReadDetail(detailDoc)}
          onHistory={() => { setRevDoc(detailDoc); setDetailDoc(null) }}
          onEdit={() => router.push(`/staff/documents?search=${encodeURIComponent(detailDoc.document_code)}&open=${detailDoc.id}`)}
          onDownload={handleDownload}
          onReviewConfirmed={(updated) => { setDetailDoc(updated); router.refresh() }}
        />
      )}

      {pdfViewer && <PdfViewerModal url={pdfViewer.url} pdfJsUrl={pdfViewer.pdfJsUrl} title={pdfViewer.title} forcePdfJs={pdfViewer.forcePdfJs} onClose={() => setPdfViewer(null)} />}
    </div>
  )
}
