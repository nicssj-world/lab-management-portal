import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTestByCatalogParam } from '@/lib/queries/tests'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { TestDetailCard } from '@/components/tests/TestDetailCard'
import { SpecimenSection } from '@/components/tests/SpecimenSection'
import { PublicTestDocumentActions } from '@/components/tests/PublicTestDocumentActions'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { orderRelatedTestDocuments } from '@/lib/documents/related-test-documents'
import { normalizeDocumentAccess } from '@/lib/tests/document-access'
import { sanitizeRichHtml } from '@/lib/html-sanitize'
import type { Category, TestDocument } from '@/lib/supabase/types'

const DOC_TYPE_COLOR: Record<string, string> = {
  QP: '#2563EB', WI: '#059669', RF: '#DC2626', Form: '#D97706',
  'Method Validation': '#7C3AED', 'Method Correlation': '#0891B2',
  'Measurement Uncertainty': '#065F46', Other: '#6B7280',
}

interface Props {
  params: Promise<{ code: string }>
}

export default async function CatalogDetailPage({ params }: Props) {
  const { code } = await params
  const supabase = await createClient()

  const test = await getTestByCatalogParam(supabase, code)
  if (!test) notFound()

  const relatedDocIds = test.related_doc_ids ?? []
  const [docsRes, relatedRes] = await Promise.all([
    supabaseAdmin.from('test_documents').select('*').eq('test_id', test.id).eq('visibility', 'Public').order('created_at'),
    relatedDocIds.length
      ? supabaseAdmin.from('documents').select('id,document_code,title,type,visibility,status').in('id', relatedDocIds).is('deleted_at', null).eq('visibility', 'Public').eq('status', 'Published')
      : Promise.resolve({ data: [] }),
  ])

  const documents = (docsRes.data ?? []) as TestDocument[]
  const relatedDocuments = orderRelatedTestDocuments(relatedDocIds, relatedRes.data ?? []).map((doc) => ({
    ...doc,
    accessMode: normalizeDocumentAccess(doc.visibility, test.related_doc_access?.[doc.id]).accessMode,
  }))
  const category = (test as any).categories as Category | undefined

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{`
        .catalog-detail-page {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 28px 60px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .catalog-detail-body {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 16px;
          align-items: start;
        }
        .catalog-detail-method-row {
          display: flex;
          gap: 16px;
          padding-block: 10px;
          border-bottom: 1px solid var(--border);
        }

        @media (max-width: 767px) {
          .catalog-detail-page {
            padding: 18px 16px 48px !important;
            gap: 12px !important;
          }
          .catalog-detail-breadcrumb {
            font-size: 12px !important;
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 2px;
          }
          .catalog-detail-header-card,
          .catalog-detail-section-card,
          .catalog-detail-side-card {
            padding: 16px !important;
            border-radius: 12px !important;
          }
          .catalog-detail-body {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .catalog-detail-left,
          .catalog-detail-sidebar {
            gap: 12px !important;
          }
          .catalog-detail-method-row {
            display: block !important;
          }
          .catalog-detail-method-row span {
            display: block;
          }
        .catalog-detail-method-row span + span {
            margin-top: 4px;
          }
          .catalog-detail-note {
            padding: 12px !important;
          }
        }
      `}</style>
      <div className="catalog-detail-page">

        {/* Breadcrumb */}
        <div className="catalog-detail-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none' }}>หน้าแรก</Link>
          <Icon name="chevRight" size={14} />
          <Link href="/catalog" style={{ color: 'var(--muted)', textDecoration: 'none' }}>รายการตรวจ</Link>
          <Icon name="chevRight" size={14} />
          <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{test.th}</span>
        </div>

        {/* Header card */}
        <Card className="catalog-detail-header-card" padding={24}>
          <TestDetailCard test={test} category={category} />
          {test.specimen_note && (
            <div className="catalog-detail-note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, padding: '12px 14px', borderTop: '1px solid var(--border)', color: 'var(--ink)' }}>
              <Icon name="alert" size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 4 }}>หมายเหตุ</div>
                <div style={{ fontSize: 13, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(test.specimen_note) }} />
              </div>
            </div>
          )}
        </Card>

        {/* Body: 2-column layout */}
        <div className="catalog-detail-body">
          {/* Left column */}
          <div className="catalog-detail-left" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(test.method || test.methodology_note || test.service) && (
              <Card className="catalog-detail-section-card" padding={20}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Icon name="microscope" size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>วิธีการตรวจวิเคราะห์</span>
                </div>
                {[
                  { label: 'หลักการทดสอบ', val: test.method },
                  { label: 'วัน-เวลาที่ตรวจวิเคราะห์', val: test.available_24hr ? 'ตลอด 24 ชั่วโมง' : test.service },
                  { label: 'วัตถุประสงค์/ข้อบ่งชี้ (Indication)', val: test.methodology_note },
                ].filter(r => r.val).map(r => (
                  <div className="catalog-detail-method-row" key={r.label}>
                    <span style={{ fontSize: 13, color: 'var(--muted)', minWidth: 130, flexShrink: 0 }}>{r.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>{r.val}</span>
                  </div>
                ))}
              </Card>
            )}

            <Card className="catalog-detail-section-card" padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Icon name="flask" size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>การเก็บตัวอย่าง</span>
              </div>
              <SpecimenSection test={test} showNote={false} />
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="catalog-detail-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card className="catalog-detail-side-card" padding={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
                <Icon name="doc" size={15} style={{ color: 'var(--primary)' }} />
                <span>เอกสารที่เกี่ยวข้อง</span>
              </div>
              {documents.length === 0 && relatedDocuments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>ยังไม่มีเอกสาร</div>
              ) : (
                <>
                  {relatedDocuments.map((doc) => (
                    <div key={`library-${doc.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 8, borderBottom: '1px solid var(--border)' }}>
                      <Icon name="doc" size={14} style={{ color: '#2563EB', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{doc.document_code} — {doc.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0, background: (DOC_TYPE_COLOR[doc.type as keyof typeof DOC_TYPE_COLOR] ?? '#6B7280') + '18', color: DOC_TYPE_COLOR[doc.type as keyof typeof DOC_TYPE_COLOR] ?? '#6B7280' }}>{doc.type}</span>
                      <PublicTestDocumentActions testId={test.id} source="library" documentId={doc.id} accessMode={doc.accessMode} />
                    </div>
                  ))}
                  {documents.map((doc) => (
                    <div key={`attachment-${doc.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 8, borderBottom: '1px solid var(--border)' }}>
                      <Icon name="doc" size={14} style={{ color: '#2563EB', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{doc.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, flexShrink: 0, background: (DOC_TYPE_COLOR[doc.doc_type as keyof typeof DOC_TYPE_COLOR] ?? '#6B7280') + '18', color: DOC_TYPE_COLOR[doc.doc_type as keyof typeof DOC_TYPE_COLOR] ?? '#6B7280' }}>{doc.doc_type}</span>
                      <PublicTestDocumentActions testId={test.id} source="attachment" documentId={String(doc.id)} accessMode={normalizeDocumentAccess(doc.visibility, doc.access_mode).accessMode} />
                    </div>
                  ))}
                </>
              )}
            </Card>

            {(test.contact_name || test.contact_phone || test.contact_email || test.contact_note) && (
              <Card className="catalog-detail-side-card" padding={16}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
                  <Icon name="phone" size={15} style={{ color: 'var(--primary)' }} />
                  <span>ติดต่อ</span>
                </div>
                {test.contact_name && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{test.contact_name}</div>
                )}
                {test.contact_note && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>{test.contact_note}</div>
                )}
                {test.contact_phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                    <Icon name="phone" size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                    {test.contact_phone}
                  </div>
                )}
                {test.contact_email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2563EB' }}>
                    <Icon name="mail" size={13} style={{ flexShrink: 0 }} />
                    <a href={`mailto:${test.contact_email}`} style={{ color: '#2563EB', textDecoration: 'none' }}>{test.contact_email}</a>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
