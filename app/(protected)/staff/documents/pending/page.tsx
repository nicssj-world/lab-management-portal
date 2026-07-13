import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getActiveRevisionDrafts, getNewDraftDocuments, getRegistrationSets } from '@/lib/documents/pending'
import { registrationSetQueueExcludedIds } from '@/lib/documents/registration-set-contracts'
import { PendingClient, type PendingDoc, type AnnualReviewDoc } from './PendingClient'

export const dynamic = 'force-dynamic'

const DOC_SELECT = 'id, document_code, title, type, department, revision, updated_at'
interface DocRow { id: string; document_code: string; title: string; type: string; department: string | null; revision: string | null; updated_at: string }

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: actor } = await supabase
    .from('profiles').select('role, doc_role, name').eq('id', user.id).single()

  const role = actor?.role ?? ''
  const docRole = actor?.doc_role ?? ''
  const allowed = ['Admin', 'Document Controller'].includes(role) || ['Document Controller', 'Reviewer'].includes(docRole)
  if (!allowed) redirect('/staff/dashboard')

  // Working revision drafts have their own status (Draft/Review/Approved) independent of
  // their parent document's status (the parent stays "Published" while a draft is worked
  // on) — bucket them by draft status so a draft moved to Review/Approved shows up in the
  // matching section instead of staying stuck under "รอ DCC".
  const [activeDrafts, newDraftRows, sets] = await Promise.all([
    getActiveRevisionDrafts().catch(() => []),
    getNewDraftDocuments().catch(() => []),
    // Unlike the legacy queues, a broken registration-set query must reach the route
    // error boundary so DCC can diagnose an incomplete or inconsistent set.
    getRegistrationSets(),
  ])
  const draftsAwaitingDcc = activeDrafts.filter((d) => d.status === 'Draft' && d.hasWordUrl)
  // Brand-new Rev.00 documents (not working-revision drafts) still in Draft with a Word/Excel
  // source uploaded — the "เอกสารใหม่ รอจัดทำ PDF" queue.
  const draftsInReview = activeDrafts.filter((d) => d.status === 'Review')
  const draftsApproved = activeDrafts.filter((d) => d.status === 'Approved')
  const setQueueExcludedIds = registrationSetQueueExcludedIds(sets.map((set) => ({
    mainDocumentId: set.mainDocument.id,
    memberIds: set.memberIds,
  })))

  const draftDocIds = Array.from(new Set(activeDrafts.map((d) => d.documentId)))

  const [draftParentsRes, reviewRes, approvedRes, annualReviewRes] = await Promise.all([
    draftDocIds.length > 0
      ? supabaseAdmin.from('documents').select(DOC_SELECT).in('id', draftDocIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as DocRow[] }),
    supabaseAdmin.from('documents').select(DOC_SELECT).eq('status', 'Review').is('deleted_at', null).order('updated_at', { ascending: false }),
    supabaseAdmin.from('documents').select(DOC_SELECT).eq('status', 'Approved').is('deleted_at', null).order('updated_at', { ascending: false }),
    // Annual review queue: QP/WI Published docs whose review was confirmed, waiting for the
    // DCC to run the review-only bulk action (records "ทบทวนแล้ว ไม่มีการแก้ไข", no Rev bump).
    supabaseAdmin.from('documents')
      .select('id, document_code, title, type, department, revision, review_confirmed_at, review_confirmed_by_name')
      .eq('status', 'Published')
      .in('type', ['QP', 'WI'])
      .not('review_confirmed_at', 'is', null)
      .is('deleted_at', null)
      .order('review_confirmed_at', { ascending: true }),
  ])

  const parentById = new Map<string, DocRow>((draftParentsRes.data ?? []).map((d) => [d.id, d as DocRow]))

  function toDraftPendingDocs(drafts: typeof activeDrafts): PendingDoc[] {
    return drafts
      .map((d): PendingDoc | null => {
        const parent = parentById.get(d.documentId)
        if (!parent) return null
        return {
          id: parent.id,
          draftId: d.draftId,
          document_code: parent.document_code,
          title: parent.title,
          type: parent.type,
          department: parent.department,
          revision: d.revision,
          updated_at: d.updatedAt,
          hasOfficialPdf: d.hasOfficialPdf,
          kind: 'draft',
        }
      })
      .filter((d): d is PendingDoc => d !== null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }

  const sourceDocs = toDraftPendingDocs(draftsAwaitingDcc)
    .filter((doc) => !setQueueExcludedIds.has(doc.id))

  const reviewDocs: PendingDoc[] = [
    ...((reviewRes.data ?? []) as DocRow[]).map((d) => ({ ...d, kind: 'document' as const })),
    ...toDraftPendingDocs(draftsInReview),
  ].filter((doc) => !setQueueExcludedIds.has(doc.id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const approvedDocs: PendingDoc[] = [
    ...((approvedRes.data ?? []) as DocRow[]).map((d) => ({ ...d, kind: 'document' as const })),
    ...toDraftPendingDocs(draftsApproved),
  ].filter((doc) => !setQueueExcludedIds.has(doc.id))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  const newDocs: PendingDoc[] = newDraftRows
    .filter((d) => !setQueueExcludedIds.has(d.id))
    .map((d) => ({
      id: d.id,
      document_code: d.document_code,
      title: d.title,
      type: d.type,
      department: d.department,
      revision: d.revision,
      updated_at: d.updated_at,
      hasOfficialPdf: d.hasOfficialPdf,
      kind: 'document' as const,
    }))

  const annualReviewDocs: AnnualReviewDoc[] = (annualReviewRes.data ?? []).map((d) => ({
    id: d.id,
    document_code: d.document_code,
    title: d.title,
    type: d.type,
    department: d.department,
    revision: d.revision,
    review_confirmed_at: d.review_confirmed_at as string,
    review_confirmed_by_name: d.review_confirmed_by_name,
  }))

  return (
    <PendingClient
      newDocs={newDocs}
      sourceDocs={sourceDocs}
      reviewDocs={reviewDocs}
      approvedDocs={approvedDocs}
      annualReviewDocs={annualReviewDocs}
      sets={sets}
      userRole={actor?.role ?? undefined}
      docRole={actor?.doc_role ?? undefined}
      userName={actor?.name ?? undefined}
      userId={user.id}
    />
  )
}
