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
import { DocumentSetUploadModal } from '@/components/documents/DocumentSetUploadModal'
import { DocumentDetailModal, PdfViewerModal, type Attachment } from '@/components/documents/DocumentDetailModal'
import { PdfViewer } from '@/components/documents/PdfViewer'
import { RevisionPanel } from '@/components/documents/RevisionPanel'
import { QuickUpdateModal } from '@/components/documents/QuickUpdateModal'
import { allowedTransitions } from '@/lib/documents/transitions'
import { canMoveToStatus } from '@/lib/documents/workflow'
import { isReviewTrackedType, reviewWindowState } from '@/lib/documents/review'
import { DOCUMENT_DEPARTMENTS } from '@/lib/documents/departments'
import { TYPE_ICON_BG, TYPE_ICON_FG, STATUS_LABEL, STATUS_COLOR, fmtSize, fmtDate } from '@/lib/documents/ui-constants'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import { buildReadLogSummaryHtml } from '@/lib/documents/read-log-summary'
import type { DocStatus } from '@/lib/documents/transitions'
import type { BulkDownloadKind } from '@/lib/documents/bulk-download'
import type { Document, DocumentRevisionDraft } from '@/lib/supabase/types'
import { TYPE_LABEL } from '@/lib/documents/type-labels'

// ── Constants ─────────────────────────────────────────────────
const TYPE_TABS = ['All', 'QM', 'QP', 'WI', 'Reference', 'Form', 'Card file', 'Lb', 'Manual', 'Policy', 'Others'] as const

const DEPARTMENTS = DOCUMENT_DEPARTMENTS

const TYPE_COLORS: Record<string, 'blue' | 'teal' | 'purple' | 'amber' | 'green' | 'gray' | 'red'> = {
  QP: 'blue', WI: 'teal', Form: 'purple', Policy: 'amber', Manual: 'green', QM: 'green', Reference: 'red', 'Card file': 'amber', Lb: 'purple', Others: 'gray',
}

const ALL_STATUSES: DocStatus[] = ['Draft', 'Review', 'Approved', 'Published', 'Obsolete']

const BULK_KIND_LABEL: Record<BulkDownloadKind, string> = {
  pdf: 'PDF',
  source: 'Word/Excel',
  both: 'PDF + Word/Excel',
}

interface StatusHistoryRow {
  to_status: string
  changed_at: string
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
  const [forcePdfJs, setForcePdfJs] = useState(false)
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
        if (d.url) { setUrl(d.url); setMime(d.mime_type ?? ''); setForcePdfJs(d.preview_uncontrolled === true); onReadLogged(doc.id) }
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
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(doc.file_url)}&variant=download`)
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
    const html = buildReadLogSummaryHtml(
      { title: doc.title, document_code: doc.document_code, type: doc.type },
      logs.map((log) => ({
        userId: log.user_id,
        name: log.profiles?.name ?? '',
        position: log.profiles?.document_position ?? null,
        role: log.profiles?.role ?? null,
        lastRead: log.created_at,
      })),
    )

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const win = window.open(blobUrl, '_blank')
    if (!win) { URL.revokeObjectURL(blobUrl); return }
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(blobUrl) }, { once: true })
  }

  const isPdf = mime?.includes('pdf') || /\.pdf$/i.test(doc.file_name ?? doc.file_url ?? '')

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
          ) : isPdf && url ? (
            <PdfViewer url={url} pdfJsUrl={documentPdfProxyUrl(doc.file_url)} fileName={doc.file_name ?? doc.title} mimeType={mime} forcePdfJs={forcePdfJs} />
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

interface Props { userRole?: string; docRole?: string; userName?: string; userId?: string; initialSearch?: string; initialOpenId?: string; initialReadId?: string; initialCreate?: boolean }

export function DocumentsClient({ userRole, docRole, userName, userId = '', initialSearch, initialOpenId, initialReadId, initialCreate }: Props) {
  const isAdmin = userRole === 'Admin'
  const workflowRole = docRole ?? userRole
  const canUpload = isAdmin
    ? true
    : ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(workflowRole ?? '')
  const canDelete = isAdmin
    ? true
    : ['Laboratory Director', 'Document Controller'].includes(workflowRole ?? '')
  const canRead   = true
  // Admin/DCC can publish directly; other upload-capable roles (e.g. Reviewer) queue for approval.
  const canPublishQuick = isAdmin || userRole === 'Document Controller' || docRole === 'Document Controller'
  const canViewSourceUploadQueue = userRole === 'Admin' || userRole === 'Document Controller' || docRole === 'Document Controller'
  const canBulkDownload = isAdmin || userRole === 'Document Controller' || docRole === 'Document Controller' || docRole === 'Reviewer' || userRole === 'Reviewer'

  const { toasts, add: toast } = useToast()

  const [docs, setDocs]       = useState<Document[]>([])
  const [count, setCount]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [search, setSearch]               = useState(initialSearch ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch ?? '')
  const [activeType, setActiveType]     = useState<string>(DEFAULT_TYPE_FILTER)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [visibility, setVisibility]     = useState<string>('')
  const [department, setDepartment]     = useState<string>('')
  const [sourceUploadedOnly, setSourceUploadedOnly] = useState(false)
  const [page, setPage]             = useState(1)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [bulkKind, setBulkKind] = useState<BulkDownloadKind>('pdf')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkStep, setBulkStep] = useState('')
  const [bulkPercent, setBulkPercent] = useState<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editDoc, setEditDoc]     = useState<Document | null>(null)
  const [setUploadDoc, setSetUploadDoc] = useState<Document | null>(null)

  const [confirmDoc, setConfirmDoc] = useState<Document | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const [deletedCount, setDeletedCount] = useState(0)
  const [purging, setPurging]           = useState(false)

  const [statusDoc, setStatusDoc]   = useState<Document | null>(null)
  const [revDoc, setRevDoc]         = useState<Document | null>(null)
  const [quickDoc, setQuickDoc]     = useState<Document | null>(null)
  const [readDoc, setReadDoc]       = useState<Document | null>(null)
  const [detailDoc, setDetailDoc]   = useState<Document | null>(null)

  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set())
  const [docsWithActiveDraft, setDocsWithActiveDraft] = useState<Set<string>>(new Set())

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

  // Deep-link: open the detail modal or read viewer directly (e.g. from the categories/pending pages)
  useEffect(() => {
    if (initialOpenId) {
      fetch(`/api/admin/documents/${initialOpenId}`)
        .then((r) => r.json())
        .then((d) => { if (d?.id) setDetailDoc(d as Document) })
        .catch(() => {})
    }
    if (initialReadId) {
      fetch(`/api/admin/documents/${initialReadId}`)
        .then((r) => r.json())
        .then((d) => { if (d?.id) setReadDoc(d as Document) })
        .catch(() => {})
    }
    if (initialCreate && canUpload) {
      setEditDoc(null)
      setModalOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Fetch IDs of documents with an active (in-progress) revision draft.
  // Re-runs on list reload (docs) and when the revision panel opens/closes (revDoc),
  // covering Rev+ create, publish, and cancel transitions.
  useEffect(() => {
    fetch('/api/admin/documents/with-active-drafts')
      .then((r) => r.json())
      .then((ids: string[]) => { if (Array.isArray(ids)) setDocsWithActiveDraft(new Set(ids)) })
      .catch(() => {})
  }, [docs, revDoc])

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
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}&variant=download`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      window.open(json.url, '_blank')
      toast('เปิดไฟล์แล้ว')
    } catch {
      toast('ดาวน์โหลดไม่สำเร็จ', false)
    }
  }

  function filenameFromDisposition(header: string | null) {
    if (!header) return 'documents-export.zip'
    const encoded = header.match(/filename\*=UTF-8''([^;]+)/)
    if (encoded?.[1]) return decodeURIComponent(encoded[1])
    const plain = header.match(/filename="([^"]+)"/)
    return plain?.[1] ?? 'documents-export.zip'
  }

  async function handleBulkDownload() {
    if (bulkBusy) return
    setBulkBusy(true)
    setBulkPercent(null)
    setBulkStep('กำลังค้นหาเอกสาร Published ตาม filter...')

    try {
      setBulkStep('กำลังดึงไฟล์จากคลัง...')
      const res = await fetch('/api/admin/documents/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: bulkKind,
          type: activeType,
          department,
          search,
          visibility,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({} as { error?: string }))
        throw new Error(json.error ?? 'สร้าง ZIP ไม่สำเร็จ')
      }

      setBulkStep('กำลังสร้าง ZIP...')
      const total = Number(res.headers.get('Content-Length') ?? 0)
      const reader = res.body?.getReader()
      const chunks: ArrayBuffer[] = []
      let received = 0

      setBulkStep('กำลังดาวน์โหลด...')
      setBulkPercent(total > 0 ? 0 : null)
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue
          chunks.push(value.slice().buffer as ArrayBuffer)
          received += value.byteLength
          if (total > 0) setBulkPercent(Math.min(100, Math.round((received / total) * 100)))
        }
      } else {
        const blob = await res.blob()
        chunks.push(await blob.arrayBuffer())
        received = blob.size
        if (total > 0) setBulkPercent(100)
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

      setBulkPercent(100)
      setBulkStep('เสร็จสิ้น')
      const exported = res.headers.get('X-Exported-Files') ?? '0'
      const skipped = res.headers.get('X-Skipped-Files') ?? '0'
      toast(`ดาวน์โหลด ZIP แล้ว (${exported} ไฟล์, ข้าม ${skipped})`)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'ดาวน์โหลด ZIP ไม่สำเร็จ', false)
      setBulkStep('เกิดข้อผิดพลาด')
    } finally {
      setTimeout(() => {
        setBulkBusy(false)
        setBulkStep('')
        setBulkPercent(null)
      }, 900)
    }
  }

  // ── Delete ───────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDoc) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/documents/${confirmDoc.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const text = await res.text()
        let message = text || 'ลบไม่สำเร็จ'
        try {
          const json = JSON.parse(text) as { error?: string }
          message = json.error ?? message
        } catch {}
        toast(message, false)
        return
      }
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
    const warnings = (saved as Document & { warnings?: unknown }).warnings
    const firstWarning = Array.isArray(warnings) && typeof warnings[0] === 'string' ? warnings[0] : null
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
    if (firstWarning) toast(firstWarning, false)
    setModalOpen(false)
    setEditDoc(null)
  }

  function handleSetUploadDone() {
    setSetUploadDoc(null)
    void fetchDocs()
    fetch('/api/admin/documents?pageSize=1000')
      .then((response) => {
        if (!response.ok) throw new Error('refresh failed')
        return response.json()
      })
      .then((json) => {
        const counts: Record<string, number> = { All: json.count ?? 0 }
        for (const document of (json.data ?? []) as Document[]) {
          counts[document.type] = (counts[document.type] ?? 0) + 1
        }
        setTypeCounts(counts)
      })
      .catch(() => toast('อัปเดตจำนวนเอกสารหลังลงทะเบียนชุดไม่สำเร็จ กรุณารีเฟรชหน้า', false))
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

  function handleQuickUpdateDone({ published }: { published: boolean }) {
    setQuickDoc(null)
    fetchDocs()
    toast(published ? 'อัปเดตและเผยแพร่เอกสารแล้ว' : 'ส่งเข้าคิว "รอเผยแพร่" ให้ DCC/Admin แล้ว')
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
          <div key={t.id} className="fade-in-up" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: t.ok ? '#166534' : '#B91C1C', color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          }}>
            <Icon name={t.ok ? 'check' : 'x'} size={14} />
            {t.msg}
          </div>
        ))}
      </div>

      {bulkBusy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
          <Card padding={22} style={{ width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Icon name="download" size={18} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>กำลังเตรียม ZIP</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{BULK_KIND_LABEL[bulkKind]} · เฉพาะ Published</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 10 }}>{bulkStep || 'กำลังเริ่มต้น...'}</div>
            <div style={{ height: 9, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ width: bulkPercent === null ? '38%' : `${bulkPercent}%`, height: '100%', borderRadius: 99, background: 'var(--primary)', transition: 'width .18s ease', animation: bulkPercent === null ? 'bulk-pulse 1.1s ease-in-out infinite alternate' : 'none' }} />
            </div>
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--muted)' }}>
              <span>ค้นหาไฟล์ · รวมไฟล์ · สร้าง ZIP · ดาวน์โหลด</span>
              <span>{bulkPercent === null ? '...' : `${bulkPercent}%`}</span>
            </div>
            <style>{`
              @keyframes bulk-pulse {
                from { transform: translateX(-18%); opacity: .55; }
                to { transform: translateX(170%); opacity: 1; }
              }
            `}</style>
          </Card>
        </div>
      )}

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
              {TYPE_TABS.filter(t => t !== 'All').map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
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
          {canBulkDownload && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                value={bulkKind}
                disabled={bulkBusy}
                onChange={(e) => setBulkKind(e.target.value as BulkDownloadKind)}
                aria-label="เลือกชนิดไฟล์สำหรับดาวน์โหลดตาม Filter"
                style={{ padding: '8px 30px 8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', cursor: bulkBusy ? 'not-allowed' : 'pointer' }}
              >
                <option value="pdf">{BULK_KIND_LABEL.pdf}</option>
                <option value="source">{BULK_KIND_LABEL.source}</option>
                <option value="both">{BULK_KIND_LABEL.both}</option>
              </select>
              <button
                disabled={bulkBusy}
                onClick={handleBulkDownload}
                title="ดาวน์โหลด ZIP เฉพาะเอกสาร Published ตาม filter ปัจจุบัน"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--primary)', background: bulkBusy ? 'var(--surface-2)' : 'var(--primary)', color: bulkBusy ? 'var(--muted)' : '#fff', cursor: bulkBusy ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >
                <Icon name="download" size={13} />
                {bulkBusy ? 'กำลังเตรียม...' : 'ดาวน์โหลดตาม Filter'}
              </button>
            </div>
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
                  docs.map((doc, docIdx) => {
                    const docStatus = (doc.status ?? 'Draft') as DocStatus
                    const canChangeStatus = allowedTransitions(docStatus, userRole ?? '', docRole).length > 0
                    const hasActiveDraft = docsWithActiveDraft.has(doc.id)
                    const reviewTracked = docStatus === 'Published' && isReviewTrackedType(doc.type)
                    const reviewPill = reviewTracked && doc.review_confirmed_at
                      ? { label: 'รออนุมัติทบทวน', color: '#1E5FAD', bg: 'rgba(30,95,173,.12)', title: `ยืนยันการทบทวนโดย ${doc.review_confirmed_by_name ?? ''} รอ DCC ดำเนินการ` }
                      : reviewTracked && reviewWindowState(doc) === 'overdue'
                        ? { label: 'เกินกำหนดทบทวน', color: '#DC2626', bg: 'rgba(220,38,38,.12)', title: 'เกินรอบทบทวนประจำปีแล้ว' }
                        : reviewTracked && reviewWindowState(doc) === 'due-soon'
                          ? { label: 'ต้องทบทวน', color: '#D97706', bg: 'rgba(217,119,6,.12)', title: 'ใกล้ครบรอบทบทวนประจำปี (ภายใน 90 วัน)' }
                          : null
                    return (
                      <tr key={doc.id} className="fade-in" style={{ borderBottom: '1px solid var(--border)', transition: 'background .12s', animationDelay: `${Math.min(docIdx, 12) * 25}ms` }}
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
                              <div style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35, fontSize: 13, textDecoration: 'underline', textDecorationColor: 'transparent', textUnderlineOffset: 3, transition: 'text-decoration-color .12s' }}
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
                          {reviewPill && (
                            <span
                              title={reviewPill.title}
                              style={{ display: 'block', marginTop: 4, fontSize: 9.5, fontWeight: 800, color: reviewPill.color, background: reviewPill.bg, padding: '1px 8px', borderRadius: 99 }}
                            >
                              {reviewPill.label}
                            </span>
                          )}
                        </td>

                        {/* 4. Revision */}
                        <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>
                          <span
                            title={hasActiveDraft ? 'มีฉบับแก้ไข (Rev+) กำลังดำเนินการ' : undefined}
                            style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: hasActiveDraft ? '2px 8px' : 0,
                              borderRadius: 20,
                              border: hasActiveDraft ? '1px solid var(--warning)' : 'none',
                              color: hasActiveDraft ? 'var(--warning)' : 'inherit',
                              fontWeight: hasActiveDraft ? 600 : 'inherit',
                            }}
                          >
                            Rev.&nbsp;{doc.revision}
                          </span>
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
                        <td style={{ padding: '13px 16px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center' }}>{fmtDate(doc.edit_date ?? doc.expiry_date)}</td>

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
                              !isReviewTrackedType(doc.type) && !hasActiveDraft ? (
                                <button onClick={() => setQuickDoc(doc)} title="อัปเดตเอกสาร (เปลี่ยนไฟล์ + Rev+1)"
                                  style={{ width: 42, height: 32, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .12s', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                                  Upd+
                                </button>
                              ) : (
                                <button onClick={() => handleCreateRevisionDraft(doc)} title={hasActiveDraft ? 'มีฉบับแก้ไข (Rev+) กำลังดำเนินการ — คลิกเพื่อเปิด' : 'สร้าง Revision ใหม่'}
                                  style={{ width: 42, height: 32, borderRadius: 7, border: `1px solid ${hasActiveDraft ? 'var(--warning)' : 'var(--border)'}`, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasActiveDraft ? 'var(--warning)' : 'var(--muted)', transition: 'all .12s', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)' }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = hasActiveDraft ? 'var(--warning)' : 'var(--border)'; e.currentTarget.style.color = hasActiveDraft ? 'var(--warning)' : 'var(--muted)' }}>
                                  Rev+
                                </button>
                              )
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
        <DocumentDetailModal
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
          onReviewConfirmed={(updated) => {
            setDocs((d) => d.map((x) => x.id === updated.id ? updated : x))
            setDetailDoc(updated)
            toast('บันทึกการทบทวนแล้ว เอกสารเข้าคิวรอ DCC ดำเนินการ Rev +1')
          }}
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
          onRegisterSet={setSetUploadDoc}
          onDuplicateOpen={handleDuplicateOpen}
        />
      )}

      {setUploadDoc && (
        <DocumentSetUploadModal
          mainDoc={setUploadDoc}
          onClose={() => setSetUploadDoc(null)}
          onDone={handleSetUploadDone}
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

      {/* Quick Update (Upd+) for non-controlled document types */}
      {quickDoc && (
        <QuickUpdateModal
          doc={quickDoc}
          canPublish={canPublishQuick}
          onClose={() => setQuickDoc(null)}
          onDone={handleQuickUpdateDone}
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
