import { supabaseAdmin } from '@/lib/supabase/admin'

// Distinct document ids that have an active (non-cancelled, non-published) working
// revision draft with a Word/Excel source uploaded — i.e. the "รอ DCC ทำ PDF" queue.
// Shared by the documents list API (?sourceUploaded=1), the pending-approval page,
// and the documents dashboard.
export async function getSourceUploadedDocumentIds(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('document_id')
    .is('cancelled_at', null)
    .neq('status', 'Published')
    .not('word_url', 'is', null)
  if (error) throw new Error(error.message)
  return Array.from(new Set((data ?? []).map((row) => row.document_id).filter(Boolean)))
}

export interface ActiveDraftRow {
  documentId: string
  draftId: string
  revision: string
  status: 'Draft' | 'Review' | 'Approved'
  updatedAt: string
  hasWordUrl: boolean
  hasOfficialPdf: boolean
}

// All active (non-cancelled, non-published) working revision drafts, with enough info
// to bucket them by their own status (Draft/Review/Approved) — a draft's status is
// independent from its parent document's status (the parent stays "Published" while a
// draft is in progress), so the pending-approval page needs this to know which drafts
// are actually waiting on a reviewer/approver vs still waiting on DCC to prep the PDF.
export async function getActiveRevisionDrafts(): Promise<ActiveDraftRow[]> {
  const { data, error } = await supabaseAdmin
    .from('document_revision_drafts')
    .select('id, document_id, revision, status, updated_at, type, word_url, file_url, source_pdf_url')
    .is('cancelled_at', null)
    .neq('status', 'Published')
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({
    documentId: d.document_id,
    draftId: d.id,
    revision: d.revision,
    status: d.status as 'Draft' | 'Review' | 'Approved',
    updatedAt: d.updated_at,
    hasWordUrl: Boolean(d.word_url),
    hasOfficialPdf: d.type === 'QP' || d.type === 'WI'
      ? Boolean(d.source_pdf_url || d.file_url)
      : Boolean(d.file_url),
  }))
}
