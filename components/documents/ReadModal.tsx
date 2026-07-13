'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PdfViewer } from '@/components/documents/PdfViewer'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import { buildReadLogSummaryHtml } from '@/lib/documents/read-log-summary'
import { TYPE_ICON_BG, TYPE_ICON_FG } from '@/lib/documents/ui-constants'
import type { Document } from '@/lib/supabase/types'

export interface ReadLog {
  id: string
  user_id: string
  created_at: string
  profiles: { name: string; role: string; document_position: string | null } | null
}

export function ReadModal({ doc, userRole, canViewLog, onClose, onResetReadIds, onReadLogged }: {
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
