'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { FilterChips } from '@/components/ui/FilterChips'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { documentPdfProxyUrl, isPdfLike } from '@/lib/pdf-viewer-utils'
import { canUseDocumentAction, normalizeDocumentAccess } from '@/lib/tests/document-access'
import { DOCUMENT_DEPARTMENTS } from '@/lib/documents/departments'
import { DOC_TYPES as TYPE_ORDER, TYPE_LABEL } from '@/lib/documents/type-labels'
import { SECTION_ICONS, type SectionGroupBy } from '@/lib/validations/public-document-section'

export interface PublicDoc {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  effective_date: string | null
  file_url: string | null
  file_name: string | null
  mime_type: string | null
  file_size: number | null
}

export interface PublicAttachment {
  id: number
  test_id: number
  name: string
  doc_type: string
  storage_path: string
  access_mode: string | null
  test_code: string
  test_name: string
}

export interface PublicUpload {
  id: string
  name: string
  file_key: string
  file_name: string
  mime_type: string | null
  file_size: number | null
}

export interface PublicSection {
  id: string
  kind: 'manual' | 'auto'
  title_th: string
  title_en: string
  description_th: string | null
  description_en: string | null
  icon: string
  sort_order: number
  visible: boolean
  default_expanded: boolean
  hot: boolean
  settings: { group_by?: SectionGroupBy; hidden_groups?: string[]; group_titles?: Record<string, string> } | null
}

export interface PublicSectionItem {
  id: string
  section_id: string
  source: 'library' | 'test_attachment' | 'upload'
  document_id: string | null
  test_document_id: number | null
  upload_id: string | null
  label_override: string | null
  sort_order: number
}

interface Props {
  docs: PublicDoc[]
  sections: PublicSection[]
  items: PublicSectionItem[]
  attachments: PublicAttachment[]
  uploads: PublicUpload[]
  canManage: boolean
}

const TYPE_ICON_BG: Record<string, string> = {
  QP: 'rgba(30,95,173,.10)', WI: 'rgba(13,148,136,.10)', Form: 'rgba(147,51,234,.10)',
  Policy: 'rgba(217,119,6,.10)', Manual: 'rgba(22,163,74,.10)', QM: 'rgba(5,150,105,.10)',
  Reference: 'rgba(234,88,12,.10)', 'Card file': 'rgba(245,158,11,.10)', Lb: 'rgba(79,70,229,.10)',
  Others: 'rgba(100,116,139,.10)',
}
const TYPE_ICON_FG: Record<string, string> = {
  QP: '#1E5FAD', WI: '#0D9488', Form: '#9333EA', Policy: '#D97706', Manual: '#16A34A',
  QM: '#059669', Reference: '#EA580C', 'Card file': '#F59E0B', Lb: '#4F46E5', Others: '#64748B',
}

const UNASSIGNED = 'ไม่ระบุหน่วยงาน'

/** One renderable row, normalised across the three possible sources. */
interface Entry {
  key: string
  source: PublicSectionItem['source']
  label: string
  code: string | null
  type: string
  revision: string | null
  note: string | null
  canView: boolean
  canDownload: boolean
  previewUrl: string
  downloadUrl: string
  /** Only library documents have a same-origin proxy that keeps the uncontrolled stamp. */
  pdfJsPath: string | null
  isPdf: boolean
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

function libraryEntry(doc: PublicDoc, label?: string | null): Entry | null {
  if (!doc.file_url) return null
  const path = encodeURIComponent(doc.file_url)
  return {
    key: `library:${doc.id}`,
    source: 'library',
    label: label?.trim() || doc.title,
    code: doc.document_code,
    type: (TYPE_ORDER as readonly string[]).includes(doc.type) ? doc.type : 'Others',
    revision: doc.revision,
    note: null,
    canView: true,
    canDownload: true,
    previewUrl: `/api/documents/download?path=${path}&variant=preview&inline=1`,
    downloadUrl: `/api/documents/download?path=${path}&variant=download`,
    pdfJsPath: doc.file_url,
    isPdf: isPdfLike({ fileName: doc.file_name ?? doc.file_url, mimeType: doc.mime_type }),
  }
}

function attachmentEntry(att: PublicAttachment, label?: string | null): Entry {
  const access = normalizeDocumentAccess('Public', att.access_mode)
  const base = `/api/tests/${att.test_id}/document-actions/attachment/${att.id}`
  return {
    key: `attachment:${att.id}`,
    source: 'test_attachment',
    label: label?.trim() || att.name,
    code: null,
    type: 'Others',
    revision: null,
    note: [att.test_code, att.test_name].filter(Boolean).join(' · ') || null,
    canView: canUseDocumentAction(access.accessMode, 'view'),
    canDownload: canUseDocumentAction(access.accessMode, 'download'),
    previewUrl: `${base}?action=view`,
    downloadUrl: `${base}?action=download`,
    pdfJsPath: null,
    isPdf: isPdfLike({ fileName: att.storage_path, mimeType: null }),
  }
}

function uploadEntry(up: PublicUpload, label?: string | null): Entry {
  return {
    key: `upload:${up.id}`,
    source: 'upload',
    label: label?.trim() || up.name,
    code: null,
    type: 'Others',
    revision: null,
    note: null,
    canView: true,
    canDownload: true,
    previewUrl: `/api/public-section-files/${up.id}?variant=preview`,
    downloadUrl: `/api/public-section-files/${up.id}?variant=download`,
    pdfJsPath: null,
    isPdf: isPdfLike({ fileName: up.file_name, mimeType: up.mime_type }),
  }
}

const SOURCE_LABEL: Record<Entry['source'], string> = {
  library: 'เอกสารคุณภาพ',
  test_attachment: 'ไฟล์แนบรายการตรวจ',
  upload: 'ไฟล์ประกอบ',
}

export function PublicDocumentsClient({ docs, sections, items, attachments, uploads, canManage }: Props) {
  const router = useRouter()
  const { toasts, add } = useToast()
  const [mode, setMode] = useState<'view' | 'manage'>('view')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ url: string; pdfJsUrl?: string | null; title: string; forcePdfJs?: boolean } | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs])
  const attachmentById = useMemo(() => new Map(attachments.map((a) => [a.id, a])), [attachments])
  const uploadById = useMemo(() => new Map(uploads.map((u) => [u.id, u])), [uploads])

  const manualSections = useMemo(
    () => sections.filter((s) => s.kind === 'manual').sort((a, b) => a.sort_order - b.sort_order),
    [sections],
  )
  const autoSection = useMemo(() => sections.find((s) => s.kind === 'auto') ?? null, [sections])

  const itemsBySection = useMemo(() => {
    const map = new Map<string, PublicSectionItem[]>()
    for (const item of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!map.has(item.section_id)) map.set(item.section_id, [])
      map.get(item.section_id)!.push(item)
    }
    return map
  }, [items])

  // Resolve members and drop anything no longer public — a document flipped to Internal or a
  // deactivated test disappears on its own without anyone editing the section.
  const resolveItems = useCallback((sectionId: string): Entry[] => {
    const rows = itemsBySection.get(sectionId) ?? []
    const out: Entry[] = []
    for (const row of rows) {
      if (row.source === 'library' && row.document_id) {
        const doc = docById.get(row.document_id)
        const entry = doc ? libraryEntry(doc, row.label_override) : null
        if (entry) out.push(entry)
      } else if (row.source === 'test_attachment' && row.test_document_id != null) {
        const att = attachmentById.get(row.test_document_id)
        if (att) out.push(attachmentEntry(att, row.label_override))
      } else if (row.source === 'upload' && row.upload_id) {
        const up = uploadById.get(row.upload_id)
        if (up) out.push(uploadEntry(up, row.label_override))
      }
    }
    return out
  }, [itemsBySection, docById, attachmentById, uploadById])

  const sectionedDocIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of items) if (item.document_id) ids.add(item.document_id)
    return ids
  }, [items])

  // Library documents not placed in any manual section fall into the auto group.
  const autoGroups = useMemo(() => {
    if (!autoSection) return []
    const groupBy = autoSection.settings?.group_by ?? 'department'
    const hidden = new Set(autoSection.settings?.hidden_groups ?? [])
    const titles = autoSection.settings?.group_titles ?? {}

    const buckets = new Map<string, PublicDoc[]>()
    for (const doc of docs) {
      if (sectionedDocIds.has(doc.id)) continue
      const key = groupBy === 'type'
        ? ((TYPE_ORDER as readonly string[]).includes(doc.type) ? doc.type : 'Others')
        : (doc.department?.trim() || UNASSIGNED)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(doc)
    }

    const order = groupBy === 'type'
      ? TYPE_ORDER.filter((t) => buckets.has(t))
      : [
        ...DOCUMENT_DEPARTMENTS.filter((d) => buckets.has(d)),
        ...Array.from(buckets.keys())
          .filter((d) => !(DOCUMENT_DEPARTMENTS as readonly string[]).includes(d) && d !== UNASSIGNED)
          .sort(),
        ...(buckets.has(UNASSIGNED) ? [UNASSIGNED] : []),
      ]

    return order
      .filter((key) => !hidden.has(key))
      .map((key) => ({
        key,
        title: titles[key] || (groupBy === 'type' ? (TYPE_LABEL[key] ?? key) : key),
        entries: buckets.get(key)!.map((d) => libraryEntry(d)).filter((e): e is Entry => e !== null),
      }))
      .filter((g) => g.entries.length > 0)
  }, [autoSection, docs, sectionedDocIds])

  const query = search.trim().toLowerCase()
  const matches = useCallback((entry: Entry) => {
    if (!query) return true
    return entry.label.toLowerCase().includes(query)
      || (entry.code?.toLowerCase().includes(query) ?? false)
      || (entry.note?.toLowerCase().includes(query) ?? false)
      || (TYPE_LABEL[entry.type] ?? entry.type).toLowerCase().includes(query)
  }, [query])

  const visibleManual = useMemo(() => manualSections
    .filter((s) => s.visible || mode === 'manage')
    .map((s) => ({ section: s, entries: resolveItems(s.id).filter(matches) }))
    .filter((s) => mode === 'manage' || s.entries.length > 0),
  [manualSections, resolveItems, matches, mode])

  const visibleAuto = useMemo(() => autoGroups
    .map((g) => ({ ...g, entries: g.entries.filter(matches) }))
    .filter((g) => g.entries.length > 0),
  [autoGroups, matches])

  const showAuto = Boolean(autoSection) && (autoSection!.visible || mode === 'manage') && visibleAuto.length > 0
  const totalVisible = visibleManual.reduce((n, s) => n + s.entries.length, 0)
    + visibleAuto.reduce((n, g) => n + g.entries.length, 0)

  async function requestUrl(url: string) {
    const res = await fetch(url)
    const json = await res.json().catch(() => ({} as Record<string, unknown>))
    if (!res.ok || !json.url) {
      throw new Error((json.error as string) || 'เปิดเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    }
    return json as { url: string; preview_uncontrolled?: boolean }
  }

  async function openPreview(entry: Entry) {
    setBusyKey(entry.key)
    try {
      const json = await requestUrl(entry.previewUrl)
      setViewer({
        url: json.url,
        pdfJsUrl: entry.pdfJsPath ? documentPdfProxyUrl(entry.pdfJsPath, 'public') : null,
        title: entry.label,
        forcePdfJs: json.preview_uncontrolled === true,
      })
    } catch (err) {
      add(err instanceof Error ? err.message : 'เปิดเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false)
    } finally {
      setBusyKey(null)
    }
  }

  async function download(entry: Entry) {
    setBusyKey(entry.key)
    try {
      const json = await requestUrl(entry.downloadUrl)
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      add(err instanceof Error ? err.message : 'ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false)
    } finally {
      setBusyKey(null)
    }
  }

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function isOpen(section: PublicSection) {
    if (query) return true
    return collapsed.has(section.id) ? !section.default_expanded : section.default_expanded
  }

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`
        .rd-wrap { max-width: 1100px; margin: 0 auto; padding: 32px 28px 60px; }
        .rd-title { font-size: 32px; font-weight: 800; margin: 0 0 8px; color: var(--ink); line-height: 1.2; letter-spacing: -.02em; }
        .rd-row { transition: background .12s ease, border-color .12s ease; }
        .rd-row:hover { background: var(--surface-2); }
        .rd-head { transition: background .15s ease, border-color .15s ease; }
        .rd-head:hover { background: var(--primary-soft); }
        .rd-btn { transition: color .15s ease, background .15s ease, border-color .15s ease; }
        .rd-btn:hover:not(:disabled) { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
        .rd-wrap button:focus-visible, .rd-wrap a:focus-visible {
          outline: 3px solid color-mix(in srgb, var(--primary) 32%, transparent); outline-offset: 2px;
        }
        /* Same ripple as the NEW badge on the news module (news-badge-ripple). */
        @keyframes rd-badge-ripple {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.55), 0 0 0 0 rgba(220,38,38,.25); }
          70%  { box-shadow: 0 0 0 8px rgba(220,38,38,0), 0 0 0 16px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0),  0 0 0 0  rgba(220,38,38,0); }
        }
        .rd-hot-badge { animation: rd-badge-ripple 1.4s ease-out infinite; display: inline-flex; }
        @media (max-width: 720px) {
          .rd-wrap { padding: 20px 16px 48px; }
          .rd-title { font-size: 24px; }
          .rd-row { flex-wrap: wrap; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rd-row, .rd-head, .rd-btn { transition: none; }
          /* The badge stays visible — only the infinite ripple stops. */
          .rd-hot-badge { animation: none; }
        }
      `}</style>

      <div className="rd-wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>หน้าแรก</Link>
          <Icon name="chevRight" size={11} />
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>เอกสารที่เกี่ยวข้อง</span>
        </div>

        <h1 className="rd-title">เอกสารที่เกี่ยวข้อง</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.7, maxWidth: 720 }}>
          เอกสารคุณภาพและเอกสารประกอบที่กลุ่มงานเทคนิคการแพทย์เผยแพร่สู่สาธารณะ สำหรับผู้รับบริการและหน่วยงานที่เกี่ยวข้อง
        </p>

        {/* Uncontrolled-copy notice — these files carry no revision control once downloaded. */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 14px', marginBottom: 18,
          background: 'color-mix(in srgb, var(--warning) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
          borderLeft: '3px solid var(--warning)', borderRadius: 9,
        }}>
          <Icon name="alert" size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.65 }}>
            เอกสารในหน้านี้เป็น<strong>สำเนาไม่ควบคุม (Uncontrolled Document)</strong> ใช้เพื่อการอ้างอิงเท่านั้น
            ฉบับควบคุมที่เป็นทางการอยู่ในระบบเอกสารคุณภาพของกลุ่มงานเทคนิคการแพทย์
          </div>
        </div>

        {canManage && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            padding: '10px 14px', marginBottom: 18, borderRadius: 10,
            border: `1px solid ${mode === 'manage' ? 'var(--warning)' : 'var(--border)'}`,
            background: mode === 'manage' ? 'color-mix(in srgb, var(--warning) 8%, transparent)' : 'var(--card)',
          }}>
            <Icon name="settings" size={15} style={{ color: mode === 'manage' ? 'var(--warning)' : 'var(--muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', flex: 1, minWidth: 160 }}>
              {mode === 'manage' ? 'โหมดจัดการ — ผู้ใช้ทั่วไปไม่เห็นการเปลี่ยนแปลงจนกว่าจะบันทึก' : 'คุณมีสิทธิ์จัดการหัวข้อบนหน้านี้'}
            </span>
            <button
              type="button"
              onClick={() => setMode(mode === 'manage' ? 'view' : 'manage')}
              className="rd-btn"
              style={{
                minHeight: 44, padding: '0 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)',
                display: 'inline-flex', alignItems: 'center', gap: 7,
              }}
            >
              <Icon name={mode === 'manage' ? 'eye' : 'edit'} size={14} />
              {mode === 'manage' ? 'ดูแบบผู้ใช้ทั่วไป' : 'จัดการหัวข้อ'}
            </button>
          </div>
        )}

        <div style={{ marginBottom: 20, maxWidth: 560 }}>
          <Input
            icon="search"
            size="lg"
            placeholder="ค้นหา เช่น WI-LAB-05, ใบขอตรวจ, งานเคมีคลินิก..."
            value={search}
            onChange={setSearch}
          />
          {query && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              พบ {totalVisible} รายการที่ตรงกับ &ldquo;{search.trim()}&rdquo;
            </div>
          )}
        </div>

        {mode === 'manage' ? (
          <SectionManager
            sections={sections}
            itemsBySection={itemsBySection}
            docs={docs}
            attachments={attachments}
            uploads={uploads}
            onToast={add}
            onChanged={() => router.refresh()}
          />
        ) : totalVisible === 0 ? (
          <div style={{
            padding: 48, textAlign: 'center', background: 'var(--card)', borderRadius: 14,
            border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 13.5,
          }}>
            <Icon name="doc" size={28} style={{ color: 'var(--border)', marginBottom: 10 }} />
            <div style={{ marginBottom: query ? 14 : 0 }}>
              {query ? `ไม่พบเอกสารที่ตรงกับ "${search.trim()}"` : 'ยังไม่มีเอกสารเผยแพร่'}
            </div>
            {query && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="rd-btn"
                style={{
                  minHeight: 44, padding: '0 18px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13, fontWeight: 600, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--ink)',
                }}
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleManual.map(({ section, entries }) => {
              const open = isOpen(section)
              return (
                <SectionShell
                  key={section.id}
                  icon={section.icon}
                  title={section.title_th}
                  subtitle={section.description_th}
                  count={entries.length}
                  hidden={!section.visible}
                  hot={section.hot}
                  open={open}
                  onToggle={() => toggle(section.id)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 14px 14px' }}>
                    {entries.map((entry) => (
                      <EntryRow
                        key={entry.key}
                        entry={entry}
                        busy={busyKey === entry.key}
                        onPreview={() => openPreview(entry)}
                        onDownload={() => download(entry)}
                      />
                    ))}
                  </div>
                </SectionShell>
              )
            })}

            {showAuto && autoSection && (
              <SectionShell
                icon={autoSection.icon}
                title={autoSection.title_th}
                subtitle={autoSection.description_th}
                count={visibleAuto.reduce((n, g) => n + g.entries.length, 0)}
                hidden={!autoSection.visible}
                hot={autoSection.hot}
                open={isOpen(autoSection)}
                onToggle={() => toggle(autoSection.id)}
              >
                <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {visibleAuto.map((group) => {
                    const groupOpen = Boolean(query) || openGroup === group.key
                    return (
                      <div key={group.key} style={{ borderRadius: 10, border: groupOpen ? '1px solid var(--border)' : '1px solid transparent', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => setOpenGroup(groupOpen ? null : group.key)}
                          className="rd-row"
                          aria-expanded={groupOpen}
                          style={{
                            width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 9,
                            padding: '9px 11px', border: 'none', borderRadius: 8, cursor: 'pointer',
                            fontFamily: 'inherit', textAlign: 'left',
                            background: groupOpen ? 'var(--surface-2)' : 'transparent',
                          }}
                        >
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{group.title}</span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>{group.entries.length}</span>
                          <Icon name={groupOpen ? 'chevDown' : 'chevRight'} size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        </button>
                        {groupOpen && (
                          <div style={{ padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {group.entries.map((entry) => (
                              <EntryRow
                                key={entry.key}
                                entry={entry}
                                busy={busyKey === entry.key}
                                onPreview={() => openPreview(entry)}
                                onDownload={() => download(entry)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </SectionShell>
            )}
          </div>
        )}
      </div>

      {viewer && (
        <PdfViewerModal
          url={viewer.url}
          pdfJsUrl={viewer.pdfJsUrl}
          title={viewer.title}
          forcePdfJs={viewer.forcePdfJs}
          onClose={() => setViewer(null)}
        />
      )}

      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 3000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            style={{
              padding: '10px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, maxWidth: 380,
              background: t.ok ? 'var(--success)' : 'var(--danger)', color: '#fff',
              boxShadow: '0 10px 30px rgba(15,23,42,.22)',
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </main>
  )
}

/** Mirrors the NEW badge on the news module, including its ripple. */
function HotBadge() {
  return (
    <span
      className="rd-hot-badge"
      style={{
        background: 'var(--danger)', color: '#fff', fontSize: 9.5, fontWeight: 800,
        padding: '3px 8px', borderRadius: 4, letterSpacing: '.06em',
      }}
    >
      Hot!!
    </span>
  )
}

function SectionShell({ icon, title, subtitle, count, hidden, hot, open, onToggle, children }: {
  icon: string
  title: string
  subtitle?: string | null
  count: number
  hidden?: boolean
  hot?: boolean
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section style={{
      background: 'var(--card)', borderRadius: 14, overflow: 'hidden',
      border: `1.5px solid ${open ? 'var(--primary)' : 'var(--border)'}`,
    }}>
      <button
        type="button"
        onClick={onToggle}
        className="rd-head"
        aria-expanded={open}
        style={{
          width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'left', background: open ? 'var(--primary-soft)' : 'transparent',
        }}
      >
        <span style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          background: open ? 'var(--primary)' : 'var(--primary-soft)',
          color: open ? '#fff' : 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
            {hot && <HotBadge />}
            {hidden && <Badge color="gray" size="sm">ซ่อนอยู่</Badge>}
          </span>
          {subtitle && (
            <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
              {subtitle}
            </span>
          )}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-soft)',
          padding: '3px 12px', borderRadius: 99, fontVariantNumeric: 'tabular-nums', flexShrink: 0,
        }}>
          {count}
        </span>
        <Icon name={open ? 'chevDown' : 'chevRight'} size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
      </button>
      {open && <div style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
    </section>
  )
}

function EntryRow({ entry, busy, onPreview, onDownload }: {
  entry: Entry
  busy: boolean
  onPreview: () => void
  onDownload: () => void
}) {
  const accent = TYPE_ICON_FG[entry.type] ?? TYPE_ICON_FG.Others
  const isLibrary = entry.source === 'library'
  return (
    <div
      className="rd-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px 9px 12px',
        borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)',
        borderLeft: `3px solid ${isLibrary ? accent : 'var(--border)'}`,
      }}
    >
      <span style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: isLibrary ? (TYPE_ICON_BG[entry.type] ?? TYPE_ICON_BG.Others) : 'var(--surface-2)',
        color: isLibrary ? accent : 'var(--muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={entry.source === 'upload' ? 'upload' : 'doc'} size={14} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {entry.code && (
            <span style={{ fontSize: 11.5, fontFamily: 'monospace', fontWeight: 700, color: accent }}>{entry.code}</span>
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{entry.label}</span>
          {entry.revision && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Rev.{entry.revision}</span>}
          {!isLibrary && <Badge color="gray" size="sm">{SOURCE_LABEL[entry.source]}</Badge>}
        </span>
        {entry.note && (
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{entry.note}</span>
        )}
      </span>

      {entry.isPdf && entry.canView && (
        <button
          type="button"
          onClick={onPreview}
          disabled={busy}
          className="rd-btn"
          title="อ่านเอกสาร"
          style={{
            minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 12px',
            borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)',
            color: 'var(--primary)', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 600, flexShrink: 0, opacity: busy ? .55 : 1,
          }}
        >
          <Icon name="eye" size={14} /> อ่าน
        </button>
      )}
      {entry.canDownload && (
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="rd-btn"
          title="ดาวน์โหลด"
          style={{
            minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 12px',
            borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)',
            color: 'var(--muted)', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 600, flexShrink: 0, opacity: busy ? .55 : 1,
          }}
        >
          <Icon name="download" size={14} /> ดาวน์โหลด
        </button>
      )}
    </div>
  )
}

/* ─── Manage mode ──────────────────────────────────────────────────────────── */

interface DraftItem {
  source: PublicSectionItem['source']
  document_id?: string
  test_document_id?: number
  upload_id?: string
  label_override?: string | null
  label: string
  hint: string
}

function SectionManager({ sections, itemsBySection, docs, attachments, uploads, onToast, onChanged }: {
  sections: PublicSection[]
  itemsBySection: Map<string, PublicSectionItem[]>
  docs: PublicDoc[]
  attachments: PublicAttachment[]
  uploads: PublicUpload[]
  onToast: (msg: string, ok?: boolean) => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const ordered = useMemo(() => [...sections].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'manual' ? -1 : 1
    return a.sort_order - b.sort_order
  }), [sections])

  async function call(url: string, init: RequestInit, okMsg: string) {
    setBusy(true)
    try {
      const res = await fetch(url, init)
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) { onToast((json.error as string) || 'บันทึกไม่สำเร็จ', false); return false }
      onToast(okMsg)
      onChanged()
      return true
    } catch {
      onToast('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', false)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createSection() {
    if (!newTitle.trim()) return
    const ok = await call('/api/admin/public-document-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title_th: newTitle.trim() }),
    }, 'เพิ่มหัวข้อแล้ว')
    if (ok) setNewTitle('')
  }

  async function move(section: PublicSection, direction: -1 | 1) {
    const manual = ordered.filter((s) => s.kind === 'manual')
    const index = manual.findIndex((s) => s.id === section.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= manual.length) return
    const ids = manual.map((s) => s.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    await call('/api/admin/public-document-sections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }, 'จัดลำดับแล้ว')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ordered.map((section) => (
        <ManageSectionCard
          key={section.id}
          section={section}
          rows={itemsBySection.get(section.id) ?? []}
          docs={docs}
          attachments={attachments}
          uploads={uploads}
          busy={busy}
          onMoveUp={() => move(section, -1)}
          onMoveDown={() => move(section, 1)}
          onCall={call}
        />
      ))}

      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        padding: 16, borderRadius: 14, border: '1px dashed var(--border)', background: 'var(--card)',
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Input placeholder="ชื่อหัวข้อใหม่ เช่น เอกสารสำหรับผู้รับบริการ" value={newTitle} onChange={setNewTitle} />
        </div>
        <button
          type="button"
          onClick={createSection}
          disabled={busy || !newTitle.trim()}
          className="rd-btn"
          style={{
            minHeight: 44, padding: '0 18px', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
            cursor: busy || !newTitle.trim() ? 'not-allowed' : 'pointer',
            opacity: busy || !newTitle.trim() ? .55 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 7,
          }}
        >
          <Icon name="plus" size={14} /> เพิ่มหัวข้อ
        </button>
      </div>
    </div>
  )
}

function ManageSectionCard({ section, rows, docs, attachments, uploads, busy, onMoveUp, onMoveDown, onCall }: {
  section: PublicSection
  rows: PublicSectionItem[]
  docs: PublicDoc[]
  attachments: PublicAttachment[]
  uploads: PublicUpload[]
  busy: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onCall: (url: string, init: RequestInit, okMsg: string) => Promise<boolean>
}) {
  const isAuto = section.kind === 'auto'
  const [title, setTitle] = useState(section.title_th)
  const [description, setDescription] = useState(section.description_th ?? '')
  const [icon, setIcon] = useState(section.icon)
  const [expanded, setExpanded] = useState(true)

  const initialDrafts = useMemo<DraftItem[]>(() => {
    const docById = new Map(docs.map((d) => [d.id, d]))
    const attById = new Map(attachments.map((a) => [a.id, a]))
    const upById = new Map(uploads.map((u) => [u.id, u]))
    const out: DraftItem[] = []
    for (const row of rows) {
      if (row.source === 'library' && row.document_id) {
        const doc = docById.get(row.document_id)
        if (doc) out.push({ source: 'library', document_id: doc.id, label_override: row.label_override, label: doc.title, hint: doc.document_code })
      } else if (row.source === 'test_attachment' && row.test_document_id != null) {
        const att = attById.get(row.test_document_id)
        if (att) out.push({ source: 'test_attachment', test_document_id: att.id, label_override: row.label_override, label: att.name, hint: att.test_code })
      } else if (row.source === 'upload' && row.upload_id) {
        const up = upById.get(row.upload_id)
        if (up) out.push({ source: 'upload', upload_id: up.id, label_override: row.label_override, label: up.name, hint: up.file_name })
      }
    }
    return out
  }, [rows, docs, attachments, uploads])

  const [drafts, setDrafts] = useState<DraftItem[]>(initialDrafts)

  async function saveDetails() {
    await onCall(`/api/admin/public-document-sections/${section.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title_th: title.trim() || section.title_th,
        description_th: description.trim() || null,
        icon,
      }),
    }, 'บันทึกหัวข้อแล้ว')
  }

  async function patch(body: Record<string, unknown>, msg: string) {
    await onCall(`/api/admin/public-document-sections/${section.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, msg)
  }

  async function saveItems(next: DraftItem[]) {
    const ok = await onCall(`/api/admin/public-document-sections/${section.id}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: next.map((d) => ({
          source: d.source,
          ...(d.source === 'library' ? { document_id: d.document_id } : {}),
          ...(d.source === 'test_attachment' ? { test_document_id: d.test_document_id } : {}),
          ...(d.source === 'upload' ? { upload_id: d.upload_id } : {}),
          label_override: d.label_override?.trim() || null,
        })),
      }),
    }, 'บันทึกรายการเอกสารแล้ว')
    if (!ok) setDrafts(initialDrafts)
  }

  async function remove() {
    if (!confirm(`ลบหัวข้อ "${section.title_th}"?`)) return
    await onCall(`/api/admin/public-document-sections/${section.id}`, { method: 'DELETE' }, 'ลบหัวข้อแล้ว')
  }

  const settings = section.settings ?? {}
  const groupBy: SectionGroupBy = settings.group_by ?? 'department'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: expanded ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
        <Icon name={section.icon} size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 140, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{section.title_th}</span>
        {section.hot && <HotBadge />}
        {isAuto && <Badge color="blue" size="sm">จัดกลุ่มอัตโนมัติ</Badge>}
        {!section.visible && <Badge color="gray" size="sm">ซ่อนอยู่</Badge>}
        <button type="button" onClick={() => setExpanded(!expanded)} className="rd-btn" style={ghostBtn}>
          <Icon name={expanded ? 'chevDown' : 'chevRight'} size={14} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>ชื่อหัวข้อ</label>
              <Input value={title} onChange={setTitle} placeholder="ชื่อหัวข้อ" />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>คำอธิบาย (ไม่บังคับ)</label>
              <Input value={description} onChange={setDescription} placeholder="คำอธิบายสั้น ๆ" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>ไอคอน</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SECTION_ICONS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  title={name}
                  aria-pressed={icon === name}
                  className="rd-btn"
                  style={{
                    width: 44, height: 44, borderRadius: 9, cursor: 'pointer',
                    border: `1px solid ${icon === name ? 'var(--primary)' : 'var(--border)'}`,
                    background: icon === name ? 'var(--primary-soft)' : 'var(--card)',
                    color: icon === name ? 'var(--primary)' : 'var(--muted)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name={name} size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Attention marker — saved immediately so the admin sees it land on the real page. */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 12px',
            borderRadius: 9, border: '1px solid var(--border)', background: 'var(--card)',
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .55 : 1, flexWrap: 'wrap',
          }}>
            <input
              type="checkbox"
              checked={section.hot}
              disabled={busy}
              onChange={(e) => patch({ hot: e.target.checked }, e.target.checked ? 'ติดป้าย Hot!! แล้ว' : 'เอาป้าย Hot!! ออกแล้ว')}
              style={{ width: 18, height: 18, accentColor: 'var(--danger)', cursor: 'inherit', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>แสดงป้าย</span>
            <HotBadge />
            <span style={{ fontSize: 11.5, color: 'var(--muted)', flexBasis: '100%', lineHeight: 1.55 }}>
              ป้ายกะพริบเพื่อเรียกความสนใจ — ใช้กับหัวข้อเดียวในแต่ละช่วงจะได้ผลที่สุด ถ้าติดหลายหัวข้อพร้อมกันจะรบกวนสายตา
              (ผู้ที่ตั้งค่าลดการเคลื่อนไหวในระบบจะเห็นป้ายแบบไม่กะพริบ)
            </span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={saveDetails} disabled={busy} className="rd-btn" style={primaryBtn(busy)}>
              <Icon name="check" size={14} /> บันทึกหัวข้อ
            </button>
            <button
              type="button"
              onClick={() => patch({ visible: !section.visible }, section.visible ? 'ซ่อนหัวข้อแล้ว' : 'แสดงหัวข้อแล้ว')}
              disabled={busy}
              className="rd-btn"
              style={secondaryBtn(busy)}
            >
              <Icon name={section.visible ? 'eyeOff' : 'eye'} size={14} /> {section.visible ? 'ซ่อน' : 'แสดง'}
            </button>
            <button
              type="button"
              onClick={() => patch({ default_expanded: !section.default_expanded }, 'บันทึกแล้ว')}
              disabled={busy}
              className="rd-btn"
              style={secondaryBtn(busy)}
            >
              <Icon name={section.default_expanded ? 'chevDown' : 'chevRight'} size={14} />
              {section.default_expanded ? 'เปิดอยู่เริ่มต้น' : 'ปิดอยู่เริ่มต้น'}
            </button>
            {!isAuto && (
              <>
                <button type="button" onClick={onMoveUp} disabled={busy} className="rd-btn" style={secondaryBtn(busy)} title="เลื่อนขึ้น">↑</button>
                <button type="button" onClick={onMoveDown} disabled={busy} className="rd-btn" style={secondaryBtn(busy)} title="เลื่อนลง">↓</button>
                <button type="button" onClick={remove} disabled={busy} className="rd-btn" style={{ ...secondaryBtn(busy), color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  <Icon name="trash" size={14} /> ลบ
                </button>
              </>
            )}
          </div>

          {isAuto ? (
            <div>
              <label style={labelStyle}>จัดกลุ่มเอกสารที่เหลือตาม</label>
              <FilterChips
                label="โหมดจัดกลุ่มอัตโนมัติ"
                value={groupBy}
                onChange={(value) => patch({ settings: { ...settings, group_by: value } }, 'เปลี่ยนการจัดกลุ่มแล้ว')}
                items={[
                  { value: 'department', label: 'หน่วยงาน' },
                  { value: 'type', label: 'ประเภทเอกสาร' },
                ]}
              />
              <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.6 }}>
                แถบนี้แสดงเอกสารคุณภาพที่ยังไม่ถูกจัดเข้าหัวข้อใด ลบไม่ได้ — ถ้าไม่ต้องการให้แสดงบนหน้าเว็บ ให้ใช้ปุ่มซ่อน
              </p>
            </div>
          ) : (
            <ItemPicker
              drafts={drafts}
              setDrafts={setDrafts}
              docs={docs}
              attachments={attachments}
              uploads={uploads}
              busy={busy}
              onSave={saveItems}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ItemPicker({ drafts, setDrafts, docs, attachments, uploads, busy, onSave }: {
  drafts: DraftItem[]
  setDrafts: (next: DraftItem[]) => void
  docs: PublicDoc[]
  attachments: PublicAttachment[]
  uploads: PublicUpload[]
  busy: boolean
  onSave: (next: DraftItem[]) => Promise<void>
}) {
  const [source, setSource] = useState<'library' | 'test_attachment' | 'upload'>('library')
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const chosen = useMemo(() => ({
    library: new Set(drafts.flatMap((d) => (d.source === 'library' && d.document_id ? [d.document_id] : []))),
    attachment: new Set(drafts.flatMap((d) => (d.source === 'test_attachment' && d.test_document_id != null ? [d.test_document_id] : []))),
    upload: new Set(drafts.flatMap((d) => (d.source === 'upload' && d.upload_id ? [d.upload_id] : []))),
  }), [drafts])

  const q = search.trim().toLowerCase()
  const options = useMemo(() => {
    if (source === 'library') {
      return docs
        .filter((d) => !chosen.library.has(d.id))
        .filter((d) => !q || d.title.toLowerCase().includes(q) || d.document_code.toLowerCase().includes(q))
        .slice(0, 30)
        .map((d) => ({ key: d.id, primary: d.document_code, secondary: d.title, tag: d.type }))
    }
    if (source === 'test_attachment') {
      return attachments
        .filter((a) => !chosen.attachment.has(a.id))
        .filter((a) => !q || a.name.toLowerCase().includes(q) || a.test_code.toLowerCase().includes(q) || a.test_name.toLowerCase().includes(q))
        .slice(0, 30)
        .map((a) => ({ key: String(a.id), primary: a.test_code, secondary: a.name, tag: normalizeDocumentAccess('Public', a.access_mode).accessMode }))
    }
    return uploads
      .filter((u) => !chosen.upload.has(u.id))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.file_name.toLowerCase().includes(q))
      .slice(0, 30)
      .map((u) => ({ key: u.id, primary: 'ไฟล์', secondary: u.name, tag: u.file_name }))
  }, [source, docs, attachments, uploads, chosen, q])

  function addOption(key: string) {
    if (source === 'library') {
      const doc = docs.find((d) => d.id === key)
      if (doc) setDrafts([...drafts, { source: 'library', document_id: doc.id, label: doc.title, hint: doc.document_code }])
    } else if (source === 'test_attachment') {
      const att = attachments.find((a) => String(a.id) === key)
      if (att) setDrafts([...drafts, { source: 'test_attachment', test_document_id: att.id, label: att.name, hint: att.test_code }])
    } else {
      const up = uploads.find((u) => u.id === key)
      if (up) setDrafts([...drafts, { source: 'upload', upload_id: up.id, label: up.name, hint: up.file_name }])
    }
    setSearch('')
  }

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/public-section-uploads', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) throw new Error((json.error as string) || 'อัปโหลดไม่สำเร็จ')
      const up = json as PublicUpload
      setDrafts([...drafts, { source: 'upload', upload_id: up.id, label: up.name, hint: up.file_name }])
    } catch {
      // Surfaced by the save step; keep the picker usable.
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function moveDraft(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= drafts.length) return
    const next = [...drafts]
    ;[next[index], next[target]] = [next[target], next[index]]
    setDrafts(next)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <label style={labelStyle}>เอกสารในหัวข้อนี้</label>

      {drafts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {drafts.map((draft, index) => (
            <div key={`${draft.source}-${draft.document_id ?? draft.test_document_id ?? draft.upload_id}`} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px', flexWrap: 'wrap',
              borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface-2)',
            }}>
              <Badge color="gray" size="sm">{SOURCE_LABEL[draft.source]}</Badge>
              <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: 'var(--ink)' }}>
                {draft.label_override?.trim() || draft.label}
                <span style={{ color: 'var(--muted)', marginLeft: 6, fontSize: 11.5 }}>{draft.hint}</span>
              </span>
              <button type="button" onClick={() => setEditing(editing === index ? null : index)} className="rd-btn" style={ghostBtn} title="ตั้งชื่อที่จะแสดง">
                <Icon name="edit" size={13} />
              </button>
              <button type="button" onClick={() => moveDraft(index, -1)} className="rd-btn" style={ghostBtn} title="เลื่อนขึ้น">↑</button>
              <button type="button" onClick={() => moveDraft(index, 1)} className="rd-btn" style={ghostBtn} title="เลื่อนลง">↓</button>
              <button
                type="button"
                onClick={() => setDrafts(drafts.filter((_, i) => i !== index))}
                className="rd-btn"
                style={{ ...ghostBtn, color: 'var(--danger)' }}
                title="เอาออก"
              >
                <Icon name="x" size={13} />
              </button>
              {editing === index && (
                <div style={{ flexBasis: '100%', marginTop: 6 }}>
                  <Input
                    value={draft.label_override ?? ''}
                    onChange={(value) => setDrafts(drafts.map((d, i) => (i === index ? { ...d, label_override: value } : d)))}
                    placeholder={`ชื่อที่จะแสดง (เว้นว่าง = ${draft.label})`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <FilterChips
          label="แหล่งเอกสาร"
          value={source}
          onChange={setSource}
          compact
          items={[
            { value: 'library', label: 'คลังเอกสารคุณภาพ' },
            { value: 'test_attachment', label: 'ไฟล์แนบรายการตรวจ' },
            { value: 'upload', label: 'ไฟล์ที่อัปโหลด' },
          ]}
        />
      </div>

      {source === 'upload' && (
        <div style={{ marginBottom: 10 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              const file = e.dataTransfer.files[0]
              if (file) void uploadFile(file)
            }}
            style={{
              minHeight: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 10,
              background: dragOver ? 'var(--primary-soft)' : 'transparent', cursor: 'pointer',
              fontSize: 13, color: 'var(--muted)', padding: 14, textAlign: 'center',
            }}
          >
            <Icon name="upload" size={16} />
            {uploading ? 'กำลังอัปโหลด...' : 'คลิกหรือลากไฟล์มาวางเพื่ออัปโหลดใหม่'}
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f) }}
            />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--warning)', margin: '8px 0 0', lineHeight: 1.6 }}>
            ไฟล์ที่อัปโหลดตรงจะไม่ผ่านกระบวนการควบคุมเอกสาร (ไม่มีเลขที่/Revision/ตราประทับเอกสารไม่ควบคุม) เหมาะกับเอกสารประกอบเท่านั้น
          </p>
        </div>
      )}

      <Input
        icon="search"
        value={search}
        onChange={setSearch}
        placeholder={source === 'library' ? 'ค้นหาเอกสารคุณภาพ...' : source === 'test_attachment' ? 'ค้นหาไฟล์แนบรายการตรวจ...' : 'ค้นหาไฟล์ที่อัปโหลด...'}
      />

      {options.length > 0 && (
        <div style={{
          marginTop: 8, maxHeight: 220, overflowY: 'auto',
          border: '1px solid var(--border)', borderRadius: 9, background: 'var(--card)',
        }}>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => addOption(option.key)}
              className="rd-row"
              style={{
                width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 11.5, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', flexShrink: 0, minWidth: 72 }}>
                {option.primary}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--ink)' }}>{option.secondary}</span>
              <Badge color="gray" size="sm">{option.tag}</Badge>
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={() => onSave(drafts)} disabled={busy} className="rd-btn" style={primaryBtn(busy)}>
          <Icon name="check" size={14} /> บันทึกรายการเอกสาร
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, display: 'block',
}

const ghostBtn: React.CSSProperties = {
  minWidth: 44, minHeight: 44, borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 44, padding: '0 18px', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    border: '1px solid var(--primary)', background: 'var(--primary)', color: '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 7,
  }
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 44, padding: '0 14px', borderRadius: 9, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .55 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 7,
  }
}
