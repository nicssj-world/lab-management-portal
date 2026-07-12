'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { TestDetailCard } from '@/components/tests/TestDetailCard'
import { SpecimenSection } from '@/components/tests/SpecimenSection'
import { ReferenceRangeTable } from '@/components/tests/ReferenceRangeTable'
import { RawTableView } from '@/components/tests/ReferenceRangePaste'
import { PublicTestDocumentActions } from '@/components/tests/PublicTestDocumentActions'
import { buildTestDetailHref } from '@/lib/catalog/quick-search'
import { decodeTable } from '@/lib/utils/refTable'
import type { Category, Test, TestReferenceRange } from '@/lib/supabase/types'
import type { PublicRelatedTestDocument, PublicTestDocument } from '@/lib/catalog/public-test'

const DOC_TYPE_COLOR: Record<string, string> = {
  QP: '#2563EB',
  WI: '#059669',
  RF: '#DC2626',
  Form: '#D97706',
  'Method Validation': '#7C3AED',
  'Method Correlation': '#0891B2',
  'Measurement Uncertainty': '#065F46',
  Other: '#6B7280',
}

interface DetailPayload {
  test: Test
  category: Category | null
  referenceRanges: TestReferenceRange[]
  documents: PublicTestDocument[]
  relatedDocuments: PublicRelatedTestDocument[]
}

interface Props {
  testId: number | null
  fallbackTest: Test | null
  categories: Category[]
  onClose: () => void
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="catalog-detail-modal-section">
      <div className="catalog-detail-modal-section-title">
        <Icon name={icon} size={16} />
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="catalog-detail-modal-row">
      <span>{label}</span>
      <div>{value}</div>
    </div>
  )
}

function LoadingLine({ width }: { width: string }) {
  return <div className="catalog-detail-modal-skeleton" style={{ width }} />
}

export function CatalogDetailModal({ testId, fallbackTest, categories, onClose }: Props) {
  const [detail, setDetail] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!testId) return
    const controller = new AbortController()
    setDetail(null)
    setLoading(true)
    setError('')

    fetch(`/api/tests/${testId}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'ไม่สามารถโหลดรายละเอียดรายการตรวจได้')
        return json as DetailPayload
      })
      .then(setDetail)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายละเอียดรายการตรวจได้')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [testId])

  useEffect(() => {
    if (!testId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [testId, onClose])

  useEffect(() => {
    if (!testId) setDetail(null)
  }, [testId])

  const activeTest = (detail?.test ?? fallbackTest) as Test | null
  const activeCategory = useMemo(() => {
    if (detail?.category) return detail.category
    if (!activeTest?.category_id) return undefined
    return categories.find((cat) => cat.id === activeTest.category_id)
  }, [activeTest?.category_id, categories, detail?.category])

  const referenceRanges = detail?.referenceRanges ?? []
  const documents = detail?.documents ?? []
  const relatedDocuments = detail?.relatedDocuments ?? []
  const table = decodeTable(activeTest?.ref)
  const showReference = referenceRanges.length > 0 || table || activeTest?.ref || activeTest?.ref_note

  if (!testId) return null

  return (
    <div
      className="catalog-detail-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <style>{`
        .catalog-detail-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 22px;
          background: rgba(15, 23, 42, .56);
          backdrop-filter: blur(8px);
        }
        .catalog-detail-modal-panel {
          width: min(960px, 100%);
          max-height: min(88dvh, 840px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--border) 80%, white 20%);
          border-radius: 16px;
          background: var(--card);
          color: var(--ink);
          box-shadow: 0 26px 70px rgba(15, 23, 42, .30);
        }
        .catalog-detail-modal-header {
          position: sticky;
          top: 0;
          z-index: 2;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--card) 94%, transparent);
          backdrop-filter: blur(10px);
        }
        .catalog-detail-modal-kicker {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .catalog-detail-modal-header-content {
          min-width: 0;
          flex: 1;
        }
        .catalog-detail-modal-chip {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .catalog-detail-modal-title {
          margin: 0;
          color: var(--ink);
          font-size: 22px;
          font-weight: 800;
          line-height: 1.3;
        }
        .catalog-detail-modal-title-row {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          min-width: 0;
        }
        .catalog-detail-modal-title-copy {
          min-width: 0;
          flex: 1;
        }
        .catalog-detail-modal-subtitle {
          margin-top: 4px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.5;
        }
        .catalog-detail-modal-actions {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .catalog-detail-modal-full-link {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface-2);
          color: var(--primary);
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          white-space: nowrap;
          transition: background .16s ease, color .16s ease, border-color .16s ease;
        }
        .catalog-detail-modal-full-link:hover,
        .catalog-detail-modal-full-link:focus-visible {
          border-color: var(--primary);
          background: var(--primary-soft);
          color: var(--primary);
          outline: none;
        }
        .catalog-detail-modal-close {
          min-width: 44px;
          min-height: 44px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--card);
          color: var(--muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background .16s ease, color .16s ease, border-color .16s ease;
        }
        .catalog-detail-modal-close:hover,
        .catalog-detail-modal-close:focus-visible {
          border-color: var(--primary);
          background: var(--primary-soft);
          color: var(--primary);
          outline: none;
        }
        .catalog-detail-modal-body {
          overflow-y: auto;
          padding: 20px;
        }
        .catalog-detail-modal-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(260px, .8fr);
          gap: 18px;
          align-items: start;
        }
        .catalog-detail-modal-stack {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .catalog-detail-modal-sidebar {
          min-width: 0;
          border-left: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
          padding-left: 18px;
        }
        .catalog-detail-modal-section {
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .catalog-detail-modal-section:first-child {
          padding-top: 0;
          border-top: 0;
        }
        .catalog-detail-modal-section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: var(--primary);
          font-size: 14px;
          font-weight: 800;
        }
        .catalog-detail-modal-row {
          display: grid;
          grid-template-columns: 136px minmax(0, 1fr);
          gap: 14px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
          color: var(--ink);
          font-size: 13px;
          line-height: 1.65;
        }
        .catalog-detail-modal-row > span {
          color: var(--muted);
          font-weight: 600;
        }
        .catalog-detail-modal-note {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--muted);
          font-size: 13px;
          line-height: 1.65;
          white-space: pre-wrap;
        }
        .catalog-detail-modal-doc {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          line-height: 1.45;
        }
        .catalog-detail-modal-doc-name {
          flex: 1;
          min-width: 0;
          color: var(--ink);
          font-weight: 600;
          overflow-wrap: anywhere;
        }
        .catalog-detail-modal-doc-type {
          flex-shrink: 0;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 800;
        }
        .catalog-detail-modal-skeleton {
          height: 14px;
          border-radius: 999px;
          background: var(--surface-2);
        }
        .catalog-detail-modal-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 14px;
          padding: 10px 12px;
          border: 1px solid rgba(220, 38, 38, .24);
          border-radius: 10px;
          background: rgba(220, 38, 38, .08);
          color: var(--danger);
          font-size: 13px;
          line-height: 1.55;
        }
        @media (max-width: 767px) {
          .catalog-detail-modal-backdrop {
            align-items: stretch;
            padding: 10px;
          }
          .catalog-detail-modal-panel {
            width: 100%;
            max-height: calc(100dvh - 20px);
            border-radius: 14px;
          }
          .catalog-detail-modal-header {
            padding: 14px 14px 12px;
            gap: 10px;
          }
          .catalog-detail-modal-title-row {
            gap: 8px;
            flex-wrap: wrap;
          }
          .catalog-detail-modal-full-link {
            padding: 0 10px;
            font-size: 12.5px;
          }
          .catalog-detail-modal-title {
            font-size: 19px;
          }
          .catalog-detail-modal-body {
            padding: 14px;
          }
          .catalog-detail-modal-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          .catalog-detail-modal-sidebar {
            border-left: 0;
            border-top: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
            padding-left: 0;
            padding-top: 14px;
          }
          .catalog-detail-modal-row {
            grid-template-columns: 1fr;
            gap: 4px;
          }
        }
        @media (prefers-reduced-motion: no-preference) {
          .catalog-detail-modal-backdrop {
            animation: catalogDetailFade .16s ease-out;
          }
          .catalog-detail-modal-panel {
            animation: catalogDetailPop .18s ease-out;
          }
        }
        @keyframes catalogDetailFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes catalogDetailPop {
          from { opacity: 0; transform: translateY(8px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        className="catalog-detail-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-detail-modal-title"
      >
        <header className="catalog-detail-modal-header">
          <div className="catalog-detail-modal-header-content">
            <div className="catalog-detail-modal-kicker">
              <span className="catalog-detail-modal-chip">รหัส E-Phis: {activeTest?.code ?? '-'}</span>
              <span className="catalog-detail-modal-chip">กรมบัญชีกลาง: {activeTest?.cgd ?? '-'}</span>
              {activeCategory && (
                <span
                  className="catalog-detail-modal-chip"
                  style={{ color: activeCategory.color, borderColor: `${activeCategory.color}33`, background: `${activeCategory.color}14` }}
                >
                  {activeCategory.th}
                </span>
              )}
            </div>
            <div className="catalog-detail-modal-title-row">
              <div className="catalog-detail-modal-title-copy">
                <h2 id="catalog-detail-modal-title" className="catalog-detail-modal-title">
                  {activeTest?.th ?? 'รายละเอียดรายการตรวจ'}
                </h2>
                {activeTest?.en && <div className="catalog-detail-modal-subtitle">{activeTest.en}</div>}
              </div>
              {activeTest && (
                <Link
                  href={buildTestDetailHref(activeTest)}
                  className="catalog-detail-modal-full-link"
                  aria-label="เปิดรายละเอียดรายการตรวจแบบหน้าเต็ม"
                >
                  <span>เปิดหน้าเต็ม</span>
                  <Icon name="arrowRight" size={13} />
                </Link>
              )}
            </div>
          </div>
          <div className="catalog-detail-modal-actions">
            <button
              type="button"
              className="catalog-detail-modal-close"
              onClick={onClose}
              aria-label="ปิดรายละเอียดรายการตรวจ"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        </header>

        <div className="catalog-detail-modal-body">
          {error && (
            <div className="catalog-detail-modal-error" role="alert">
              <Icon name="alert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}

          {activeTest ? (
            <div className="catalog-detail-modal-grid">
              <div className="catalog-detail-modal-stack">
                <Section icon="flask" title="ข้อมูลรายการตรวจ">
                  <TestDetailCard test={activeTest} category={activeCategory} />
                </Section>

                {(activeTest.method || activeTest.methodology_note || activeTest.service) && (
                  <Section icon="microscope" title="วิธีการตรวจวิเคราะห์">
                    <DetailRow label="หลักการทดสอบ" value={activeTest.method} />
                    <DetailRow label="วัน-เวลาที่ตรวจวิเคราะห์" value={activeTest.available_24hr ? 'ตลอด 24 ชั่วโมง' : activeTest.service} />
                    <DetailRow label="วัตถุประสงค์/ข้อบ่งชี้" value={activeTest.methodology_note} />
                  </Section>
                )}

                <Section icon="chart" title="ค่าอ้างอิง">
                  {referenceRanges.length > 0 ? (
                    <ReferenceRangeTable ranges={referenceRanges} />
                  ) : table ? (
                    <RawTableView table={table} />
                  ) : activeTest.ref ? (
                    <div style={{ color: 'var(--ink)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {activeTest.ref}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>ไม่มีข้อมูลค่าอ้างอิง</div>
                  )}
                  {showReference && activeTest.ref_note && (
                    <div className="catalog-detail-modal-note">
                      <Icon name="alert" size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{activeTest.ref_note}</span>
                    </div>
                  )}
                </Section>

                <Section icon="flask" title="การเก็บตัวอย่าง">
                  <SpecimenSection test={activeTest} />
                </Section>
              </div>

              <aside className="catalog-detail-modal-sidebar catalog-detail-modal-stack">
                <Section icon="doc" title="เอกสารที่เกี่ยวข้อง">
                  {loading && documents.length === 0 && relatedDocuments.length === 0 ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <LoadingLine width="85%" />
                      <LoadingLine width="70%" />
                    </div>
                  ) : documents.length === 0 && relatedDocuments.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีเอกสาร</div>
                  ) : (
                    <>
                      {relatedDocuments.map((doc) => {
                        const color = DOC_TYPE_COLOR[doc.type] ?? DOC_TYPE_COLOR.Other
                        return (
                          <div className="catalog-detail-modal-doc" key={`library-${doc.id}`}>
                            <Icon name="doc" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <span className="catalog-detail-modal-doc-name">{doc.document_code} — {doc.title}</span>
                            <span className="catalog-detail-modal-doc-type" style={{ background: `${color}18`, color }}>{doc.type}</span>
                            {activeTest && <PublicTestDocumentActions testId={activeTest.id} source="library" documentId={doc.id} accessMode={doc.accessMode} />}
                          </div>
                        )
                      })}
                      {documents.map((doc) => {
                        const color = DOC_TYPE_COLOR[doc.doc_type] ?? DOC_TYPE_COLOR.Other
                        return (
                          <div className="catalog-detail-modal-doc" key={`attachment-${doc.id}`}>
                            <Icon name="doc" size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <span className="catalog-detail-modal-doc-name">{doc.name}</span>
                            <span className="catalog-detail-modal-doc-type" style={{ background: `${color}18`, color }}>{doc.doc_type}</span>
                            {activeTest && <PublicTestDocumentActions testId={activeTest.id} source="attachment" documentId={String(doc.id)} accessMode={doc.accessMode} />}
                          </div>
                        )
                      })}
                    </>
                  )}
                </Section>

                {(activeTest.contact_name || activeTest.contact_phone || activeTest.contact_email || activeTest.contact_note) && (
                  <Section icon="phone" title="ติดต่อ">
                    <DetailRow label="ผู้ติดต่อ" value={activeTest.contact_name} />
                    <DetailRow label="โทรศัพท์" value={activeTest.contact_phone} />
                    <DetailRow
                      label="อีเมล"
                      value={activeTest.contact_email
                        ? <a href={`mailto:${activeTest.contact_email}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>{activeTest.contact_email}</a>
                        : null}
                    />
                    <DetailRow label="หมายเหตุ" value={activeTest.contact_note} />
                  </Section>
                )}
              </aside>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <LoadingLine width="62%" />
              <LoadingLine width="78%" />
              <LoadingLine width="42%" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
