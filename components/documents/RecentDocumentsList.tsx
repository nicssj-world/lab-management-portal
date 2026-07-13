'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { DocumentDetailModal } from '@/components/documents/DocumentDetailModal'
import { ReadModal } from '@/components/documents/ReadModal'
import { TYPE_ICON_BG, TYPE_ICON_FG } from '@/lib/documents/ui-constants'
import type { Document } from '@/lib/supabase/types'

export interface RecentDoc {
  id: string
  document_code: string
  title: string
  type: string
  status: string
  published_at: string | null
}

const STATUS_TONE: Record<string, { bg: string; color: string; dot: string }> = {
  Draft:     { bg: 'rgba(100,116,139,.12)', color: '#475569', dot: '#64748B' },
  Review:    { bg: 'rgba(217,119,6,.12)',   color: '#B45309', dot: '#D97706' },
  Approved:  { bg: 'rgba(30,95,173,.12)',   color: '#1E5FAD', dot: '#1E5FAD' },
  Published: { bg: 'rgba(22,163,74,.12)',   color: '#15803D', dot: '#16A34A' },
  Obsolete:  { bg: 'rgba(220,38,38,.12)',   color: '#DC2626', dot: '#DC2626' },
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Clicking a document opens the same detail card used in the document library instead of
// navigating away — "ประวัติ"/"แก้ไข" still hand off to the library (they need RevisionPanel /
// DocumentUploadModal, which need more surrounding state than a dashboard widget should own).
export function RecentDocumentsList({ docs, userRole, docRole, userId, canUpload }: {
  docs: RecentDoc[]
  userRole: string
  docRole: string | null
  userId: string
  canUpload: boolean
}) {
  const router = useRouter()
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [readDoc, setReadDoc] = useState<Document | null>(null)
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set())
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const toast = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  useEffect(() => {
    fetch('/api/admin/documents/my-reads')
      .then((r) => r.json())
      .then((ids: string[]) => { if (Array.isArray(ids)) setReadDocIds(new Set(ids)) })
      .catch(() => {})
  }, [])

  async function openDetail(id: string) {
    if (detailLoadingId) return
    setDetailLoadingId(id)
    try {
      const res = await fetch(`/api/admin/documents/${id}`)
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? 'เปิดเอกสารไม่สำเร็จ', false); return }
      setDetailDoc(json as Document)
    } catch {
      toast('เปิดเอกสารไม่สำเร็จ', false)
    } finally {
      setDetailLoadingId(null)
    }
  }

  async function handleDownload(path: string | null | undefined) {
    if (!path) { toast('เอกสารนี้ยังไม่มีไฟล์ทางการ', false); return }
    try {
      const res = await fetch(`/api/admin/documents/download?path=${encodeURIComponent(path)}&variant=download`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      window.open(json.url, '_blank')
    } catch {
      toast('ดาวน์โหลดไม่สำเร็จ', false)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {docs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 12px', color: 'var(--muted)' }}>
            <Icon name="doc" size={22} style={{ opacity: .4 }} />
            <span style={{ fontSize: 12.5, fontStyle: 'italic' }}>ยังไม่มีเอกสาร</span>
          </div>
        )}
        {docs.map((d, i) => {
          const tone = STATUS_TONE[d.status] ?? STATUS_TONE.Draft
          const typeBg = TYPE_ICON_BG[d.type] ?? 'var(--surface-2)'
          const typeFg = TYPE_ICON_FG[d.type] ?? 'var(--muted)'
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => openDetail(d.id)}
              disabled={detailLoadingId === d.id}
              className="fade-in-up qd-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 10,
                animationDelay: `${i * 35}ms`, border: '1px solid transparent', background: 'var(--surface-2)',
                width: '100%', textAlign: 'left', cursor: detailLoadingId === d.id ? 'wait' : 'pointer', fontFamily: 'inherit',
                opacity: detailLoadingId === d.id ? 0.6 : 1,
              }}
            >
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: typeBg, color: typeFg,
              }}>
                <Icon name="doc" size={16} />
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: typeFg }}>{d.document_code}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.bg, padding: '2px 9px', borderRadius: 99 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: tone.dot }} />
                  {d.status}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(d.published_at)}</span>
              </span>
            </button>
          )
        })}
      </div>

      {detailDoc && (
        <DocumentDetailModal
          doc={detailDoc}
          hasRead={readDocIds.has(detailDoc.id)}
          canUpload={canUpload}
          userRole={userRole}
          docRole={docRole}
          userId={userId}
          onClose={() => setDetailDoc(null)}
          onRead={() => { setReadDoc(detailDoc); setDetailDoc(null) }}
          onHistory={() => router.push(`/staff/documents?open=${detailDoc.id}`)}
          onEdit={() => router.push(`/staff/documents?open=${detailDoc.id}`)}
          onDownload={handleDownload}
        />
      )}

      {readDoc && (
        <ReadModal
          doc={readDoc}
          userRole={userRole}
          canViewLog={canUpload}
          onClose={() => setReadDoc(null)}
          onResetReadIds={(docId) => {
            if (docId === null) setReadDocIds(new Set())
            else setReadDocIds((prev) => { const next = new Set(prev); next.delete(docId); return next })
          }}
          onReadLogged={(docId) => setReadDocIds((prev) => new Set(prev).add(docId))}
        />
      )}

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
    </>
  )
}
