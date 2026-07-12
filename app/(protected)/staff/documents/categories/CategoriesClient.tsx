'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { DocumentDetailModal, PdfViewerModal } from '@/components/documents/DocumentDetailModal'
import { DOCUMENT_DEPARTMENTS } from '@/lib/documents/departments'
import { documentPdfProxyUrl } from '@/lib/pdf-viewer-utils'
import type { Document } from '@/lib/supabase/types'
import { DOC_TYPES as TYPE_ORDER, TYPE_LABEL } from '@/lib/documents/type-labels'

export interface CategoryDoc {
  id: string
  document_code: string
  title: string
  type: string
  status: string
  department: string | null
  revision: string | null
  effective_date: string | null
  expiry_date: string | null
  file_url: string | null
}

interface Props {
  docs: CategoryDoc[]
  userRole?: string
  docRole?: string
  userId?: string
}

const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)', QM: 'rgba(5,150,105,.10)',
  Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Lb: 'rgba(79,70,229,.10)', Others: 'rgba(100,116,139,.10)',
}
const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA',
  Policy: '#D97706', Manual: '#16A34A', QM: '#059669', Reference: '#EA580C', 'Card file': '#F59E0B', Lb: '#4F46E5', Others: '#64748B',
}
const STATUS_TONE: Record<string, { bg: string; color: string }> = {
  Draft:     { bg: 'rgba(100,116,139,.12)', color: '#475569' },
  Review:    { bg: 'rgba(217,119,6,.12)',   color: '#B45309' },
  Approved:  { bg: 'rgba(30,95,173,.12)',   color: '#1E5FAD' },
  Published: { bg: 'rgba(22,163,74,.12)',   color: '#15803D' },
  Obsolete:  { bg: 'rgba(220,38,38,.12)',   color: '#DC2626' },
}

const UNASSIGNED = 'ไม่ระบุหน่วยงาน'

export function CategoriesClient({ docs, userRole, docRole, userId = '' }: Props) {
  const router = useRouter()
  const isAdmin = userRole === 'Admin'
  const workflowRole = docRole ?? userRole
  const canUpload = isAdmin
    ? true
    : ['Laboratory Director', 'Quality Manager', 'Document Controller', 'Reviewer'].includes(workflowRole ?? '')

  const [expandedDept, setExpandedDept] = useState<string | null>(null)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [detailDoc, setDetailDoc] = useState<Document | null>(null)
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set())
  const [pdfViewer, setPdfViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string } | null>(null)

  function toggleDept(dept: string) {
    setExpandedDept((prev) => (prev === dept ? null : dept))
    setExpandedType(null)
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

  async function quickRead(doc: Pick<CategoryDoc, 'id' | 'title' | 'file_url'>) {
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}/read`, { method: 'POST' })
      const json = await res.json()
      if (json.url) { setPdfViewer({ url: json.url, pdfJsUrl: documentPdfProxyUrl(doc.file_url), title: doc.title }); setReadDocIds((prev) => new Set(prev).add(doc.id)) }
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

  const groups = useMemo(() => {
    const byDept = new Map<string, CategoryDoc[]>()
    for (const d of docs) {
      const dept = d.department?.trim() || UNASSIGNED
      if (!byDept.has(dept)) byDept.set(dept, [])
      byDept.get(dept)!.push(d)
    }
    const knownOrder = DOCUMENT_DEPARTMENTS.filter((d) => byDept.has(d)) as string[]
    const unknown = Array.from(byDept.keys())
      .filter((d) => !(DOCUMENT_DEPARTMENTS as readonly string[]).includes(d) && d !== UNASSIGNED)
      .sort()
    const order = [...knownOrder, ...unknown, ...(byDept.has(UNASSIGNED) ? [UNASSIGNED] : [])]

    return order.map((dept) => {
      const deptDocs = byDept.get(dept)!
      const byType = new Map<string, CategoryDoc[]>()
      for (const d of deptDocs) {
        const type = (TYPE_ORDER as readonly string[]).includes(d.type) ? d.type : 'Others'
        if (!byType.has(type)) byType.set(type, [])
        byType.get(type)!.push(d)
      }
      const types = TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({ type: t, docs: byType.get(t)! }))
      return { dept, total: deptDocs.length, types }
    })
  }, [docs])

  const isSearching = search.trim().length > 0

  // Light in-page filter — narrows the browse tree to matching branches and auto-expands
  // them, rather than a full-text search like the document library page. Matches department
  // name, type label, document code, or title.
  const visibleGroups = useMemo(() => {
    if (!isSearching) return groups
    const q = search.trim().toLowerCase()
    return groups
      .map((g) => {
        const deptMatches = g.dept.toLowerCase().includes(q)
        const types = g.types
          .map((t) => {
            const typeMatches = deptMatches || (TYPE_LABEL[t.type] ?? t.type).toLowerCase().includes(q)
            const matchedDocs = typeMatches
              ? t.docs
              : t.docs.filter((d) => d.document_code.toLowerCase().includes(q) || d.title.toLowerCase().includes(q))
            return { type: t.type, docs: matchedDocs }
          })
          .filter((t) => t.docs.length > 0)
        const total = types.reduce((sum, t) => sum + t.docs.length, 0)
        return { dept: g.dept, total, types }
      })
      .filter((g) => g.types.length > 0)
  }, [groups, search, isSearching])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: 18, borderRadius: 14, border: '1px solid var(--border)',
        background: 'linear-gradient(135deg, var(--card) 0%, var(--surface-2) 100%)',
        boxShadow: '0 14px 36px rgba(15,23,42,.08)',
      }}>
        <PageHeader
          eyebrow="เอกสารคุณภาพ"
          title="หมวดหมู่เอกสาร"
          subtitle={`จัดกลุ่มตามหน่วยงานและชนิดเอกสาร · ${docs.length} ฉบับ`}
          marginBottom={0}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <Input
            icon="search"
            placeholder="กรองตามแผนก ประเภท รหัส หรือชื่อเอกสาร..."
            value={search}
            onChange={setSearch}
            style={{ width: 280 }}
          />
          <Link href="/staff/documents" className="dash-btn-secondary" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
            fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0,
          }}>
            <Icon name="doc" size={15} /> เปิดคลังเอกสาร
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13.5 }}>
          ยังไม่มีเอกสารในระบบ
        </div>
      ) : isSearching && visibleGroups.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13.5 }}>
          ไม่พบเอกสารที่ตรงกับ &quot;{search.trim()}&quot;
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleGroups.map((g, gIdx) => {
            const expanded = isSearching || expandedDept === g.dept
            return (
              <div key={g.dept} className="fade-in-up qd-card" style={{ background: 'var(--card)', border: `1.5px solid ${expanded ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s', animationDelay: `${Math.min(gIdx, 10) * 30}ms` }}>
                {/* Department header (folder) */}
                <button
                  onClick={() => toggleDept(g.dept)}
                  className="qd-row"
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                    background: expanded ? 'var(--primary-soft)' : 'transparent', border: 'none',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  }}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: expanded ? 'var(--primary)' : 'var(--primary-soft)', color: expanded ? '#fff' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="inbox" size={18} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{g.dept}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {g.types.map((t) => `${t.type} ${t.docs.length}`).join(' · ')}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '3px 12px', borderRadius: 99, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {g.total}
                  </span>
                  <Icon name={expanded ? 'chevDown' : 'chevRight'} size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                </button>

                {/* Type sections */}
                {expanded && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {g.types.map(({ type, docs: typeDocs }) => {
                      const typeExpanded = isSearching || expandedType === type
                      return (
                        <div key={type} style={{ borderRadius: 10, overflow: 'hidden', border: typeExpanded ? '1px solid var(--border)' : 'none' }}>
                          <button
                            onClick={() => setExpandedType(typeExpanded ? null : type)}
                            className="qd-row"
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
                              background: typeExpanded ? 'var(--surface-2)' : 'transparent', border: 'none',
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', borderRadius: 8,
                            }}
                          >
                            <span style={{ width: 26, height: 26, borderRadius: 7, background: TYPE_ICON_BG[type], color: TYPE_ICON_FG[type], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon name="doc" size={13} />
                            </span>
                            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{TYPE_LABEL[type] ?? type}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{typeDocs.length}</span>
                            <Icon name={typeExpanded ? 'chevDown' : 'chevRight'} size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                          </button>
                          {typeExpanded && (
                            <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {typeDocs.map((d, dIdx) => {
                                const tone = STATUS_TONE[d.status] ?? STATUS_TONE.Draft
                                const loading = detailLoadingId === d.id
                                return (
                                  <div
                                    key={d.id}
                                    className="fade-in qd-row"
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 12px',
                                      borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)',
                                      animationDelay: `${Math.min(dIdx, 14) * 20}ms`,
                                    }}
                                  >
                                    <button
                                      onClick={() => openDetail(d.id)}
                                      disabled={loading}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0,
                                        background: 'none', border: 'none', padding: 0, textAlign: 'left',
                                        cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', opacity: loading ? .6 : 1,
                                      }}
                                    >
                                      <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: TYPE_ICON_FG[type], fontWeight: 700, flexShrink: 0 }}>{d.document_code}</span>
                                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                                      {d.revision && <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Rev.{d.revision}</span>}
                                      <span style={{ fontSize: 10.5, fontWeight: 700, color: tone.color, background: tone.bg, padding: '2px 9px', borderRadius: 99, flexShrink: 0 }}>{d.status}</span>
                                    </button>
                                    {d.file_url ? (
                                      <button
                                        onClick={() => quickRead(d)}
                                        title="อ่านเอกสาร"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 9px', height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}
                                      >
                                        <Icon name="eye" size={13} />
                                      </button>
                                    ) : (
                                      <span title="ยังไม่มีไฟล์ทางการ" style={{ display: 'flex', alignItems: 'center', padding: '0 9px', height: 28, borderRadius: 7, border: '1px solid var(--border)', color: 'var(--border)', flexShrink: 0 }}>
                                        <Icon name="eye" size={13} />
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {detailDoc && (
        <DocumentDetailModal
          doc={detailDoc}
          hasRead={readDocIds.has(detailDoc.id)}
          canUpload={canUpload}
          userRole={userRole ?? ''}
          docRole={docRole ?? null}
          userId={userId}
          onClose={() => setDetailDoc(null)}
          onRead={() => quickRead(detailDoc)}
          onHistory={() => router.push(`/staff/documents?search=${encodeURIComponent(detailDoc.document_code)}&open=${detailDoc.id}`)}
          onEdit={() => router.push(`/staff/documents?search=${encodeURIComponent(detailDoc.document_code)}&open=${detailDoc.id}`)}
          onDownload={handleDownload}
          onReviewConfirmed={(updated) => setDetailDoc(updated)}
        />
      )}

      {pdfViewer && <PdfViewerModal url={pdfViewer.url} pdfJsUrl={pdfViewer.pdfJsUrl} title={pdfViewer.title} onClose={() => setPdfViewer(null)} />}
    </div>
  )
}
