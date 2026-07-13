import { supabaseAdmin } from '@/lib/supabase/admin'

// Distinct document ids that have an active (non-cancelled, non-published) working
// revision draft with a Word/Excel source uploaded — i.e. the "รอ DCC ทำ PDF" queue.
// Shared by the documents list API (?sourceUploaded=1), the pending-approval page,
// and the documents dashboard.
export async function getSourceUploadedDocumentIds(): Promise<string[]> {
  const [draftsRes, newDocsRes] = await Promise.all([
    supabaseAdmin
      .from('document_revision_drafts')
      .select('document_id')
      .is('cancelled_at', null)
      .neq('status', 'Published')
      .not('word_url', 'is', null),
    // Brand-new documents (Rev.00) still in Draft with a Word/Excel source uploaded —
    // never been Published, so they live on the documents row itself (not a revision draft).
    supabaseAdmin
      .from('documents')
      .select('id')
      .eq('status', 'Draft')
      .not('word_url', 'is', null)
      .is('deleted_at', null),
  ])
  if (draftsRes.error) throw new Error(draftsRes.error.message)
  if (newDocsRes.error) throw new Error(newDocsRes.error.message)
  const ids = [
    ...(draftsRes.data ?? []).map((row) => row.document_id),
    ...(newDocsRes.data ?? []).map((row) => row.id),
  ].filter(Boolean)
  return Array.from(new Set(ids))
}

export interface NewDraftDocRow {
  id: string
  document_code: string
  title: string
  type: string
  department: string | null
  revision: string | null
  updated_at: string
  hasOfficialPdf: boolean
}

// Brand-new documents (Rev.00) sitting in Draft on the documents table itself with a
// Word/Excel source already uploaded — the "เอกสารใหม่ รอจัดทำ PDF" DCC queue. Distinct
// from getActiveRevisionDrafts (working revisions on already-Published documents).
export async function getNewDraftDocuments(): Promise<NewDraftDocRow[]> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, document_code, title, type, department, revision, updated_at, file_url, source_pdf_url')
    .eq('status', 'Draft')
    .not('word_url', 'is', null)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((d) => ({
    id: d.id,
    document_code: d.document_code,
    title: d.title,
    type: d.type,
    department: d.department,
    revision: d.revision,
    updated_at: d.updated_at,
    hasOfficialPdf: d.type === 'QP' || d.type === 'WI'
      ? Boolean(d.source_pdf_url || d.file_url)
      : Boolean(d.file_url),
  }))
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

export interface PendingApprovalDoc {
  id: string
  document_code: string
  title: string
  updated_at: string
}

// Documents (or their active working-revision draft) currently sitting in Review or
// Approved status — the same definition of "pending" used by /staff/documents/pending,
// reused here for the dashboard's Attention Queue. Deduplicated by document id in case a
// document's own status and its draft's status would otherwise double-count it.
export async function getPendingApprovalDocuments(): Promise<PendingApprovalDoc[]> {
  const [reviewRes, approvedRes, newDraftRes, drafts] = await Promise.all([
    supabaseAdmin.from('documents').select('id, document_code, title, updated_at')
      .eq('status', 'Review').is('deleted_at', null),
    supabaseAdmin.from('documents').select('id, document_code, title, updated_at')
      .eq('status', 'Approved').is('deleted_at', null),
    // Brand-new Rev.00 documents in Draft with a source file uploaded, waiting for DCC.
    supabaseAdmin.from('documents').select('id, document_code, title, updated_at')
      .eq('status', 'Draft').not('word_url', 'is', null).is('deleted_at', null),
    getActiveRevisionDrafts(),
  ])

  const draftDocs = drafts.filter(d => d.status === 'Review' || d.status === 'Approved')
  const draftDocIds = Array.from(new Set(draftDocs.map(d => d.documentId)))
  const draftParents = draftDocIds.length > 0
    ? await supabaseAdmin.from('documents').select('id, document_code, title').in('id', draftDocIds).is('deleted_at', null)
    : { data: [] as { id: string; document_code: string; title: string }[] }

  const parentById = new Map(
    ((draftParents.data ?? []) as { id: string; document_code: string; title: string }[])
      .map(d => [d.id, d] as const),
  )
  const fromDrafts: PendingApprovalDoc[] = draftDocs
    .map((d): PendingApprovalDoc | null => {
      const parent = parentById.get(d.documentId)
      return parent ? { id: parent.id, document_code: parent.document_code, title: parent.title, updated_at: d.updatedAt } : null
    })
    .filter((d): d is PendingApprovalDoc => d !== null)

  const fromStatus: PendingApprovalDoc[] = [
    ...((reviewRes.data ?? []) as PendingApprovalDoc[]),
    ...((approvedRes.data ?? []) as PendingApprovalDoc[]),
    ...((newDraftRes.data ?? []) as PendingApprovalDoc[]),
  ]

  const seen = new Set<string>()
  const merged: PendingApprovalDoc[] = []
  for (const doc of [...fromStatus, ...fromDrafts]) {
    if (seen.has(doc.id)) continue
    seen.add(doc.id)
    merged.push(doc)
  }
  return merged
}
