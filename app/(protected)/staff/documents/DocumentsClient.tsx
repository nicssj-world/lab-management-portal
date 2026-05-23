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
import type { DocStatus } from '@/lib/documents/transitions'
import type { Document } from '@/lib/supabase/types'

// ── Constants ─────────────────────────────────────────────────
const TYPE_TABS = ['All', 'QP', 'WI', 'Form', 'Policy', 'Manual', 'Record', 'Others'] as const

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

const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', Record: 'gray', Others: 'gray',
}
const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)',
  Record: 'rgba(100,116,139,.10)', Others: 'rgba(100,116,139,.10)',
}
const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', Record: '#64748B', Others: '#64748B',
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

// ── Revision type ─────────────────────────────────────────────
interface RevisionRow {
  id: string
  revision_number: string
  revision_note: string | null
  revised_by: string | null
  approved_by: string | null
  file_url: string
  file_name: string
  created_at: string
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
              <button
                key={next}
                disabled={saving}
                onClick={() => handleChange(next)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 16px', borderRadius: 10, border: '1px solid var(--border)',
                  background: 'var(--card)', cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all .12s', opacity: saving ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { if (!saving) e.currentTarget.style.borderColor = 'var(--primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{STATUS_LABEL[next]}</span>
                <Badge color={STATUS_COLOR[next]} size="sm">{next}</Badge>
              </button>
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

// ── Revision History Panel ─────────────────────────────────────
function RevisionPanel({ doc, onClose, onDownload, onPromoted, userRole, canAdd }: {
  doc: Document
  onClose: () => void
  onDownload: (path: string) => void
  onPromoted: (updated: Document) => void
  userRole: string
  canAdd: boolean
}) {

  const [revisions, setRevisions] = useState<RevisionRow[]>([])
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
    if (!editRev.trim()) { setEditError('กรุณากรอกหมายเลข Revision'); return }
    setEditSaving(true); setEditError('')
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/revisions/${revId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision_number: editRev.trim(),
          revision_note:   editNote.trim() || null,
          revised_by:      editRevisedBy.trim() || null,
          approved_by:     editApprover.trim() || null,
          revision_date:   editDate || undefined,
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
      Form: 'แบบฟอร์ม (Form)', Policy: 'นโยบาย (Policy)', Record: 'บันทึกคุณภาพ (Record)', Others: 'เอกสารอื่นๆ',
    }
    const fmtD = (s: string) =>
      s ? new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

    const ROWS_PER_PAGE = 14
    const sorted = [...revisions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
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

  useEffect(() => { loadRevisions() }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
              {revisions.length > 0 && (
                <button
                  onClick={downloadRevisionHistory}
                  title="ดาวน์โหลด PDF ประวัติการแก้ไข"
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                >
                  <Icon name="download" size={15} />
                </button>
              )}
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
                {canAdd && revisions.length > 0 && (
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
                  onClick={() => onDownload(doc.file_url)}
                  title="ดาวน์โหลด"
                  style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid rgba(30,95,173,.3)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
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

        {/* Revision history list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              เวอร์ชันก่อนหน้า ({revisions.length})
            </div>
            {canAdd && (
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
          {showForm && (
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
                      {formFile.name}
                    </span>
                  )}
                  <input ref={formFileRef} type="file" accept=".pdf,.docx,.xlsx" style={{ display: 'none' }}
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>Revision *</div>
                          <input value={editRev} onChange={e => setEditRev(e.target.value)}
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
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
                          <input value={editRevisedBy} onChange={e => setEditRevisedBy(e.target.value)} placeholder="ชื่อผู้แก้ไข"
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>ผู้อนุมัติ</div>
                          <input value={editApprover} onChange={e => setEditApprover(e.target.value)} placeholder="ชื่อผู้อนุมัติ"
                            style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 3 }}>บันทึกการแก้ไข</div>
                        <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="สรุปการเปลี่ยนแปลง"
                          style={{ width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box' }} />
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
                          {canAdd && (
                            <>
                              <button onClick={() => startEdit(rev)} title="แก้ไข"
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                <Icon name="edit" size={12} />
                              </button>
                              <button onClick={() => handleDeleteRevision(rev.id)} title="ลบ"
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                <Icon name="trash" size={12} />
                              </button>
                            </>
                          )}
                          {rev.file_url && (
                            <button onClick={() => onDownload(rev.file_url)} title="ดาวน์โหลด"
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
interface ReadLog { id: string; user_id: string; created_at: string; profiles: { name: string; role: string } | null }

function ReadModal({ doc, userRole, canViewLog, onClose, onResetReadIds }: {
  doc: Document
  userRole: string
  canViewLog: boolean
  onClose: () => void
  onResetReadIds: (docId: string | null) => void
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
    fetch(`/api/admin/documents/${doc.id}/read`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (d.url) { setUrl(d.url); setMime(d.mime_type ?? '') }
        else setErrMsg(d.error ?? 'ไม่สามารถเปิดได้')
      })
      .catch(() => setErrMsg('เกิดข้อผิดพลาด'))
      .finally(() => setLoading(false))
  }, [doc.id])

  function loadLogs() {
    if (!canViewLog) return
    setShowLog(true)
    fetch(`/api/admin/documents/${doc.id}/read`)
      .then((r) => r.json())
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .catch(() => {})
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
          ? `<tr><td class="center">${rowIdx++}</td><td>${log.profiles?.name ?? ''}</td><td class="center">${posLabel(log.profiles?.role)}</td><td class="center">${fmtDate(log.created_at)}</td></tr>`
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
            <a href={url} target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', textDecoration: 'none', fontFamily: 'inherit' }}
            >
              <Icon name="download" size={13} /> ดาวน์โหลด
            </a>
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
          ) : isPdf ? (
            <iframe
              src={url!}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title={doc.title}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'var(--card)', borderRadius: 16, padding: 36, textAlign: 'center', maxWidth: 380 }}>
                <div style={{ width: 64, height: 64, borderRadius: 16, background: TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Icon name="doc" size={28} style={{ color: TYPE_ICON_FG[doc.type] ?? 'var(--muted)' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{doc.file_name}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>ไม่สามารถแสดงตัวอย่างได้ กรุณาดาวน์โหลดเพื่อเปิด</div>
                <a href={url!} target="_blank" rel="noreferrer">
                  <Button variant="primary" icon="download">ดาวน์โหลดไฟล์</Button>
                </a>
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

interface Props { userRole?: string; docRole?: string; userName?: string }

export function DocumentsClient({ userRole, docRole, userName }: Props) {
  const isAdmin = userRole === 'Admin'
  const canUpload = isAdmin
    ? true
    : ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(docRole ?? '')
  const canDelete = isAdmin
    ? true
    : ['Laboratory Director', 'Document Controller'].includes(docRole ?? '')
  const canRead   = true

  const { toasts, add: toast } = useToast()

  const [docs, setDocs]       = useState<Document[]>([])
  const [count, setCount]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeType, setActiveType]     = useState<string>('All')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [visibility, setVisibility]     = useState<string>('')
  const [department, setDepartment]     = useState<string>('')
  const [page, setPage]             = useState(1)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')

  const [modalOpen, setModalOpen] = useState(false)
  const [editDoc, setEditDoc]     = useState<Document | null>(null)

  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const [deletedCount, setDeletedCount] = useState(0)
  const [purging, setPurging]           = useState(false)

  const [statusDoc, setStatusDoc] = useState<Document | null>(null)
  const [revDoc, setRevDoc]       = useState<Document | null>(null)
  const [readDoc, setReadDoc]     = useState<Document | null>(null)

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
    if (filterStatus) sp.set('status', filterStatus)
    if (visibility)   sp.set('visibility', visibility)
    if (department)   sp.set('department', department)
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
  }, [activeType, filterStatus, visibility, department, debouncedSearch, page, sortDir])

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
  async function handleDownload(path: string) {
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
  const hasFilters = !!(search || filterStatus || visibility || department || (activeType && activeType !== 'All'))
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
              Upload เอกสาร
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
          {(search || department || activeType !== 'All' || filterStatus || visibility) && (
            <button
              onClick={() => { setSearch(''); setDepartment(''); setFilterStatus(''); setActiveType('All'); setVisibility(''); setPage(1) }}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            >
              ล้าง
            </button>
          )}
        </div>
        {/* Row 2: Status pills + visibility pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {([
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
                    <EmptyState icon="doc" title="ไม่มีเอกสาร" hint={hasFilters ? 'ลองเปลี่ยนตัวกรองหรือล้างคำค้นหา' : 'กดปุ่ม Upload เอกสารเพื่อเริ่มต้น'} />
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
                        {/* 1. Name + Code */}
                        <td style={{ padding: '13px 16px', minWidth: 240 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: TYPE_ICON_BG[doc.type] ?? 'rgba(100,116,139,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="doc" size={16} style={{ color: TYPE_ICON_FG[doc.type] ?? 'var(--muted)' }} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35, fontSize: 13 }}>{doc.title}</div>
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
                                  onClick={() => { setReadDoc(doc); setReadDocIds((prev) => new Set(prev).add(doc.id)) }}
                                  title="อ่านเอกสาร"
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 32, borderRadius: 7, border: `1px solid ${hasRead ? 'var(--success)' : 'var(--border)'}`, background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: hasRead ? 'var(--success)' : 'var(--muted)', fontFamily: 'inherit', transition: 'all .12s' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.color = 'var(--success)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = hasRead ? 'var(--success)' : 'var(--border)'; e.currentTarget.style.color = hasRead ? 'var(--success)' : 'var(--muted)' }}>
                                  <Icon name="eye" size={13} /> Read
                                </button>
                              )
                            })()}
                            {/* Download */}
                            <button onClick={() => handleDownload(doc.file_url)} title="ดาวน์โหลด"
                              style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              <Icon name="download" size={14} />
                            </button>
                            {/* History */}
                            <button onClick={() => setRevDoc(doc)} title="ประวัติการแก้ไข"
                              style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                              <Icon name="clock" size={14} />
                            </button>
                            {/* Edit */}
                            {canUpload && (
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
        />
      )}

      {/* Upload / Edit Modal */}
      {modalOpen && (
        <DocumentUploadModal doc={editDoc} userRole={userRole} docRole={docRole} onClose={() => { setModalOpen(false); setEditDoc(null) }} onSaved={handleSaved} />
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
