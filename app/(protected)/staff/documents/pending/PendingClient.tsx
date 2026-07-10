'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { RevisionPanel } from '@/components/documents/RevisionPanel'
import { DocumentDetailModal, PdfViewerModal } from '@/components/documents/DocumentDetailModal'
import { TYPE_ICON_BG, TYPE_ICON_FG, fmtDate } from '@/lib/documents/ui-constants'
import type { Document, DocumentRevisionDraft } from '@/lib/supabase/types'

export interface PendingDoc {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  updated_at: string
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

function Section({ title, sub, icon, accent, children, count }: {
  title: string; sub: string; icon: string; accent: string; count: number; children: React.ReactNode
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
      </div>
      {count === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 2px' }}>ไม่มีรายการค้าง</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>{children}</div>
      )}
    </div>
  )
}

export function PendingClient({ sourceDocs: initialSourceDocs, reviewDocs: initialReviewDocs, approvedDocs: initialApprovedDocs, annualReviewDocs: initialAnnualReviewDocs, userRole, docRole, userId = '' }: Props) {
  const router = useRouter()
  const isAdmin = userRole === 'Admin'
  const workflowRole = docRole ?? userRole
  const canAdd = isAdmin
    ? true
    : ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(workflowRole ?? '')
  const canBulkReview = isAdmin || userRole === 'Document Controller' || docRole === 'Document Controller'

  const [sourceDocs, setSourceDocs] = useState<PendingDoc[]>(initialSourceDocs)
  const [reviewDocs, setReviewDocs] = useState<PendingDoc[]>(initialReviewDocs)
  const [approvedDocs, setApprovedDocs] = useState<PendingDoc[]>(initialApprovedDocs)
  const [annualDocs, setAnnualDocs] = useState<AnnualReviewDoc[]>(initialAnnualReviewDocs)
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)
  const [revDoc, setRevDoc] = useState<Document | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set())
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null)

  const total = sourceDocs.length + reviewDocs.length + approvedDocs.length + annualDocs.length

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

  async function quickReadDetail(doc: Document) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/read`, { method: 'POST' })
      const json = await res.json()
      if (json.url) { setPdfViewer({ url: json.url, title: doc.file_name ?? doc.title }); setReadDocIds((prev) => new Set(prev).add(doc.id)) }
    } catch { /* ignore */ }
  }

  async function handleDownload(path: string | null | undefined) {
    if (!path) return
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}`)
      const json = await res.json()
      if (json.url) window.open(json.url, '_blank')
    } catch { /* ignore */ }
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
      document_code: revDoc.document_code,
      title: revDoc.title,
      type: revDoc.type,
      department: revDoc.department,
      revision: draft.revision,
      updated_at: draft.updated_at,
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
    else openDetail(d.id)
  }

  function isLoading(d: PendingDoc) {
    return d.kind === 'draft' ? loadingId === d.id : detailLoadingId === d.id
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

      <Section
        title="ไฟล์ Word/Excel รอ DCC ดำเนินการ"
        sub="Working revision ที่อัปโหลดไฟล์ต้นฉบับแล้ว รอ DCC จัดทำ PDF เนื้อหา"
        icon="upload" accent="#9333EA" count={sourceDocs.length}
      >
        {sourceDocs.map((d) => (
          <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
        ))}
      </Section>

      <Section
        title="รอตรวจสอบ (Review)"
        sub="เอกสารที่ส่งเข้าสถานะ Review รอผู้รับรองตรวจสอบ"
        icon="eye" accent="#D97706" count={reviewDocs.length}
      >
        {reviewDocs.map((d) => (
          <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
        ))}
      </Section>

      <Section
        title="รออนุมัติเผยแพร่ (Approved)"
        sub="เอกสารที่รับรองแล้ว รอผู้มีอำนาจอนุมัติเผยแพร่เป็น Published"
        icon="check" accent="#16A34A" count={approvedDocs.length}
      >
        {approvedDocs.map((d) => (
          <DocButton key={d.id} doc={d} loading={isLoading(d)} onClick={() => openPending(d)} />
        ))}
      </Section>

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

      {pdfViewer && <PdfViewerModal url={pdfViewer.url} title={pdfViewer.title} onClose={() => setPdfViewer(null)} />}
    </div>
  )
}
