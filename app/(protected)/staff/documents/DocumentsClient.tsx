'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { StickyScroll } from '@/components/ui/StickyScroll'
import { DocumentUploadModal } from '@/components/documents/DocumentUploadModal'
import { allowedTransitions } from '@/lib/documents/transitions'
import { canMoveToStatus, isCoverRequiredType } from '@/lib/documents/workflow'
import type { DocStatus } from '@/lib/documents/transitions'
import type { Document, DocumentRevisionDraft } from '@/lib/supabase/types'

// ── Constants ─────────────────────────────────────────────────
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Reference', 'Card file', 'Others'] as const

const DEPARTMENTS = [
  'กลุ่มงานเทคนิคการแพทย์',
  'งานคลังเลือด',
  'งานจุลชีววิทยาคลินิก',
  'งานโลหิตวิทยาคลินิก',
  'งานภูมิคุ้มกันวิทยาคลินิก',
  'งานจุลทรรศน์ศาสตร์คลินิก',
  'งานเคมีคลินิก',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'งานอณูชีววิทยา',
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
] as const

const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', Record: 'gray', Reference: 'red', 'Card file': 'amber', Others: 'gray',
}
const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)',
  Record: 'rgba(100,116,139,.10)', Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Others: 'rgba(100,116,139,.10)',
}
const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', Record: '#64748B', Reference: '#EA580C', 'Card file': '#F59E0B', Others: '#64748B',
}

const STATUS_COLOR: Record<DocStatus, 'gray' | 'amber' | 'blue' | 'green' | 'red'> = {
  Draft: 'gray', Review: 'amber', Approved: 'blue', Published: 'green', Obsolete: 'red',
}
const STATUS_LABEL: Record<DocStatus, string> = {
  Draft: 'Draft', Review: 'Review', Approved: 'Approved',
  Published: 'Published', Obsolete: 'Obsolete',
}
const ALL_STATUSES: DocStatus[] = ['Draft', 'Review', 'Approved', 'Published', 'Obsolete']

interface StatusHistoryRow {
  to_status: string
  changed_at: string
}

// ── Linked document type ──────────────────────────────────────
interface LinkedDoc {
  id: string
  linked_doc_id: string
  created_by: string | null
  created_at: string
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

// ── Attachment type ───────────────────────────────────────────
interface Attachment {
  id: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
  profiles: { name: string } | null
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
  created_at: string
  history_source?: string | null
}

// ── Toast ─────────────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; ok: boolean }

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

// ── Helpers ───────────────────────────────────────────────────
function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function fmtStatusDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PAGE_SIZE = 30
const DEFAULT_TYPE_FILTER = 'All'

// ── Status Change Modal ────────────────────────────────────────
function StatusModal({ doc, userRole, docRole, onClose, onSaved, toast }: {
  doc: Document
  userRole: string
  docRole?: string
  onClose: () => void
  onSaved: (updated: Document) => void
  toast: (msg: string, ok?: boolean) => void
}) {
  const transitions = allowedTransitions(doc.status as DocStatus, userRole, docRole)
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState('')
  const [statusDates, setStatusDates] = useState<Partial<Record<DocStatus, string>>>({})

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/documents/${doc.id}/status-history`)
      .then(async (res) => (res.ok ? await res.json() : []))
      .then((rows: StatusHistoryRow[]) => {
        if (!alive) return
        const nextDates: Partial<Record<DocStatus, string>> = {}
        for (const row of rows) {
          if (ALL_STATUSES.includes(row.to_status as DocStatus)) {
            nextDates[row.to_status as DocStatus] = row.changed_at
          }
        }
        setStatusDates(nextDates)
      })
      .then(undefined, () => {
        if (alive) setStatusDates({})
      })
    return () => { alive = false }
  }, [doc.id])

  async function handleChange(next: DocStatus) {
    setSaving(true)
    const body: Record<string, string> = { status: next }
    if (next === 'Obsolete' && reason.trim()) body.obsolete_reason = reason.trim()
    const res = await fetch(`/api/admin/documents/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const j = await res.json()
      toast(j.error ?? 'เปลี่ยนสถานะไม่สำเร็จ', false)
      return
    }
    const updated = await res.json()
    setStatusDates((prev) => ({ ...prev, [next]: updated.updated_at ?? new Date().toISOString() }))
    toast(`เปลี่ยนสถานะเป็น "${STATUS_LABEL[next]}" แล้ว`)
    onSaved(updated)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Card padding={24} style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>เปลี่ยนสถานะเอกสาร</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Document title */}
        <div style={{ padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{doc.title}</div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'monospace', marginTop: 2 }}>{doc.document_code}</div>
        </div>

        {/* Status flow */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>สถานะปัจจุบัน</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
            {ALL_STATUSES.map((s, i) => {
              const isCurrent = s === doc.status
              const isTarget  = transitions.includes(s)
              const statusDate = fmtStatusDate(statusDates[s] ?? null)
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  {i > 0 && <span style={{ fontSize: 10, color: 'var(--muted)', lineHeight: '28px' }}>→</span>}
                  <div style={{ minWidth: 76, textAlign: 'center' }}>
                    <div style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${isCurrent ? 'var(--primary)' : 'var(--border)'}`,
                      background: isCurrent ? 'var(--primary-soft)' : 'transparent',
                      color: isCurrent ? 'var(--primary)' : 'var(--muted)',
                      opacity: !isCurrent && !isTarget ? 0.4 : 1,
                    }}>
                      {STATUS_LABEL[s]}
                    </div>
                    <div style={{
                      height: 16, marginTop: 4, fontSize: 10.5, lineHeight: '16px',
                      color: statusDate ? 'var(--muted)' : 'transparent', whiteSpace: 'nowrap',
                    }}>
                      {statusDate || '-'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {transitions.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
            ไม่สามารถเปลี่ยนสถานะจากสถานะนี้ได้
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>เปลี่ยนเป็น</div>
            {transitions.includes('Obsolete') && (
              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>เหตุผลการยกเลิก (ไม่บังคับ)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุเหตุผล..."
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}
            {transitions.map((next) => (
              (() => {
                const workflowCheck = canMoveToStatus({
                  type: doc.type,
                  status: doc.status,
                  file_url: doc.file_url,
                  source_pdf_url: doc.source_pdf_url,
                  word_url: doc.word_url,
                }, next)
                const disabled = saving || !workflowCheck.ok
                return (
                  <button
                    key={next}
                    disabled={disabled}
                    title={!workflowCheck.ok ? workflowCheck.error : undefined}
                    onClick={() => workflowCheck.ok && handleChange(next)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'var(--card)', cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'all .12s', opacity: disabled ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{STATUS_LABEL[next]}</span>
                    <Badge color={STATUS_COLOR[next]} size="sm">{next}</Badge>
                  </button>
                )
              })()
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>ปิด</Button>
        </div>
      </Card>
    </div>
  )
}

// ── Document Detail Modal ──────────────────────────────────────
function DocDetailModal({ doc, hasRead, canUpload, userRole, docRole, userId, onClose, onRead, onHistory, onEdit, onDownload }: {
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
}) {
  const docStatus = doc.status as DocStatus
  const typeColor = TYPE_ICON_FG[doc.type] ?? '#64748B'
  const typeBg    = TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)'

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

  async function handleDownloadAll() {
    setDownloadingAll(true)
    const paths: string[] = [
      ...(doc.file_url ? [doc.file_url] : []),
      ...(canDownloadSource && doc.word_url ? [doc.word_url] : []),
      ...links.map(l => l.documents?.file_url).filter((path): path is string => Boolean(path)),
      ...attachments.map(a => a.file_url),
    ].filter((path): path is string => Boolean(path))
    for (let i = 0; i < paths.length; i++) {
      if (i > 0) await new Promise(res => setTimeout(res, 500))
      try {
        const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(paths[i])}`)
        const json = await res.json()
        if (json.url) window.open(json.url, '_blank')
      } catch { /* continue */ }
    }
    setDownloadingAll(false)
  }

  async function openLinkedDocRead(docId: string, fileUrl: string | null, fileName: string | null) {
    if (!fileUrl || !fileName) return
    try {
      const res = await fetch(`/api/admin/documents/${docId}/read`, { method: 'POST' })
      const json = await res.json()
      if (json.url) { window.open(json.url, '_blank'); return }
    } catch { /* ignore */ }
    // fallback: inline download
    openAttachmentInline(fileUrl, fileName)
  }

  async function openAttachmentInline(fileUrl: string, fileName: string) {
    const isPdf = /\.pdf$/i.test(fileName)
    const qs = isPdf ? '&inline=1' : ''
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(fileUrl)}${qs}`)
      const json = await res.json()
      if (json.url) window.open(json.url, '_blank')
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
                {(attachments.length > 0 || (doc.word_url && canDownloadSource)) && (
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
                  <FileCard name={doc.word_name} size={doc.word_size} accentColor="#059669" path={doc.word_url} />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                  {links.map(l => {
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
                          </div>
                        </div>
                        <button disabled={!d.file_url} onClick={() => d.file_url && onDownload(d.file_url)} title={d.file_url ? 'ดาวน์โหลด' : 'ยังไม่มีไฟล์ทางการ'}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: d.file_url ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', flexShrink: 0, opacity: d.file_url ? 1 : 0.45 }}
                          onMouseEnter={e => { if (d.file_url) { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' } }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                          <Icon name="download" size={12} />
                        </button>
                        {canDeleteAttach(l.created_by) && (['Draft', 'Review'].includes(doc.status) || ['Admin', 'Manager'].includes(userRole) || docRole === 'Document Controller') && (
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
    </>
  )
}

// ── Revision History Panel ─────────────────────────────────────
function RevisionPanel({ doc, onClose, onDownload, onPromoted, userRole, docRole, canAdd }: {
  doc: Document
  onClose: () => void
  onDownload: (path: string) => void
  onPromoted: (updated: Document) => void
  userRole: string
  docRole?: string
  canAdd: boolean
}) {

  const canDownloadRevision = userRole === 'Admin' || docRole === 'Document Controller'
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
  const [skipSystemCover, setSkipSystemCover] = useState(false)
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
    const TYPE_LABEL: Record<string, string> = {
      QP: 'ระเบียบปฏิบัติ QP', WI: 'วิธีปฏิบัติ (WI)', Manual: 'คู่มือคุณภาพ (QM)',
      Form: 'แบบฟอร์ม (Form)', Policy: 'นโยบาย (Policy)', Record: 'บันทึกคุณภาพ (Record)',
      Reference: 'เอกสารอ้างอิง (Reference)', 'Card file': 'Card file', Others: 'เอกสารอื่นๆ',
    }
    const fmtD = (s: string) =>
      s ? new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

    const ROWS_PER_PAGE = 14
    const revisionCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    const currentRevisionRow: RevisionRow = {
      id: `current-${doc.id}`,
      revision_number: doc.revision,
      revision_note: doc.description ?? null,
      revised_by: doc.owner_name ?? null,
      approved_by: doc.approver_name ?? null,
      file_url: doc.file_url ?? null,
      file_name: doc.file_name ?? null,
      created_at: doc.edit_date ?? doc.effective_date ?? doc.published_at ?? doc.updated_at ?? doc.created_at,
      history_source: 'current',
    }
    const archivedRows = revisions.filter((rev) => (
      rev.revision_number !== currentRevisionRow.revision_number
      || rev.file_url !== currentRevisionRow.file_url
    ))
    const sorted = [...archivedRows, currentRevisionRow]
      .sort((a, b) => {
        const revisionOrder = revisionCollator.compare(a.revision_number, b.revision_number)
        if (revisionOrder !== 0) return revisionOrder
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
    const pages: RevisionRow[][] = []
    for (let i = 0; i < Math.max(sorted.length, 1); i += ROWS_PER_PAGE) {
      pages.push(sorted.slice(i, i + ROWS_PER_PAGE))
    }

    const headerBlock = `
      <div class="page-header">
        <div class="main-title">แบบบันทึกประวัติการแก้ไข/ทบทวนเอกสาร</div>
        <div class="sub-title">กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี</div>
        <div class="doc-meta">ประเภทเอกสาร ${TYPE_LABEL[doc.type] ?? doc.type}</div>
        <div class="doc-meta">เรื่อง ${doc.title}&nbsp;&nbsp;&nbsp;รหัส ${doc.document_code}</div>
      </div>`

    const theadHtml = `<thead><tr>
      <th class="col-no">ลำดับที่</th>
      <th class="col-rev">Rev.</th>
      <th class="col-date">วันที่แก้ไข</th>
      <th class="col-detail">รายการแก้ไข</th>
      <th class="col-person">ผู้ทำการแก้ไข</th>
      <th class="col-person">ผู้อนุมัติ</th>
    </tr></thead>`

    let rowIdx = 1
    const pagesHtml = pages.map((page, pageIndex) => {
      const isLastPage = pageIndex === pages.length - 1
      const filledRows = [...page]
      if (!isLastPage) {
        while (filledRows.length < ROWS_PER_PAGE) filledRows.push(null as unknown as RevisionRow)
      }
      const tbodyHtml = filledRows.map((r) =>
        r
          ? `<tr>
              <td class="center">${rowIdx++}</td>
              <td class="center">${r.revision_number}</td>
              <td class="center">${fmtD(r.created_at)}</td>
              <td>${r.revision_note ?? ''}</td>
              <td class="center">${r.revised_by ?? ''}</td>
              <td class="center">${r.approved_by ?? ''}</td>
            </tr>`
          : `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>`
      ).join('')
      return `
        <div class="page">
          ${headerBlock}
          <table>${theadHtml}<tbody>${tbodyHtml}</tbody></table>
          <div class="page-footer">
            <span class="footer-spacer"></span>
            <span class="footer-center">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
            <span class="footer-right">Fm-QP-LAB-01/03</span>
          </div>
        </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fm-QP-LAB-01-03</title><style>
      @page { size: A4 portrait; margin: 8mm 10mm 8mm 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'TH Sarabun New', 'Sarabun', 'Cordia New', Arial, sans-serif; font-size: 14pt; color: #000; }
      .page { page-break-after: always; display: flex; flex-direction: column; height: 277mm; }
      .page:last-child { page-break-after: avoid; }
      .page-header { text-align: center; margin-bottom: 8px; flex-shrink: 0; }
      .main-title { font-size: 17pt; font-weight: bold; line-height: 1.5; }
      .sub-title { font-size: 16pt; font-weight: bold; line-height: 1.5; }
      .doc-meta { font-size: 14pt; font-weight: bold; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; flex-shrink: 0; }
      th, td { border: 1.5px solid #000; padding: 3px 6px; font-size: 13pt; height: 26px; }
      th { background: #f5f5f5; font-weight: bold; text-align: center; }
      .col-no { width: auto; white-space: nowrap; }
      .col-rev { width: 8%; }
      .col-date { width: 12%; }
      .col-detail { width: auto; }
      .col-person { width: 22%; }
      .center { text-align: center; }
      .page-footer { display: flex; align-items: center; font-size: 10.5pt; color: #555; margin-top: auto; padding-top: 4px; border-top: 1px solid #bbb; }
      .footer-spacer { flex: 1; }
      .footer-center { flex: 0 1 auto; text-align: center; }
      .footer-right { flex: 1; text-align: right; white-space: nowrap; }
    </style></head><body>${pagesHtml}</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    if (!win) { URL.revokeObjectURL(blobUrl); return }
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
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

  function parseDraftUploadResponse(text: string): { error?: string; uploadUrl?: string; key?: string; contentType?: string } {
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
      if (!presignJson.uploadUrl || !presignJson.key) {
        alert(`สร้าง URL อัปโหลดไฟล์ไม่สำเร็จ: response ไม่ครบ ${presignText.slice(0, 160)}`)
        return
      }

      const uploadRes = await fetch(presignJson.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': presignJson.contentType ?? fileType },
        body: file,
      })
      if (!uploadRes.ok) {
        const uploadText = await uploadRes.text().catch(() => '')
        alert(`อัปโหลดไฟล์ไปยัง storage ไม่สำเร็จ (${uploadRes.status}) ${uploadText.slice(0, 160)}`)
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
    } catch {
      alert('อัปโหลดไฟล์ไม่สำเร็จ')
    } finally {
      if (draftOfficialRef.current) draftOfficialRef.current.value = ''
      if (draftSourceRef.current) draftSourceRef.current.value = ''
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
    const shouldSkipSystemCover = skipSystemCover && next === 'Published' && (activeDraft.type === 'QP' || activeDraft.type === 'WI')
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
        }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'เปลี่ยนสถานะ working revision ไม่สำเร็จ'); return }
      if (next === 'Published') {
        setActiveDraft(null)
        setSkipSystemCover(false)
        loadRevisions()
        onPromoted(json as Document)
      } else {
        setActiveDraft(json)
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
      const fd = new FormData()
      fd.append('revision_number', formRev.trim())
      if (formNote.trim()) fd.append('revision_note', formNote.trim())
      if (formRevisedBy.trim()) fd.append('revised_by', formRevisedBy.trim())
      if (formApprover.trim()) fd.append('approved_by', formApprover.trim())
      if (formDate) fd.append('revision_date', formDate)
      if (formFile) fd.append('file', formFile)
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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000 }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '95vw',
        background: 'var(--card)', zIndex: 1001, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,.18)',
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

                {canSkipSystemCover && (activeDraft.type === 'QP' || activeDraft.type === 'WI') && activeDraft.status === 'Approved' && (
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

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
                          แก้ไขล่าสุด {fmtDate(rev.created_at)}
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
    </>
  )
}

// ── Read Modal ────────────────────────────────────────────────
interface ReadLog {
  id: string
  user_id: string
  created_at: string
  profiles: { name: string; role: string; document_position: string | null } | null
}

function ReadModal({ doc, userRole, canViewLog, onClose, onResetReadIds, onReadLogged }: {
  doc: Document
  userRole: string
  canViewLog: boolean
  onClose: () => void
  onResetReadIds: (docId: string | null) => void
  onReadLogged: (docId: string) => void
}) {
  const [url, setUrl]         = useState<string | null>(null)
  const [mime, setMime]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg]   = useState('')
  const [logs, setLogs]       = useState<ReadLog[]>([])
  const [showLog, setShowLog] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting]       = useState(false)
  const didLog = useRef(false)

  useEffect(() => {
    if (didLog.current) return
    didLog.current = true
    if (!doc.file_url) {
      setErrMsg('เอกสารนี้ยังไม่มีไฟล์ทางการสำหรับอ่าน')
      setLoading(false)
      return
    }
    fetch(`/api/admin/documents/${doc.id}/read`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.url) { setUrl(d.url); setMime(d.mime_type ?? ''); onReadLogged(doc.id) }
        else setErrMsg(d.error ?? 'ไม่สามารถเปิดได้')
      })
      .catch(() => setErrMsg('เกิดข้อผิดพลาด'))
      .finally(() => setLoading(false))
  }, [doc.id, doc.file_url, onReadLogged])

  function loadLogs() {
    if (!canViewLog) return
    setShowLog(true)
    fetch(`/api/admin/documents/${doc.id}/read`)
      .then((r) => r.json())
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .catch(() => {})
  }

  async function downloadCurrentFile() {
    if (!doc.file_url) return
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(doc.file_url)}`)
      const json = await res.json()
      if (json.url) window.open(json.url, '_blank')
    } catch {}
  }

  async function handleReset(scope: 'single' | 'all') {
    setResetting(true)
    const url = scope === 'single'
      ? `/api/admin/documents/read-logs?scope=single&docId=${doc.id}`
      : `/api/admin/documents/read-logs?scope=all`
    await fetch(url, { method: 'DELETE' }).catch(() => {})
    setLogs([])
    setResetConfirm(false)
    setResetting(false)
    onResetReadIds(scope === 'single' ? doc.id : null)
  }

  function downloadReadLog() {
    const TYPE_LABEL: Record<string, string> = {
      QP: 'ระเบียบปฏิบัติ QP',
      WI: 'วิธีปฏิบัติ (WI)',
      Manual: 'คู่มือคุณภาพ (QM)',
      Form: 'แบบฟอร์ม (Form)',
      Policy: 'นโยบาย (Policy)',
      Record: 'บันทึกคุณภาพ (Record)',
      Reference: 'เอกสารอ้างอิง (Reference)',
      'Card file': 'Card file',
      Others: 'เอกสารอื่นๆ',
    }
    const posLabel = (role: string | undefined) => {
      if (role === 'Manager' || role === 'Medical Technologist' || role === 'Document Controller' || role === 'Admin') return 'นักเทคนิคการแพทย์'
      if (role === 'Assistant') return 'พนักงานประจำห้องทดลอง'
      if (role === 'Medical Science Technician') return 'เจ้าพนักงานวิทยาศาสตร์การแพทย์'
      return ''
    }
    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    // Deduplicate: keep latest record per user (all roles)
    const seen = new Map<string, ReadLog>()
    for (const log of logs) {
      const uid = log.user_id
      if (!seen.has(uid) || new Date(log.created_at) > new Date(seen.get(uid)!.created_at)) {
        seen.set(uid, log)
      }
    }
    const unique = Array.from(seen.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    const ROWS_PER_PAGE = 25
    const pages: ReadLog[][] = []
    for (let i = 0; i < Math.max(unique.length, 1); i += ROWS_PER_PAGE) {
      pages.push(unique.slice(i, i + ROWS_PER_PAGE))
    }

    const headerBlock = `
      <div class="page-header">
        <div class="main-title">แบบบันทึกการลงชื่อรับทราบ การศึกษาและทำความเข้าใจเอกสารคุณภาพ</div>
        <div class="sub-title">กลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี</div>
        <div class="doc-meta">ประเภทเอกสาร ${TYPE_LABEL[doc.type] ?? doc.type}</div>
        <div class="doc-meta">เรื่อง ${doc.title}&nbsp;&nbsp;&nbsp;รหัส ${doc.document_code}</div>
      </div>`

    const theadHtml = `<thead><tr><th class="col-no">ลำดับที่</th><th class="col-name">ชื่อ-สกุล</th><th class="col-pos">ตำแหน่ง</th><th class="col-date">วันที่ - เวลา</th></tr></thead>`

    let rowIdx = 1
    const pagesHtml = pages.map((page, pageIndex) => {
      const isLastPage = pageIndex === pages.length - 1
      const filledRows = [...page]
      // Fill blank rows only on non-last pages to maintain consistent page height
      if (!isLastPage) {
        while (filledRows.length < ROWS_PER_PAGE) filledRows.push(null as unknown as ReadLog)
      }
      const tbodyHtml = filledRows.map((log) =>
        log
          ? `<tr><td class="center">${rowIdx++}</td><td>${log.profiles?.name ?? ''}</td><td class="center">${log.profiles?.document_position || posLabel(log.profiles?.role)}</td><td class="center">${fmtDate(log.created_at)}</td></tr>`
          : `<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>`
      ).join('')
      return `
        <div class="page">
          ${headerBlock}
          <table>${theadHtml}<tbody>${tbodyHtml}</tbody></table>
          <div class="page-footer">
            <span class="footer-spacer"></span>
            <span class="footer-center">เอกสารนี้เป็นสมบัติของกลุ่มงานเทคนิคการแพทย์โรงพยาบาลชลบุรี ห้ามนำออกไปใช้ภายนอกหรือทำซ้ำโดยไม่ได้รับอนุญาต</span>
            <span class="footer-right">Fm-QP-LAB-01/05</span>
          </div>
        </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fm-QP-LAB-01-05</title><style>
      @page { size: A4 portrait; margin: 12mm 15mm 12mm 15mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'TH Sarabun New', 'Sarabun', 'Cordia New', Arial, sans-serif; font-size: 14pt; color: #000; }
      .page { page-break-after: always; display: flex; flex-direction: column; height: 273mm; }
      .page:last-child { page-break-after: avoid; }
      .page-header { text-align: center; margin-bottom: 8px; flex-shrink: 0; }
      .main-title { font-size: 17pt; font-weight: bold; line-height: 1.5; }
      .sub-title { font-size: 16pt; font-weight: bold; line-height: 1.5; }
      .doc-meta { font-size: 14pt; font-weight: bold; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; flex-shrink: 0; }
      th, td { border: 1.5px solid #000; padding: 3px 6px; font-size: 13pt; height: 26px; }
      th { background: #f5f5f5; font-weight: bold; text-align: center; }
      .col-no { width: 10%; text-align: center; }
      .col-name { width: 30%; }
      .col-pos { width: 30%; text-align: center; }
      .col-date { width: 30%; text-align: center; }
      .center { text-align: center; }
      .page-footer { display: flex; align-items: center; font-size: 10.5pt; color: #555; margin-top: auto; padding-top: 4px; border-top: 1px solid #bbb; }
      .footer-spacer { flex: 1; }
      .footer-center { flex: 0 1 auto; text-align: center; }
      .footer-right { flex: 1; text-align: right; white-space: nowrap; }
    </style></head><body>${pagesHtml}</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    if (!win) { URL.revokeObjectURL(blobUrl); return }
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
  }

  const isPdf = mime?.includes('pdf')
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ height: 56, background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'monospace' }}>{doc.document_code} · Rev.{doc.revision}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {canViewLog && (
            <button
              onClick={loadLogs}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit' }}
            >
              <Icon name="users" size={13} /> ผู้อ่าน
            </button>
          )}
          {url && (
            <button onClick={downloadCurrentFile}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', textDecoration: 'none', fontFamily: 'inherit' }}
            >
              <Icon name="download" size={13} /> ดาวน์โหลด
            </button>
          )}
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* Document viewer */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#525659' }}>
          {loading ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>กำลังโหลดเอกสาร...</span>
            </div>
          ) : errMsg ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <Icon name="alert" size={40} style={{ color: 'rgba(255,255,255,.5)' }} />
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,.7)' }}>{errMsg}</span>
            </div>
          ) : isPdf && !isIOS ? (
            <iframe
              src={url!}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={doc.title}
            />
          ) : isPdf && isIOS ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', maxWidth: 380 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(30,95,173,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Icon name="doc" size={28} style={{ color: 'var(--primary)' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{doc.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>แตะปุ่มด้านล่างเพื่อเปิด PDF ใน Safari</div>
                <button onClick={() => window.open(url!, '_blank')} style={{ background: 'none', border: 0, padding: 0 }}>
                  <Button variant="primary" icon="eye">เปิด PDF</Button>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', maxWidth: 380 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Icon name="doc" size={28} style={{ color: TYPE_ICON_FG[doc.type] ?? 'var(--muted)' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{doc.file_name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>ไม่สามารถแสดงตัวอย่างได้ กรุณาดาวน์โหลดเพื่อเปิด</div>
                <button onClick={downloadCurrentFile} style={{ background: 'none', border: 0, padding: 0 }}>
                  <Button variant="primary" icon="download">ดาวน์โหลดไฟล์</Button>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Read log panel */}
        {showLog && (
          <div style={{ width: 300, background: 'var(--card)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>ผู้ที่อ่านเอกสาร</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {logs.length > 0 && (
                    <button onClick={downloadReadLog} title="ดาวน์โหลด PDF" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <Icon name="download" size={14} />
                    </button>
                  )}
                  {userRole === 'Admin' && (
                    <button onClick={() => setResetConfirm((v) => !v)} title="Reset read log" style={{ background: 'none', border: 'none', cursor: 'pointer', color: resetConfirm ? 'var(--danger)' : 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}>
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                  <button onClick={() => setShowLog(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}><Icon name="x" size={14} /></button>
                </div>
              </div>
              {resetConfirm && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 8, background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)' }}>
                  <div style={{ fontSize: 11.5, color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>ลบ Read log ทั้งหมด?</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={resetting} onClick={() => handleReset('single')}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid rgba(220,38,38,.4)', background: 'transparent', cursor: resetting ? 'not-allowed' : 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--danger)', fontFamily: 'inherit', opacity: resetting ? .5 : 1 }}>
                      เอกสารนี้
                    </button>
                    <button disabled={resetting} onClick={() => handleReset('all')}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', background: 'var(--danger)', cursor: resetting ? 'not-allowed' : 'pointer', fontSize: 11.5, fontWeight: 600, color: '#fff', fontFamily: 'inherit', opacity: resetting ? .5 : 1 }}>
                      ทุกเอกสาร
                    </button>
                    <button onClick={() => setResetConfirm(false)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 11.5, color: 'var(--muted)', fontFamily: 'inherit' }}>
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีผู้อ่าน</div>
              ) : (() => {
                const seen = new Map<string, ReadLog>()
                for (const log of logs) {
                  const uid = log.user_id
                  if (!seen.has(uid) || new Date(log.created_at) > new Date(seen.get(uid)!.created_at)) {
                    seen.set(uid, log)
                  }
                }
                const unique = Array.from(seen.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {unique.map((log) => (
                      <div key={log.user_id} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2)' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{log.profiles?.name ?? 'ไม่ทราบชื่อ'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{log.profiles?.role}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                          {new Date(log.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────
const DOC_ROLE_COLOR: Record<string, { bg: string; color: string; dot: string }> = {
  'Laboratory Director': { bg: 'rgba(30,95,173,.09)',  color: '#1E5FAD', dot: '#1E5FAD' },
  'Quality Manager':     { bg: 'rgba(13,148,136,.09)', color: '#0D9488', dot: '#0D9488' },
  'Document Controller': { bg: 'rgba(147,51,234,.09)', color: '#9333EA', dot: '#9333EA' },
  'Reviewer':            { bg: 'rgba(217,119,6,.09)',  color: '#B45309', dot: '#D97706' },
  'Viewer':              { bg: 'rgba(100,116,139,.09)',color: '#64748B', dot: '#94A3B8' },
}

interface Props { userRole?: string; docRole?: string; userName?: string; userId?: string }

export function DocumentsClient({ userRole, docRole, userName, userId = '' }: Props) {
  const isAdmin = userRole === 'Admin'
  const workflowRole = docRole ?? userRole
  const canUpload = isAdmin
    ? true
    : ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(workflowRole ?? '')
  const canDelete = isAdmin
    ? true
    : ['Laboratory Director', 'Document Controller'].includes(workflowRole ?? '')
  const canRead   = true
  const canViewSourceUploadQueue = userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller'

  const { toasts, add: toast } = useToast()

  const [docs, setDocs]       = useState<Document[]>([])
  const [count, setCount]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeType, setActiveType]     = useState<string>(DEFAULT_TYPE_FILTER)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [visibility, setVisibility]     = useState<string>('')
  const [department, setDepartment]     = useState<string>('')
  const [sourceUploadedOnly, setSourceUploadedOnly] = useState(false)
  const [page, setPage]             = useState(1)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')

  const [modalOpen, setModalOpen] = useState(false)
  const [editDoc, setEditDoc]     = useState<Document | null>(null)

  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const [deletedCount, setDeletedCount] = useState(0)
  const [purging, setPurging]           = useState(false)

  const [statusDoc, setStatusDoc]   = useState<Document | null>(null)
  const [revDoc, setRevDoc]         = useState<Document | null>(null)
  const [readDoc, setReadDoc]       = useState<Document | null>(null)
  const [detailDoc, setDetailDoc]   = useState<Document | null>(null)

  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set())

  // Debounce search input: immediate clear, 350ms delay when typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [search])

  // Fetch read doc IDs for current user on mount
  useEffect(() => {
    fetch('/api/admin/documents/my-reads')
      .then((r) => r.json())
      .then((ids: string[]) => { if (Array.isArray(ids)) setReadDocIds(new Set(ids)) })
      .catch(() => {})
  }, [])

  // Fetch type distribution + deleted count once on mount
  useEffect(() => {
    fetch('/api/admin/documents?pageSize=1000')
      .then((r) => r.json())
      .then((j) => {
        const counts: Record<string, number> = { All: j.count ?? 0 }
        for (const doc of (j.data ?? []) as Document[]) {
          counts[doc.type] = (counts[doc.type] ?? 0) + 1
        }
        setTypeCounts(counts)
      })
      .catch(() => {})
    if (canDelete) {
      fetch('/api/admin/documents/purge-deleted')
        .then((r) => r.json())
        .then((d) => setDeletedCount(d.count ?? 0))
        .catch(() => {})
    }
  }, [canDelete])

  // ── Fetch ────────────────────────────────────────────────────
  const fetchDocs = useCallback(async (opts?: { resetPage?: boolean }) => {
    setLoading(true)
    setError('')
    const p = opts?.resetPage ? 1 : page
    if (opts?.resetPage) setPage(1)

    const sp = new URLSearchParams()
    if (activeType && activeType !== 'All') sp.set('type', activeType)
    if (docRole === 'Viewer') sp.set('status', 'Published')
    else if (filterStatus) sp.set('status', filterStatus)
    if (visibility)   sp.set('visibility', visibility)
    if (department)   sp.set('department', department)
    if (canViewSourceUploadQueue && sourceUploadedOnly) sp.set('sourceUploaded', '1')
    if (debouncedSearch) sp.set('search', debouncedSearch)
    sp.set('page', String(p))
    sp.set('pageSize', String(PAGE_SIZE))
    sp.set('sortBy', 'document_code')
    sp.set('sortDir', sortDir)

    try {
      const res = await fetch(`/api/admin/documents?${sp}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'เกิดข้อผิดพลาด'); return }
      setDocs(json.data ?? [])
      setCount(json.count ?? 0)
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }, [activeType, filterStatus, visibility, department, sourceUploadedOnly, canViewSourceUploadQueue, debouncedSearch, page, sortDir])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  function handleSearchChange(val: string) {
    setSearch(val)
    setPage(1)
  }

  // ── Purge deleted ────────────────────────────────────────────
  async function handlePurge() {
    if (!confirm(`ยืนยันการลบถาวร ${deletedCount} เอกสารที่ถูกลบออกจากฐานข้อมูล? การกระทำนี้ไม่สามารถกู้คืนได้`)) return
    setPurging(true)
    const res = await fetch('/api/admin/documents/purge-deleted', { method: 'DELETE' })
    const data = await res.json()
    setPurging(false)
    if (res.ok) {
      setDeletedCount(0)
      toast(`ลบถาวรแล้ว ${data.purged} เอกสาร`)
    } else {
      toast(data.error ?? 'เกิดข้อผิดพลาด', false)
    }
  }

  // ── Download ─────────────────────────────────────────────────
  async function handleDownload(path: string | null | undefined) {
    if (!path) {
      toast('เอกสารนี้ยังไม่มีไฟล์ทางการ', false)
      return
    }
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      window.open(json.url, '_blank')
      toast('เปิดไฟล์แล้ว')
    } catch {
      toast('ดาวน์โหลดไม่สำเร็จ', false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDoc) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/documents/${confirmDoc.id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json(); toast(j.error ?? 'ลบไม่สำเร็จ', false); return }
      setDocs((d) => d.filter((x) => x.id !== confirmDoc.id))
      setCount((c) => c - 1)
      setTypeCounts((c) => ({
        ...c,
        All: Math.max(0, (c.All ?? 0) - 1),
        [confirmDoc.type]: Math.max(0, (c[confirmDoc.type] ?? 0) - 1),
      }))
      setDeletedCount((n) => n + 1)
      toast('ลบเอกสารแล้ว')
      setConfirmDoc(null)
    } catch {
      toast('เกิดข้อผิดพลาด', false)
    } finally {
      setDeleting(false)
    }
  }

  // ── Save callback ────────────────────────────────────────────
  function handleSaved(saved: Document) {
    if (editDoc) {
      setDocs((d) => d.map((x) => x.id === saved.id ? saved : x))
      if (editDoc.type !== saved.type) {
        setTypeCounts((c) => ({
          ...c,
          [editDoc.type]: Math.max(0, (c[editDoc.type] ?? 0) - 1),
          [saved.type]: (c[saved.type] ?? 0) + 1,
        }))
      }
      toast('บันทึกการแก้ไขแล้ว')
    } else {
      setDocs((d) => [saved, ...d])
      setCount((c) => c + 1)
      setTypeCounts((c) => ({
        ...c,
        All: (c.All ?? 0) + 1,
        [saved.type]: (c[saved.type] ?? 0) + 1,
      }))
      toast('Upload เอกสารแล้ว')
    }
    setModalOpen(false)
    setEditDoc(null)
  }

  async function handleDuplicateOpen(documentId: string) {
    const existing = docs.find((doc) => doc.id === documentId)
    if (existing) {
      setModalOpen(false)
      setEditDoc(null)
      setDetailDoc(existing)
      return
    }

    try {
      const res = await fetch(`/api/admin/documents/${documentId}`)
      const json = await res.json()
      if (!res.ok) {
        toast(json.error ?? 'เปิดเอกสารเดิมไม่สำเร็จ', false)
        return
      }
      setModalOpen(false)
      setEditDoc(null)
      setDetailDoc(json as Document)
    } catch {
      toast('เปิดเอกสารเดิมไม่สำเร็จ', false)
    }
  }

  async function handleCreateRevisionDraft(doc: Document) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revision-drafts`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'สร้าง Revision draft ไม่สำเร็จ')
      toast(`สร้าง working revision Rev. ${json.revision} แล้ว`)
      setRevDoc(doc)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'สร้าง Revision draft ไม่สำเร็จ', false)
    }
  }

  // ── Status saved callback ────────────────────────────────────
  function handleStatusSaved(updated: Document) {
    setDocs((d) => d.map((x) => x.id === updated.id ? updated : x))
    setStatusDoc(null)
  }

  function handleRevisionPromoted(updated: Document) {
    setDocs((d) => d.map((x) => x.id === updated.id ? updated : x))
    setRevDoc(updated)
    toast(`เลื่อน Rev. ${updated.revision} ขึ้นมาเป็นเวอร์ชันล่าสุดแล้ว`)
  }

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const hasFilters = !!(search || filterStatus || visibility || department || sourceUploadedOnly || activeType !== DEFAULT_TYPE_FILTER)
  const typeEntries = (Object.entries(typeCounts) as [string, number][])
    .filter(([k, v]) => k !== 'All' && v > 0).slice(0, 5)

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: t.ok ? '#166534' : '#B91C1C', color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          }}>
            {t.ok ? '✓ ' : '✕ '}{t.msg}
          </div>
        ))}
      </div>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
            Documents Control
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>
            ระบบจัดการเอกสารคุณภาพ
          </h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{typeCounts.All ?? '—'}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>เอกสารทั้งหมด</span>
            </div>
            {typeEntries.length > 0 && <div style={{ width: 1, height: 20, background: 'var(--border)' }} />}
            {typeEntries.map(([type, n]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_ICON_FG[type] ?? 'var(--muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>
                  {type} <strong style={{ color: 'var(--ink)' }}>{n}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* User identity badge */}
          {(userName || docRole) && (() => {
            const scheme = docRole ? DOC_ROLE_COLOR[docRole] : undefined
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 12px', borderRadius: 10,
                background: scheme?.bg ?? 'var(--surface-2)',
                border: `1px solid ${scheme ? scheme.color + '33' : 'var(--border)'}`,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: scheme?.dot ?? 'var(--muted)',
                  boxShadow: scheme ? `0 0 0 2px ${scheme.dot}33` : 'none',
                }} />
                <div>
                  {userName && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                      {userName}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: scheme?.color ?? 'var(--muted)', fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                    {docRole ?? userRole ?? 'Staff'}
                  </div>
                </div>
              </div>
            )
          })()}
          {canDelete && deletedCount > 0 && (
            <button
              onClick={handlePurge}
              disabled={purging}
              style={{
                fontSize: 12, padding: '6px 12px', borderRadius: 7,
                border: '1px solid #FECACA', background: 'transparent',
                color: '#B91C1C', cursor: purging ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', fontWeight: 500, opacity: purging ? 0.6 : 1,
              }}
            >
              {purging ? 'กำลังลบ...' : `ล้างรายการที่ถูกลบ (${deletedCount})`}
            </button>
          )}
          {canUpload && (
            <Button variant="primary" icon="upload" onClick={() => { setEditDoc(null); setModalOpen(true) }}>
              สร้าง Draft เอกสาร
            </Button>
          )}
        </div>
      </div>

      {/* ── Filter toolbar ─────────────────────────────────────────── */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        {/* Row 1: search + dropdowns + clear */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <div style={{ flex: '0 0 260px' }}>
            <Input icon="search" placeholder="ค้นหาชื่อหรือรหัสเอกสาร..." value={search} onChange={handleSearchChange} />
          </div>
          <div style={{ flex: '0 0 200px', position: 'relative' }}>
            <select
              value={department}
              onChange={(e) => { setDepartment(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '8px 32px 8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: department ? 'var(--ink)' : 'var(--muted)', background: 'var(--card)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
            >
              <option value="">ทุกแผนก</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 11 }}>▾</span>
          </div>
          <div style={{ flex: '0 0 150px', position: 'relative' }}>
            <select
              value={activeType}
              onChange={(e) => { setActiveType(e.target.value); setPage(1) }}
              style={{ width: '100%', padding: '8px 32px 8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit', color: activeType !== 'All' ? 'var(--ink)' : 'var(--muted)', background: 'var(--card)', outline: 'none', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}
            >
              <option value="All">ทุกประเภท</option>
              {TYPE_TABS.filter(t => t !== 'All').map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)', fontSize: 11 }}>▾</span>
          </div>
          {(search || department || activeType !== DEFAULT_TYPE_FILTER || filterStatus || visibility || sourceUploadedOnly) && (
            <button
              onClick={() => { setSearch(''); setDepartment(''); setFilterStatus(''); setActiveType(DEFAULT_TYPE_FILTER); setVisibility(''); setSourceUploadedOnly(false); setPage(1) }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              ล้าง
            </button>
          )}
        </div>
        {/* Row 2: Status pills + visibility pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {docRole !== 'Viewer' && ([
            ['', 'All'],
            ['Draft',     '#64748B'],
            ['Review',    '#D97706'],
            ['Approved',  '#1E5FAD'],
            ['Published', '#16A34A'],
            ['Obsolete',  '#9CA3AF'],
          ] as [string, string][]).map(([s, color]) => {
            const active = filterStatus === s
            const isAll = s === ''
            return (
              <button
                key={s || 'all'}
                onClick={() => { setFilterStatus(s); setPage(1) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 11px', borderRadius: 20, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 700 : 500,
                  transition: 'all .15s',
                  border: active ? `1px solid ${isAll ? 'var(--border)' : color}` : '1px solid var(--border)',
                  background: active ? (isAll ? 'var(--surface-2)' : color) : 'transparent',
                  color: active ? (isAll ? 'var(--ink)' : '#fff') : 'var(--ink)',
                }}
              >
                {!isAll && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: active ? 'rgba(255,255,255,0.8)' : color,
                    transition: 'background .15s',
                  }} />
                )}
                {isAll ? 'All' : s}
              </button>
            )
          })}
          {/* Visibility pills — pushed to the right */}
          {canViewSourceUploadQueue && (
            <button
              onClick={() => { setSourceUploadedOnly((v) => !v); setPage(1) }}
              title="กรองเอกสารที่มี Working Rev. และมีการอัปโหลด Word/Excel แล้ว"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 11px', borderRadius: 20, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: sourceUploadedOnly ? 700 : 500,
                transition: 'all .15s',
                border: sourceUploadedOnly ? '1px solid #9333EA' : '1px solid var(--border)',
                background: sourceUploadedOnly ? '#9333EA' : 'transparent',
                color: sourceUploadedOnly ? '#fff' : 'var(--ink)',
              }}
            >
              <Icon name="upload" size={12} />
              มี Word/Excel รอ DCC
            </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {([['', 'ทั้งหมด'], ['Public', 'เผยแพร่'], ['Internal', 'ภายใน']] as const).map(([v, label]) => {
              const active = visibility === v
              return (
                <button key={v} onClick={() => { setVisibility(v); setPage(1) }} style={{ padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, transition: 'all .15s', border: '1px solid var(--border)', background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--ink)' }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* ── Table ─────────────────────────────────────────────────── */}
      {error ? (
        <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(220,38,38,.08)', color: '#B91C1C', fontSize: 13 }}>{error}</div>
      ) : (
        <Card padding={0}>
          <StickyScroll>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
                  <th style={{ padding: '11px 16px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    <button onClick={() => { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); setPage(1) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.07em', textTransform: 'uppercase', padding: 0 }}>
                      เอกสาร <span style={{ fontSize: 10, opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    </button>
                  </th>
                  {['TYPE', 'Status', 'REVISION', 'เผยแพร่', 'ผู้จัดทำ', 'แก้ไขล่าสุด', 'ขนาด', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 16px', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: i < 7 ? 'center' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} style={{ padding: '14px 16px' }}>
                          <div style={{ height: 13, borderRadius: 4, background: 'var(--surface-2)', width: j === 0 ? 220 : 80 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : docs.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 56 }}>
                    <EmptyState icon="doc" title="ไม่มีเอกสาร" hint={hasFilters ? 'ลองเปลี่ยนตัวกรองหรือล้างคำค้นหา' : 'กดปุ่มสร้าง Draft เอกสารเพื่อเริ่มต้น'} />
                  </td></tr>
                ) : (
                  docs.map((doc) => {
                    const docStatus = (doc.status ?? 'Draft') as DocStatus
                    const canChangeStatus = allowedTransitions(docStatus, userRole ?? '', docRole).length > 0
                    return (
                      <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background .12s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* 1. Name + Code — click to open detail */}
                        <td style={{ padding: '13px 16px', minWidth: 240, cursor: 'pointer' }} onClick={() => setDetailDoc(doc)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="doc" size={16} style={{ color: TYPE_ICON_FG[doc.type] ?? 'var(--muted)' }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--primary)', lineHeight: 1.35, fontSize: 13, textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color .12s' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = 'var(--primary)' }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecorationColor = 'transparent' }}>
                                {doc.title}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'monospace', marginTop: 2, fontWeight: 600 }}>{doc.document_code}</div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Type */}
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <Badge color={TYPE_COLORS[doc.type] ?? 'gray'} size="sm">{doc.type}</Badge>
                        </td>

                        {/* 3. Status — clickable to change */}
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <button
                            onClick={() => canChangeStatus ? setStatusDoc(doc) : undefined}
                            title={canChangeStatus ? 'คลิกเพื่อเปลี่ยนสถานะ' : STATUS_LABEL[docStatus]}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: canChangeStatus ? 'pointer' : 'default' }}
                          >
                            <Badge color={STATUS_COLOR[docStatus]} size="sm">{STATUS_LABEL[docStatus]}</Badge>
                          </button>
                        </td>

                        {/* 4. Revision */}
                        <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>
                          Rev.&nbsp;{doc.revision}
                        </td>

                        {/* 5. Visibility */}
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <Badge color={doc.visibility === 'Public' ? 'green' : 'amber'} size="sm" dot>
                            {doc.visibility === 'Public' ? 'เผยแพร่' : 'ภายใน'}
                          </Badge>
                        </td>

                        {/* 6. Owner */}
                        <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 140, textAlign: 'center' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.owner_name ?? '—'}</div>
                        </td>

                        {/* 7. Updated */}
                        <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{fmtDate(doc.updated_at)}</td>

                        {/* 8. Size */}
                        <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{fmtSize(doc.file_size)}</td>

                        {/* 9. Actions */}
                        <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {/* Read */}
                            {canRead && (() => {
                              const hasRead = readDocIds.has(doc.id)
                              return (
                                <button
                                  disabled={!doc.file_url}
                                  onClick={() => doc.file_url ? setReadDoc(doc) : toast('เอกสารนี้ยังไม่มีไฟล์ทางการ', false)}
                                  title={doc.file_url ? 'อ่านเอกสาร' : 'ยังไม่มีไฟล์ทางการ'}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 32, borderRadius: 7, border: `1px solid ${hasRead ? 'var(--success)' : 'var(--border)'}`, background: 'transparent', cursor: doc.file_url ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600, color: hasRead ? 'var(--success)' : 'var(--muted)', fontFamily: 'inherit', transition: 'all .12s', opacity: doc.file_url ? 1 : 0.45 }}
                                  onMouseEnter={(e) => { if (doc.file_url) { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.color = 'var(--success)' } }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = hasRead ? 'var(--success)' : 'var(--border)'; e.currentTarget.style.color = hasRead ? 'var(--success)' : 'var(--muted)' }}>
                                  <Icon name="eye" size={13} /> Read
                                </button>
                              )
                            })()}
                            {/* Download PDF */}
                            <button disabled={!doc.file_url} onClick={() => handleDownload(doc.file_url)} title={doc.file_url ? 'ดาวน์โหลดไฟล์ทางการ' : 'ยังไม่มีไฟล์ทางการ'}
                              style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: doc.file_url ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', opacity: doc.file_url ? 1 : 0.4 }}
                              onMouseEnter={(e) => { if (doc.file_url) { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.color = '#DC2626' } }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              P
                            </button>
                            {/* History */}
                            <button onClick={() => setRevDoc(doc)} title="ประวัติการแก้ไข"
                              style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              <Icon name="clock" size={14} />
                            </button>
                            {canUpload && doc.status === 'Published' && (
                              <button onClick={() => handleCreateRevisionDraft(doc)} title="สร้าง Revision ใหม่"
                                style={{ width: 42, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                Rev+
                              </button>
                            )}
                            {/* Edit */}
                            {canUpload && (doc.status !== 'Published' || userRole === 'Admin' || docRole === 'Document Controller') && (
                              <button onClick={() => { setEditDoc(doc); setModalOpen(true) }} title="แก้ไข"
                                style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                <Icon name="edit" size={14} />
                              </button>
                            )}
                            {/* Delete */}
                            {canDelete && (
                              <button onClick={() => setConfirmDoc(doc)} title="ลบ"
                                style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.color = '#DC2626' }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                <Icon name="trash" size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </StickyScroll>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                แสดง {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} จาก {count} รายการ
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: 'var(--muted)', opacity: page <= 1 ? .4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="arrowLeft" size={13} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ width: 30, height: 30, borderRadius: 6, border: p === page ? 'none' : '1px solid var(--border)', background: p === page ? 'var(--primary)' : 'transparent', color: p === page ? '#fff' : 'var(--ink)', cursor: 'pointer', fontSize: 12, fontWeight: p === page ? 700 : 400, fontFamily: 'inherit' }}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: 'var(--muted)', opacity: page >= totalPages ? .4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="arrowRight" size={13} />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Document Detail Modal */}
      {detailDoc && (
        <DocDetailModal
          doc={detailDoc}
          hasRead={readDocIds.has(detailDoc.id)}
          canUpload={canUpload}
          userRole={userRole ?? ''}
          docRole={docRole ?? null}
          userId={userId}
          onClose={() => setDetailDoc(null)}
          onRead={() => { setDetailDoc(null); setReadDoc(detailDoc) }}
          onHistory={() => { setDetailDoc(null); setRevDoc(detailDoc) }}
          onEdit={() => { setDetailDoc(null); setEditDoc(detailDoc); setModalOpen(true) }}
          onDownload={handleDownload}
        />
      )}

      {/* Read Modal */}
      {readDoc && (
        <ReadModal
          doc={readDoc}
          userRole={userRole ?? ''}
          canViewLog={canUpload}
          onClose={() => setReadDoc(null)}
          onResetReadIds={(docId) => {
            if (docId === null) setReadDocIds(new Set())
            else setReadDocIds((prev) => { const next = new Set(prev); next.delete(docId); return next })
          }}
          onReadLogged={(docId) => setReadDocIds((prev) => new Set(prev).add(docId))}
        />
      )}

      {/* Upload / Edit Modal */}
      {modalOpen && (
        <DocumentUploadModal
          doc={editDoc}
          userRole={userRole}
          docRole={docRole}
          onClose={() => { setModalOpen(false); setEditDoc(null) }}
          onSaved={handleSaved}
          onDuplicateOpen={handleDuplicateOpen}
        />
      )}

      {/* Status Change Modal */}
      {statusDoc && (
        <StatusModal
          doc={statusDoc}
          userRole={userRole ?? ''}
          docRole={docRole}
          onClose={() => setStatusDoc(null)}
          onSaved={handleStatusSaved}
          toast={toast}
        />
      )}

      {/* Revision History Panel */}
      {revDoc && (
        <RevisionPanel
          doc={revDoc}
          onClose={() => setRevDoc(null)}
          onDownload={handleDownload}
          onPromoted={handleRevisionPromoted}
          userRole={userRole ?? ''}
          docRole={docRole}
          canAdd={canUpload}
        />
      )}

      {/* Delete Confirm */}
      {confirmDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Card padding={28} style={{ maxWidth: 400, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(220,38,38,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="trash" size={18} style={{ color: '#DC2626' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ยืนยันการลบเอกสาร</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.65, paddingLeft: 52 }}>
              ต้องการลบ <strong style={{ color: 'var(--ink)' }}>{confirmDoc.title}</strong><br />
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)' }}>{confirmDoc.document_code}</span><br /><br />
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDoc(null)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}>ยกเลิก</button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'กำลังลบ...' : 'ลบเอกสาร'}</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
